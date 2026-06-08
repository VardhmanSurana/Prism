import asyncio
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base
from app.db import get_db
from app.main import app

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(test_engine):
    _session_maker = async_sessionmaker(
        test_engine, expire_on_commit=False, class_=AsyncSession
    )
    async with _session_maker() as session:
        yield session
        await session.rollback()

@pytest.fixture(autouse=True)
def override_db(db_session):
    async def _override():
        yield db_session
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)
