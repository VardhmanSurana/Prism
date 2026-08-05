import re

with open("backend_rust/src/routes/photos_ai.rs", "r") as f:
    code = f.read()

# Replace get_auto_enhance
new_auto_enhance = """pub async fn get_auto_enhance(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<crate::services::auto_enhance::AutoEnhanceParams>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    
    // Load image for analysis
    let img_bytes = std::fs::read(&photo.path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read image: {}", e)))?;
    let img = image::load_from_memory(&img_bytes).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to decode image: {}", e)))?;
    
    let params = crate::services::auto_enhance::calculate_auto_enhance(&img);
    Ok(Json(params))
}"""

# Use regex to replace the function
pattern = r"pub async fn get_auto_enhance\([^)]+\)\s*->\s*Result<Json<Value>,\s*\(StatusCode,\s*String\)>\s*\{.*?\}\s*\}?"
# Be careful with nested braces, so we might just use a simple regex replacing from pub async fn get_auto_enhance to the first match
code = re.sub(r'pub async fn get_auto_enhance.*?Ok\(Json\(json!\(\{ "photo_id": photo\.id, "enhancements": null, "error":\s*e \}\)\)\)\s*\}\s*\}', new_auto_enhance, code, flags=re.DOTALL)

with open("backend_rust/src/routes/photos_ai.rs", "w") as f:
    f.write(code)
