use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
    pub upload_dir: PathBuf,
    pub thumbnails_dir: PathBuf,
    pub python_ml_url: String,
    pub api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8269);

        let default_db_path = env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("backend_rust")
            .join("prism.db");

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| format!("sqlite://{}", default_db_path.to_string_lossy()));

        let upload_dir = env::var("UPLOAD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("uploads"));

        let thumbnails_dir = env::var("THUMBNAILS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("thumbnails"));

        let python_ml_url = env::var("PYTHON_ML_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8270".to_string());

        let api_key = env::var("API_KEY").ok();

        Config {
            port,
            host,
            database_url,
            upload_dir,
            thumbnails_dir,
            python_ml_url,
            api_key,
        }
    }
}
