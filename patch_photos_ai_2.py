import re

with open("backend_rust/src/routes/photos_ai.rs", "r") as f:
    code = f.read()

# Replace get_semantic_masks
new_semantic = """pub async fn get_semantic_masks(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<crate::services::segmentation::SemanticMasksResponse>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let engine = crate::services::segmentation::SegmentationEngine::get();
    match engine.get_semantic_masks(&photo.path) {
        Ok(masks) => Ok(Json(masks)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e))
    }
}"""

new_background = """pub async fn get_background_mask(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<crate::services::segmentation::BackgroundMaskResponse>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let engine = crate::services::segmentation::SegmentationEngine::get();
    match engine.get_background_mask(&photo.path) {
        Ok(masks) => Ok(Json(masks)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e))
    }
}"""

new_portrait = """pub async fn get_portrait_masks(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<crate::services::segmentation::PortraitMasksResponse>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let engine = crate::services::segmentation::SegmentationEngine::get();
    match engine.get_portrait_masks(&photo.path) {
        Ok(masks) => Ok(Json(masks)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e))
    }
}"""

# Use regex to replace the old ones
code = re.sub(r'pub async fn get_semantic_masks.*?Ok\(Json\(json!\(\{ "photo_id": photo\.id, "masks": null, "error":\s*e \}\)\)\)\s*\}\s*\}', new_semantic, code, flags=re.DOTALL)
code = re.sub(r'pub async fn get_background_mask.*?Ok\(Json\(json!\(\{ "photo_id": photo\.id, "mask": null, "error":\s*e \}\)\)\)\s*\}\s*\}', new_background, code, flags=re.DOTALL)
code = re.sub(r'pub async fn get_portrait_masks.*?Ok\(Json\(json!\(\{ "photo_id": photo\.id, "masks": null, "error":\s*e \}\)\)\)\s*\}\s*\}', new_portrait, code, flags=re.DOTALL)

with open("backend_rust/src/routes/photos_ai.rs", "w") as f:
    f.write(code)
