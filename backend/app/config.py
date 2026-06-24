from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os
import sys
import tempfile
from dotenv import load_dotenv

# Load .env file into os.environ
load_dotenv()

# Force offline mode for Hugging Face and transformers if local cache exists
base_dir = Path(__file__).resolve().parent.parent
cache_dir = base_dir / "models" / ".cache" / "huggingface"
if cache_dir.exists():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

def get_user_data_dir() -> Path:
    """Resolve platform-specific user data directory."""
    if "pytest" in sys.modules or os.environ.get("PRISM_TEST") == "1":
        temp_dir = Path(tempfile.gettempdir()) / "prism_tests"
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        base = Path(appdata) if appdata else Path.home() / "AppData" / "Roaming"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        # standard Linux/POSIX path
        base = Path.home() / ".local" / "share"
        
    path = base / "prism"
    path.mkdir(parents=True, exist_ok=True)
    return path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")
    
    PROJECT_NAME: str = "Prism Photos API"
    API_V1_STR: str = "/api/v1"
    
    # Base and user data directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = get_user_data_dir()
    UPLOAD_DIR: Path = DATA_DIR / "uploads"
    THUMBNAILS_DIR: Path = DATA_DIR / "thumbnails"
    SETTINGS_FILE: Path = DATA_DIR / "settings.json"
    DATABASE_FILE: Path = DATA_DIR / "Prism.db"

    # Face Detection & Clustering settings
    FACE_CONF_THRESHOLD: float = 0.65
    FACE_YAW_PITCH_LIMIT: float = 28.0
    FACE_MATCH_THRESHOLD: float = 0.41
    FACE_UNCERTAIN_MATCH_THRESHOLD: float = 0.33
    FACE_EARLY_EXIT_SCORE: float = 0.75
    FACE_DETECT_MAX_DIM: int = 1280

    # AI Model settings - Ollama Vision (replaces local GGUF)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_VISION_MODEL: str = "moondream:latest"
    OLLAMA_TIMEOUT: int = 120  # seconds

    # AI Feature Flags (Opt-in)
    ENABLE_AI_AGENT: bool = False
    ENABLE_AI_INPAINTING: bool = False
    ENABLE_AI_FACE: bool = False
    ENABLE_AI_CLIP: bool = False
    ENABLE_AI_REMBG: bool = False


settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

