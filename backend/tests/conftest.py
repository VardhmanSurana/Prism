import asyncio
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models import Base
from app.db import get_db, engine, async_session
from app.main import app
from app.services.face_sdk import face_sdk


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    from app.config import settings
    # Clean up any leftover test database from previous runs to avoid FTS5 corruption/persistence
    for suffix in ["", "-shm", "-wal"]:
        db_path = settings.DATABASE_FILE.parent / (settings.DATABASE_FILE.name + suffix)
        if db_path.exists():
            try:
                db_path.unlink()
            except OSError:
                pass

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename,
                caption,
                location,
                city,
                country,
                ai_summary,
                auto_tags
            )
        """))
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_insert AFTER INSERT ON photos
            BEGIN
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags)
                VALUES (new.id, new.filename, new.caption, new.location, new.city, new.country, new.ai_summary, new.auto_tags);
            END;
        """))
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    try:
        face_sdk.shutdown()
    except Exception:
        pass


@pytest_asyncio.fixture(autouse=True)
async def clean_database():
    yield
    async with async_session() as db:
        await db.execute(text("PRAGMA foreign_keys = OFF"))
        for table in reversed(Base.metadata.sorted_tables):
            await db.execute(text(f"DELETE FROM {table.name}"))
        await db.execute(text("DELETE FROM photos_fts"))
        await db.execute(text("PRAGMA foreign_keys = ON"))
        await db.commit()


@pytest_asyncio.fixture
async def db_session():
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
def override_db(db_session):
    async def _override():
        yield db_session
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


def pytest_configure(config):
    config.addinivalue_line("markers", "requires_ai_agent: requires ENABLE_AI_AGENT")
    config.addinivalue_line("markers", "requires_inpaint: requires ENABLE_AI_INPAINTING")
    config.addinivalue_line("markers", "requires_face: requires ENABLE_AI_FACE")
    config.addinivalue_line("markers", "requires_lan_sync: requires ENABLE_LAN_SYNC")
    config.addinivalue_line("markers", "requires_raw: requires ENABLE_RAW_PROCESSING")
    config.addinivalue_line("markers", "requires_ocr: requires ENABLE_AI_OCR")
    config.addinivalue_line("markers", "requires_ai_story: requires ENABLE_AI_STORY")


@pytest.fixture
def monkeypatch_flags(monkeypatch):
    import app.config as config_module

    def _patch(flag_dict: dict):
        for key, value in flag_dict.items():
            monkeypatch.setattr(config_module.settings, key, value, raising=False)

    return _patch
