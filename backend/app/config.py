from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")
    
    PROJECT_NAME: str = "Prism Photos API"
    API_V1_STR: str = "/api/v1"
    
    # Base directory for the project
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    THUMBNAILS_DIR: Path = BASE_DIR / "thumbnails"
    SETTINGS_FILE: Path = BASE_DIR / "settings.json"

    # Face Detection & Clustering settings
    FACE_CONF_THRESHOLD: float = 0.65
    FACE_YAW_PITCH_LIMIT: float = 28.0
    FACE_MATCH_THRESHOLD: float = 0.41
    FACE_EARLY_EXIT_SCORE: float = 0.75
    FACE_DETECT_MAX_DIM: int = 1280

    # AI Model settings - Ollama Vision (replaces local GGUF)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_VISION_MODEL: str = "moondream:latest"  # or "llama3.2-vision", "moondream", etc.
    OLLAMA_TIMEOUT: int = 120  # seconds

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
