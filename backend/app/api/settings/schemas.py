"""Pydantic schemas for settings API."""
from pydantic import BaseModel
from typing import List


class SyncConfig(BaseModel):
    is_enabled: bool
    excluded_folders: List[str]


class PurgeFolderRequest(BaseModel):
    folder_path: str


class MapStyleRequest(BaseModel):
    map_style: str


class LockedSetupRequest(BaseModel):
    password: str
