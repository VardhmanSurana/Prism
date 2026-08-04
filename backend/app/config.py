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

    # ffmpeg binary path — set to custom build with CUDA support, or leave
    # empty to use the system ffmpeg (resolved via PATH).
    FFMPEG_PATH: str = ""

    # Face Detection & Clustering settings
    FACE_CONF_THRESHOLD: float = 0.65
    FACE_YAW_PITCH_LIMIT: float = 28.0
    FACE_MATCH_THRESHOLD: float = 0.41
    FACE_UNCERTAIN_MATCH_THRESHOLD: float = 0.33
    FACE_EARLY_EXIT_SCORE: float = 0.75
    FACE_DETECT_MAX_DIM: int = 1280

    # API Key for production authentication (empty = disabled for local dev)
    API_KEY: str = ""

    # AI Feature Flags (Opt-in)
    ENABLE_AI_AGENT: bool = False
    ENABLE_AI_INPAINTING: bool = False
    ENABLE_AI_FACE: bool = False
    ENABLE_AI_CLIP: bool = False
    ENABLE_AI_REMBG: bool = False
    ENABLE_AI_OCR: bool = False
    ENABLE_AI_SUBTITLES: bool = False
    ENABLE_AI_CONTENT_CLASSIFY: bool = True
    ENABLE_AI_STORY: bool = True
    ENABLE_RAW_PROCESSING: bool = True
    ENABLE_LAN_SYNC: bool = False
    ENABLE_GPU_ENCODING: bool = False  # Use NVENC when available (kept for backward compat)
    GPU_ENCODING_MODE: str = "auto"  # "auto" | "nvenc" | "vaapi" | "cpu"

    # Background Processing and Hardware Config
    ENABLE_IMAGE_BG_PROCESS: bool = True
    ENABLE_AI_CAPTION: bool = True
    ENABLE_VIDEO_BG_PROCESS: bool = True
    ENABLE_VIDEO_FACE: bool = True
    ENABLE_VIDEO_EDITOR_AI: bool = True
    GPU_MODE: str = "cuda"  # "cuda" | "rocm" | "sycl" | "vulkan" | "cpu"

    # LAN Sync settings
    LAN_SYNC_PORT: int = 8269
    LAN_SYNC_CHUNK_SIZE: int = 1024 * 1024  # 1MB chunks for file transfer

    # Video face detection settings
    VIDEO_FACE_SCENE_THRESHOLD: float = 0.3
    VIDEO_FACE_MAX_FRAMES: int = 50
    VIDEO_FACE_MIN_GAP_SECONDS: float = 5.0
    VIDEO_FACE_DEDUP_THRESHOLD: float = 0.7

    # Video face tracker settings
    VIDEO_FACE_TRACKER_IOU_THRESHOLD: float = 0.3
    VIDEO_FACE_TRACKER_CENTROID_DIST: float = 150.0
    VIDEO_FACE_TRACKER_EMB_SIM_THRESHOLD: float = 0.4
    VIDEO_FACE_TRACKER_MAX_MISSED: int = 5

    JOB_QUEUE_MAX_RETRIES: int = 5
    JOB_QUEUE_THROTTLE_CPU_THRESHOLD: float = 85.0
    JOB_QUEUE_THROTTLE_BATTERY_THRESHOLD: int = 20

    def __init__(self, **values):
        super().__init__(**values)
        self.load_dynamic_settings()

    def load_dynamic_settings(self):
        if self.SETTINGS_FILE.exists():
            try:
                import json
                with open(self.SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                    for k, v in data.items():
                        if hasattr(self, k):
                            setattr(self, k, v)
            except Exception as e:
                sys.stderr.write(f"Error loading dynamic settings: {e}\n")


settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

