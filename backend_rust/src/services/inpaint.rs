use std::sync::OnceLock;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde_json::Value;
use tracing::{info, warn};

pub struct InpaintEngine {}

pub static INPAINT_ENGINE: OnceLock<InpaintEngine> = OnceLock::new();

impl InpaintEngine {
    pub fn get() -> &'static Self {
        INPAINT_ENGINE.get_or_init(|| InpaintEngine {})
    }

    /// Runs LaMa inpainting via the `simple_lama_inpainting` Python package
    /// (invoked as a subprocess). This bridges us until LaMa ONNX export is
    /// resolved — the interface is identical so swapping to ONNX later is a
    /// drop-in replacement inside this function.
    pub fn process_inpaint(
        &self,
        photo_path: &str,
        mask_data: &str,      // base64-encoded PNG mask
        _operation: &str,
        _prompt: Option<&str>,
        _guidance_scale: f64,
        _num_steps: i32,
    ) -> Result<Value, String> {
        info!("LaMa inpaint requested for: {}", photo_path);

        // Write the mask to a temp file so the script can read it
        let tmp_dir = std::env::temp_dir();
        let mask_tmp = tmp_dir.join(format!("prism_mask_{}.png", std::process::id()));

        // Decode base64 mask (strip data-URI prefix if present)
        let mask_b64 = if mask_data.contains(',') {
            mask_data.splitn(2, ',').nth(1).unwrap_or(mask_data)
        } else {
            mask_data
        };
        let mask_bytes = BASE64
            .decode(mask_b64)
            .map_err(|e| format!("Failed to decode mask base64: {}", e))?;
        std::fs::write(&mask_tmp, &mask_bytes)
            .map_err(|e| format!("Failed to write mask temp file: {}", e))?;

        // Locate the venv python relative to the manifest dir
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let python = manifest.join("../backend/.venv/bin/python");

        // Inline Python script: loads LaMa, runs inference, prints base64 result
        let script = format!(
            r#"
import sys, os, base64, io
from PIL import Image
from simple_lama_inpainting import SimpleLama

image_path = sys.argv[1]
mask_path  = sys.argv[2]

img  = Image.open(image_path).convert("RGB")
mask = Image.open(mask_path).convert("L")
if img.size != mask.size:
    mask = mask.resize(img.size, Image.LANCZOS)

lama = SimpleLama(device="cpu")
result = lama(img, mask)

buf = io.BytesIO()
result.save(buf, format="PNG")
print(base64.b64encode(buf.getvalue()).decode(), end="")
"#
        );

        let output = std::process::Command::new(&python)
            .args(["-c", &script, photo_path, mask_tmp.to_str().unwrap()])
            .output()
            .map_err(|e| format!("Failed to spawn LaMa process: {}", e))?;

        // Cleanup temp mask
        let _ = std::fs::remove_file(&mask_tmp);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            warn!("LaMa subprocess failed: {}", stderr);
            return Err(format!("LaMa inference failed: {}", stderr));
        }

        let result_b64 = String::from_utf8_lossy(&output.stdout).to_string();
        let data_url = format!("data:image/png;base64,{}", result_b64);

        Ok(serde_json::json!({
            "success": true,
            "result": data_url,
            "model": "lama",
            "operation": "remove"
        }))
    }
}
