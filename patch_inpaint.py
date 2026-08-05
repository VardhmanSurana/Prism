import re

with open("backend_rust/src/routes/photos_ai.rs", "r") as f:
    code = f.read()

new_inpaint = """    let engine = crate::services::inpaint::InpaintEngine::get();
    match engine.process_inpaint(
        &path,
        &payload.mask_data,
        &payload.operation,
        payload.prompt.as_deref(),
        payload.guidance_scale,
        payload.num_inference_steps,
    ) {
        Ok(res) => Ok(Json(res)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e))
    }"""

code = re.sub(r'let url = format!\("\{\}/ml/inpaint", state\.config\.python_ml_url\);.*?Err\(e\) => Err\(\(StatusCode::INTERNAL_SERVER_ERROR, e\)\)\s*\}', new_inpaint, code, flags=re.DOTALL)

with open("backend_rust/src/routes/photos_ai.rs", "w") as f:
    f.write(code)
