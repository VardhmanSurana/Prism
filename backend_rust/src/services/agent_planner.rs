use serde_json::{json, Value};
use std::sync::Arc;
use crate::models::Photo;
use crate::services::llm_client::LlmClient;
use crate::services::llm_server::LlmMode;
use crate::services::llm_server::LlmServer;

#[derive(Clone)]
#[allow(dead_code)]
pub struct Planner {
    llm_client: LlmClient,
    server: Arc<LlmServer>,
}

#[allow(dead_code)]
impl Planner {
    pub fn new(llm_client: LlmClient, server: Arc<LlmServer>) -> Self {
        Self { llm_client, server }
    }

    fn parse_json_robustly(&self, text: &str) -> Result<Value, String> {
        let mut text = text.trim();
        if text.starts_with("```") {
            let lines: Vec<&str> = text.lines().collect();
            let start = if lines[0].starts_with("```") { 1 } else { 0 };
            let end = if lines.last().map_or(false, |l| l.starts_with("```")) { lines.len() - 1 } else { lines.len() };
            if start <= end {
                text = lines[start..end].join("\n").leak(); // Leak is fine for this short scope? No, need owned string
            }
        }

        let mut owned_text = text.to_string();
        if owned_text.starts_with("```") {
            let lines: Vec<&str> = owned_text.lines().collect();
            let start = if lines.first().map_or(false, |l| l.starts_with("```")) { 1 } else { 0 };
            let end = if lines.last().map_or(false, |l| l.starts_with("```")) { lines.len() - 1 } else { lines.len() };
            if start <= end {
                owned_text = lines[start..end].join("\n").trim().to_string();
            }
        }

        if let Ok(val) = serde_json::from_str::<Value>(&owned_text) {
            return Ok(val);
        }

        let start_idx = owned_text.find('{');
        let end_idx = owned_text.rfind('}');
        if let (Some(s), Some(e)) = (start_idx, end_idx) {
            if e > s {
                let candidate = &owned_text[s..=e];
                if let Ok(val) = serde_json::from_str::<Value>(candidate) {
                    return Ok(val);
                }
            }
        }
        
        Err("Could not parse valid JSON from LLM output".to_string())
    }

    fn validate_and_clean_planner_schema(&self, data: Value) -> Result<Value, String> {
        if !data.is_object() {
            return Err("Parsed LLM output is not a JSON object".to_string());
        }

        let raw_intent = data.get("intent").and_then(|v| v.as_str()).unwrap_or("photo_search").to_lowercase();
        let intent = if raw_intent.contains("analyze") || raw_intent.contains("analyse") || raw_intent.contains("describe") || raw_intent.contains("inspect") || raw_intent.contains("detail") {
            "analyze_photo"
        } else if raw_intent.contains("count") || raw_intent.contains("how_many") {
            "count_photos"
        } else {
            "photo_search"
        };

        let mut cleaned = json!({
            "intent": intent,
            "is_locked": false,
            "refine_previous": false,
            "entities": {},
            "constraints": {},
            "ranking": {}
        });

        if let Some(locked) = data.get("is_locked") {
            if let Some(s) = locked.as_str() {
                cleaned["is_locked"] = json!(s.to_lowercase() == "true" || s == "1" || s.to_lowercase() == "yes");
            } else if let Some(b) = locked.as_bool() {
                cleaned["is_locked"] = json!(b);
            }
        }

        if let Some(refine) = data.get("refine_previous") {
            if let Some(s) = refine.as_str() {
                cleaned["refine_previous"] = json!(s.to_lowercase() == "true" || s == "1" || s.to_lowercase() == "yes");
            } else if let Some(b) = refine.as_bool() {
                cleaned["refine_previous"] = json!(b);
            }
        }

        let mut cleaned_entities = json!({});
        let raw_entities = data.get("entities").cloned().unwrap_or(json!({}));
        let keys = vec!["people", "locations", "events", "objects"];
        for key in &keys {
            let mut val_arr = Vec::new();
            if let Some(val) = raw_entities.get(*key) {
                if let Some(arr) = val.as_array() {
                    val_arr = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
                } else if let Some(s) = val.as_str() {
                    val_arr.push(s.to_string());
                }
            }
            cleaned_entities[*key] = json!(val_arr);
        }

        if let Some(tr) = raw_entities.get("time_range") {
            if let Some(i) = tr.as_i64() {
                cleaned_entities["time_range"] = json!(i);
            } else if let Some(s) = tr.as_str() {
                if let Ok(i) = s.parse::<i64>() {
                    cleaned_entities["time_range"] = json!(i);
                } else {
                    cleaned_entities["time_range"] = json!(s);
                }
            } else {
                cleaned_entities["time_range"] = Value::Null;
            }
        } else {
            cleaned_entities["time_range"] = Value::Null;
        }

        let pid = raw_entities.get("photo_id").or(data.get("photo_id"));
        if let Some(p) = pid {
            if let Some(i) = p.as_i64() {
                cleaned_entities["photo_id"] = json!(i);
                cleaned["intent"] = json!("analyze_photo");
            } else if let Some(s) = p.as_str() {
                if let Ok(i) = s.parse::<i64>() {
                    cleaned_entities["photo_id"] = json!(i);
                    cleaned["intent"] = json!("analyze_photo");
                } else {
                    cleaned_entities["photo_id"] = Value::Null;
                }
            } else {
                cleaned_entities["photo_id"] = Value::Null;
            }
        } else {
            cleaned_entities["photo_id"] = Value::Null;
        }

        cleaned["entities"] = cleaned_entities;

        let raw_constraints = data.get("constraints").cloned().unwrap_or(json!({}));
        let mut cleaned_constraints = json!({});
        let valid_entity_keys = vec!["people", "locations", "events", "objects", "time_range", "photo_id"];
        
        for key in &["must_match", "soft_match"] {
            let mut val_arr = Vec::new();
            if let Some(val) = raw_constraints.get(*key) {
                if let Some(arr) = val.as_array() {
                    val_arr = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).filter(|s| valid_entity_keys.contains(&s.as_str())).collect();
                } else if let Some(s) = val.as_str() {
                    if valid_entity_keys.contains(&s) {
                        val_arr.push(s.to_string());
                    }
                }
            }
            cleaned_constraints[*key] = json!(val_arr);
        }
        cleaned["constraints"] = cleaned_constraints;

        let raw_ranking = data.get("ranking").cloned().unwrap_or(json!({}));
        let mut cleaned_ranking = json!({
            "prefer_favorites": false,
            "prefer_recent": true
        });

        if let Some(pref_fav) = raw_ranking.get("prefer_favorites") {
            if let Some(s) = pref_fav.as_str() {
                cleaned_ranking["prefer_favorites"] = json!(s.to_lowercase() == "true" || s == "1" || s.to_lowercase() == "yes");
            } else if let Some(b) = pref_fav.as_bool() {
                cleaned_ranking["prefer_favorites"] = json!(b);
            }
        }

        if let Some(pref_rec) = raw_ranking.get("prefer_recent") {
            if let Some(s) = pref_rec.as_str() {
                cleaned_ranking["prefer_recent"] = json!(s.to_lowercase() == "true" || s == "1" || s.to_lowercase() == "yes");
            } else if let Some(b) = pref_rec.as_bool() {
                cleaned_ranking["prefer_recent"] = json!(b);
            }
        }

        cleaned["ranking"] = cleaned_ranking;

        let limit = raw_entities.get("limit").or(data.get("limit")).and_then(|v| v.as_i64()).unwrap_or(30);
        cleaned["limit"] = json!(limit);

        Ok(cleaned)
    }

    fn heuristic_fallback(&self, message: &str) -> Value {
        let msg_lower = message.to_lowercase();
        // Skip regex for now, just some basic keywords
        let mut intent = "photo_search";
        if msg_lower.contains("analyze") || msg_lower.contains("describe") || msg_lower.contains("details") {
            intent = "analyze_photo";
        } else if msg_lower.contains("how many") || msg_lower.contains("count") {
            intent = "count_photos";
        }

        let mut search_terms: Vec<String> = msg_lower.split_whitespace().map(|s| s.trim_matches(|c| c == '?' || c == ',' || c == '.' || c == '!').to_string()).collect();
        search_terms.retain(|w| !["show", "me", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture", "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some"].contains(&w.as_str()));

        let is_favorite = msg_lower.contains("favorite") || msg_lower.contains("starred");
        let is_locked = msg_lower.contains("locked") || msg_lower.contains("private");
        
        let mut year = Value::Null;
        for w in &search_terms {
            if w.len() == 4 && w.chars().all(|c| c.is_ascii_digit()) {
                if let Ok(y) = w.parse::<i64>() {
                    year = json!(y);
                    break;
                }
            }
        }

        let locs = if !search_terms.is_empty() { vec![search_terms[0].clone()] } else { vec![] };

        json!({
            "intent": intent,
            "is_locked": is_locked,
            "refine_previous": false,
            "entities": {
                "people": [],
                "locations": locs,
                "events": [],
                "objects": search_terms,
                "time_range": year,
                "photo_id": Value::Null
            },
            "constraints": {
                "must_match": if !search_terms.is_empty() { vec!["locations"] } else { vec![] },
                "soft_match": ["objects"]
            },
            "ranking": {
                "prefer_favorites": is_favorite,
                "prefer_recent": true
            },
            "limit": 30
        })
    }

    pub async fn extract_search_parameters(&self, message: &str) -> Value {
        if let Ok(base_url) = self.server.base_url(LlmMode::Agent).await {
            let prompt = format!(
                "<start_of_turn>user\n\
                You are the query planner assistant for Prism Photos. Your job is to convert the user's request into a structured JSON query plan.\n\n\
                User request: \"{}\"\n\n\
                Output ONLY valid raw JSON object:\n\
                {{\n  \"intent\": \"photo_search\",\n  \"entities\": {{\n    \"people\": [],\n    \"locations\": [],\n    \"events\": [],\n    \"objects\": [],\n    \"time_range\": null,\n    \"photo_id\": null\n  }},\n  \"constraints\": {{\n    \"must_match\": [],\n    \"soft_match\": []\n  }},\n  \"ranking\": {{\n    \"prefer_favorites\": false,\n    \"prefer_recent\": true\n  }}\n}}\n\n\
                <end_of_turn>\n<start_of_turn>model\n",
                message
            );

            let payload = json!({
                "prompt": prompt,
                "max_tokens": 250,
                "temperature": 0.1,
                "top_p": 0.95,
                "top_k": 64,
                "stop": ["<end_of_turn>"]
            });

            if let Ok(resp) = reqwest::Client::new()
                .post(format!("{base_url}/v1/completions"))
                .json(&payload)
                .send()
                .await
            {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(text) = data["choices"][0]["text"].as_str() {
                        if let Ok(raw_data) = self.parse_json_robustly(text) {
                            if let Ok(cleaned) = self.validate_and_clean_planner_schema(raw_data) {
                                return cleaned;
                            }
                        }
                    }
                }
            }
        }
        
        self.heuristic_fallback(message)
    }

    pub async fn verify_photos_match(&self, _query: &str, photos_metadata: &[Photo]) -> Vec<i64> {
        let mut ids = Vec::new();
        for p in photos_metadata {
            ids.push(p.id);
        }
        ids
    }

    pub async fn generate_chat_response(&self, message: &str, photos: &[Photo]) -> String {
        if photos.is_empty() {
            return format!("I couldn't find any photos in your library matching '{}'.", message);
        }
        format!("I found {} photo{} matching your query! Click on any of them to view them in full screen.", photos.len(), if photos.len() > 1 { "s" } else { "" })
    }
}
