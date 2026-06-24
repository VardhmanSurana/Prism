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
    # Make sure tables are created in the test database file
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Build trigger logic as done in lifespan
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
    # Drop all after session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    # Explicitly shut down Face SDK while pytest is still capturing output;
    # avoids C-level printf leaking to fd 1 after pytest closes its pipe.
    try:
        face_sdk.shutdown()
    except Exception:
        pass

@pytest_asyncio.fixture(autouse=True)
async def clean_database():
    # Clean up all table data before each test to isolate them
    yield
    async with async_session() as db:
        # Disable foreign keys temporarily for truncation
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
