"""Pydantic schemas for photo API requests."""

from pydantic import BaseModel


class UploadRequest(BaseModel):
    file_path: str
