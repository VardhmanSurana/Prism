import time
import pytest
from unittest.mock import patch, MagicMock

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.agent.utils.cache import LRUCache
from app.schema_migrations import apply_schema, _ensure_schema_version
from app.api.agent import _load_session_history
from app.models import Base, AgentSession, AgentMessage
from app.agent.llm import LlamaManager, KEEPALIVE_SECONDS


def test_lru_cache_evicts_oldest():
    cache = LRUCache(maxsize=3)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    
    assert cache.get("a") == 1  # accesses 'a', makes 'b' oldest
    cache.put("d", 4)  # evicts 'b'
    
    assert cache.get("b") is None
    assert cache.get("a") == 1
    assert cache.get("c") == 3
    assert cache.get("d") == 4
    assert len(cache) == 3


def test_lru_cache_dict_style_access():
    cache = LRUCache(maxsize=2)
    cache["x"] = 100
    cache["y"] = 200
    
    assert "x" in cache
    assert cache["x"] == 100
    
    cache["z"] = 300  # evicts "y" because "x" was accessed above
    assert "y" not in cache
    assert cache["z"] == 300


@pytest.mark.asyncio
async def test_schema_migration_versioning():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Initial run: schema_version table starts at version 0, then bumps to 1
        v_initial = await _ensure_schema_version(conn)
        assert v_initial == 0
        
        await apply_schema(conn)
        
        v_after = await _ensure_schema_version(conn)
        assert v_after == 1
        
        # Second run: idempotent, version stays at 1
        await apply_schema(conn)
        v_second = await _ensure_schema_version(conn)
        assert v_second == 1

    await engine.dispose()


@pytest.mark.asyncio
async def test_load_session_history_chronological():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        session = AgentSession(id="test-sess-1", title="Test Session")
        db.add(session)
        db.add(AgentMessage(session_id="test-sess-1", role="user", content="Hello"))
        db.add(AgentMessage(session_id="test-sess-1", role="assistant", content="Hi there!"))
        db.add(AgentMessage(session_id="test-sess-1", role="user", content="Find photos of Goa"))
        await db.commit()

        history = await _load_session_history("test-sess-1", db)
        assert len(history) == 3
        assert history[0] == {"role": "user", "content": "Hello"}
        assert history[1] == {"role": "assistant", "content": "Hi there!"}
        assert history[2] == {"role": "user", "content": "Find photos of Goa"}

    await engine.dispose()


def test_keepalive_timer_lifecycle():
    with patch("app.agent.llm.KEEPALIVE_SECONDS", 0.2):
        with patch.object(LlamaManager, "unload_llm") as mock_unload:
            LlamaManager.schedule_unload()
            time.sleep(0.3)
            mock_unload.assert_called_once()


def test_keepalive_timer_cancellation():
    with patch("app.agent.llm.KEEPALIVE_SECONDS", 0.5):
        with patch.object(LlamaManager, "unload_llm") as mock_unload:
            LlamaManager.schedule_unload()
            time.sleep(0.1)
            # Simulating new request cancels pending unload timer
            LlamaManager._cancel_keepalive()
            time.sleep(0.6)
            mock_unload.assert_not_called()
