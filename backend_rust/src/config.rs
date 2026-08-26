use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
    pub upload_dir: PathBuf,
    pub thumbnails_dir: PathBuf,
    pub api_key: Option<String>,
    pub gpu_mode: String,
    pub models_dir: PathBuf,
    pub packs_dir: PathBuf,
    pub plugins_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8269);

        // The backend is always launched from the `backend_rust/` directory
        // (run-web.sh / run-desktop.sh / package.json `backend:rust` all `cd`
        // into it), so the database lives at `<cwd>/prism.db`.
        let default_db_path = env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("prism.db");

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| format!("sqlite://{}", default_db_path.to_string_lossy()));

        let upload_dir = env::var("UPLOAD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("uploads"));

        let thumbnails_dir = env::var("THUMBNAILS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("thumbnails"));

        let api_key = env::var("API_KEY").ok();

        // GPU mode mirrors Python's settings.GPU_MODE ("cuda" | "rocm" | "sycl" | "vulkan" | "cpu").
        // "cpu" disables llama-server GPU flags (-ngl 0, no flash-attn).
        let gpu_mode = env::var("GPU_MODE").unwrap_or_else(|_| "cuda".to_string());

        // Model files live under backend_rust/models (llama GGUFs, PaddleOCR,
        // ONNX models). Overridable via MODELS_DIR.
        let models_dir = env::var("MODELS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join("models")
            });

        let packs_dir = env::var("PACKS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| models_dir.join("packs"));

        let plugins_dir = env::var("PLUGINS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let cur = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                let root_plugins = cur.join("../plugins");
                if root_plugins.exists() {
                    root_plugins
                } else {
                    cur.join("plugins")
                }
            });

        Config {
            port,
            host,
            database_url,
            upload_dir,
            thumbnails_dir,
            api_key,
            gpu_mode,
            models_dir,
            packs_dir,
            plugins_dir,
        }
    }
}
