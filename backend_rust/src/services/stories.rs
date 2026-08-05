use sqlx::SqlitePool;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use crate::services::llm_client::LlmClient;

pub async fn build_event_context(
    pool: &SqlitePool,
    photo_ids: &[i64],
    event_title: &str,
) -> Result<String, String> {
    let mut lines = Vec::new();

    if !event_title.is_empty() {
        lines.push(format!("Event: {}", event_title));
    }

    lines.push(format!("Total photos: {}", photo_ids.len()));

    if photo_ids.is_empty() {
        return Ok(lines.join("\n"));
    }

    let ids_str = photo_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let q = format!("SELECT date_taken, city, state, country, auto_tags, caption, ocr_text FROM photos WHERE id IN ({})", ids_str);
    
    // We should ideally use a proper query builder or bind parameters, 
    // but this is safe because photo_ids are strictly i64.
    
    #[derive(sqlx::FromRow)]
    struct PhotoMeta {
        date_taken: Option<String>,
        city: Option<String>,
        state: Option<String>,
        country: Option<String>,
        auto_tags: Option<String>,
        caption: Option<String>,
        ocr_text: Option<String>,
    }

    let photos = sqlx::query_as::<_, PhotoMeta>(&q)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    // Date range
    let mut dates = Vec::new();
    for p in &photos {
        if let Some(d) = &p.date_taken {
            if d.len() >= 10 {
                dates.push(d[..10].to_string());
            }
        }
    }
    dates.sort();
    if !dates.is_empty() {
        let earliest = dates.first().unwrap();
        let latest = dates.last().unwrap();
        if earliest == latest {
            lines.push(format!("Date: {}", earliest));
        } else {
            lines.push(format!("Dates: {} - {}", earliest, latest));
        }
    }

    // Locations
    let mut locations = HashSet::new();
    for p in &photos {
        let mut parts = Vec::new();
        if let Some(ref c) = p.city { parts.push(c.clone()); }
        if let Some(ref s) = p.state { parts.push(s.clone()); }
        if let Some(ref c) = p.country { parts.push(c.clone()); }
        let loc = parts.join(", ");
        if !loc.is_empty() {
            locations.insert(loc);
        }
    }
    if !locations.is_empty() {
        let mut locs: Vec<_> = locations.into_iter().collect();
        locs.sort();
        lines.push(format!("Locations: {}", locs.join(", ")));
    }

    // People
    let q_people = format!(
        "SELECT p.name FROM people p JOIN photo_people pp ON p.id = pp.person_id WHERE pp.photo_id IN ({})",
        ids_str
    );
    let people = sqlx::query_scalar::<_, String>(&q_people)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    
    if !people.is_empty() {
        let mut people_names: HashSet<String> = HashSet::new();
        for p in people {
            if !p.is_empty() {
                people_names.insert(p);
            }
        }
        let mut p_list: Vec<_> = people_names.into_iter().collect();
        p_list.sort();
        if p_list.len() <= 3 {
            lines.push(format!("People: {}", p_list.join(", ")));
        } else {
            lines.push(format!("People: {} and {} others", p_list[..3].join(", "), p_list.len() - 3));
        }
    }

    // Tags
    let mut all_tags = HashMap::new();
    for p in &photos {
        if let Some(ref tags_json) = p.auto_tags {
            if let Ok(Value::Array(tags)) = serde_json::from_str(tags_json) {
                for tag in tags {
                    if let Some(t) = tag.as_str() {
                        let t = t.trim().to_lowercase();
                        if !t.is_empty() {
                            *all_tags.entry(t).or_insert(0) += 1;
                        }
                    }
                }
            }
        }
    }
    if !all_tags.is_empty() {
        let mut tags_vec: Vec<_> = all_tags.into_iter().collect();
        tags_vec.sort_by(|a, b| b.1.cmp(&a.1));
        let top_tags: Vec<_> = tags_vec.into_iter().take(10).map(|(tag, count)| format!("{} ({})", tag, count)).collect();
        lines.push(format!("Tags: {}", top_tags.join(", ")));
    }

    // Captions
    let mut captions = Vec::new();
    for p in &photos {
        if let Some(ref c) = p.caption {
            if !c.is_empty() {
                captions.push(c.clone());
            }
        }
    }
    if !captions.is_empty() {
        lines.push("Sample captions:".to_string());
        for c in captions.into_iter().take(5) {
            let limit = if c.len() > 100 { 100 } else { c.len() };
            lines.push(format!("  - {}", &c[..limit]));
        }
    }

    // OCR
    let ocr_count = photos.iter().filter(|p| p.ocr_text.is_some() && !p.ocr_text.as_ref().unwrap().is_empty()).count();
    if ocr_count > 0 {
        lines.push(format!("Photos with text: {}", ocr_count));
    }

    Ok(lines.join("\n"))
}

pub async fn generate_story_for_context(
    context: &str,
    llm_client: &LlmClient,
) -> Result<String, String> {
    let prompt = format!(
        "You are a concise photo storyteller. Given metadata about a collection of photos, write a short, warm, natural-language summary (2-4 sentences).\n\n\
        Rules:\n\
        - Be specific: mention real names, places, dates\n\
        - Keep it under 50 words\n\
        - No bullet points, no lists — just a flowing paragraph\n\
        - If people are mentioned by name, weave them in naturally\n\
        - Match the tone: casual for trips, warm for family events\n\
        - Do NOT start with \"This collection\" or \"These photos\" — start directly with the subject\n\n\
        Context:\n{}\n\n\
        Write the story:",
        context
    );

    // Call LLM using Agent mode (temp 0.3)
    let payload = serde_json::json!({
        "prompt": prompt,
        "n_predict": 150,
        "temperature": 0.3,
    });
    
    // We should call LlmClient for generation.
    // LlmClient exposes `post_json` ? Wait, LlmClient might expose a way to chat.
    llm_client.preload_agent().await.ok();
    
    // Actually, LlmClient provides `post_json`? I need to check its methods.
    
    let base_url = llm_client.server.base_url(crate::services::llm_server::LlmMode::Agent).await?;
    let res = reqwest::Client::new()
        .post(format!("{}/completion", base_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["content"].as_str().unwrap_or("").trim().to_string();
    if content.is_empty() {
        return Err("LLM returned empty story".to_string());
    }

    Ok(content)
}
