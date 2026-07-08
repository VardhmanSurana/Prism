import logging


class LogAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "/thumbnails/" in msg or "/uploads/" in msg:
            return False
        return True


def setup_logging_filter():
    logging.getLogger("uvicorn.access").addFilter(LogAccessFilter())
