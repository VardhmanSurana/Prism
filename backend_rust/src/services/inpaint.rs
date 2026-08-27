use std::path::Path;
use std::sync::OnceLock;
use serde_json::Value;
use tracing::{info, warn};

pub struct InpaintEngine {}

pub static INPAINT_ENGINE: OnceLock<InpaintEngine> = OnceLock::new();

impl InpaintEngine {
    /// get - Performs get.
    pub fn get() -> &'static Self {
        INPAINT_ENGINE.get_or_init(|| InpaintEngine {})
    }

    /// LaMa inpainting.
    ///
    /// The previous implementation shelled out to the `simple_lama_inpainting`
    /// Python package, which died with the retired Python ML backend. A
    /// pure-Rust `ort::Session` inference path can be wired in here once a
    /// LaMa ONNX export exists (the original torch.export conversion was
    /// blocked by TorchScript JIT signatures). Until then, fail with a clear,
    /// honest error.
    pub fn process_inpaint(
        &self,
        photo_path: &str,
        _mask_data: &str, // base64-encoded PNG mask
        _operation: &str,
        _prompt: Option<&str>,
        _guidance_scale: f64,
        _num_steps: i32,
    ) -> Result<Value, String> {
        info!("LaMa inpaint requested for: {}", photo_path);

        let model = Path::new("models/inpainting/lama.onnx");
        if !model.exists() {
            warn!("Inpaint requested but LaMa ONNX model is missing: {}", model.display());
        }
        Err(format!(
            "Inpainting unavailable: requires a LaMa ONNX export at {} and an \
             ort inference session wired into this function. The old Python \
             bridge was removed with the retired ML service.",
            model.display()
        ))
    }
}
