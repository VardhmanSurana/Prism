import logging
from logging.handlers import RotatingFileHandler
from app.config import settings


class LogAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "/thumbnails/" in msg or "/uploads/" in msg:
            return False
        return True


def setup_logging_filter():
    logging.getLogger("uvicorn.access").addFilter(LogAccessFilter())

    try:
        log_file = settings.BASE_DIR / "backend.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)

        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB limit
            backupCount=3,
            encoding="utf-8"
        )
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s"
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.INFO)

        root_logger = logging.getLogger()
        
        # Check if already registered
        has_file_handler = False
        for handler in root_logger.handlers:
            if isinstance(handler, RotatingFileHandler) or (
                isinstance(handler, logging.FileHandler) and handler.baseFilename == str(log_file.resolve())
            ):
                has_file_handler = True
                break

        if not has_file_handler:
            root_logger.addHandler(file_handler)
            if root_logger.level > logging.INFO or root_logger.level == logging.NOTSET:
                root_logger.setLevel(logging.INFO)
    except Exception as e:
        # Fallback print if logger fails
        import sys
        sys.stderr.write(f"Failed to setup file logging redirection: {e}\n")
