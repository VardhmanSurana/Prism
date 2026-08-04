from pydantic import BaseModel
from typing import Optional


class UploadRequest(BaseModel):
    file_path: str
    resize_width: Optional[int] = None
