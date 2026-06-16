import pytest
import json
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.future import select

from app.agent.planner import Planner
from app.agent.search_tools import SearchTools
from app.agent.orchestrator import AgentOrchestrator
from app.agent.embeddings import EmbeddingClient
from app.models import Photo, Person, PhotoPerson, Album

def test_parse_json_robustly():
    planner = Planner(llm_manager=MagicMock())
    
    # 1. Normal JSON
    res = planner._parse_json_robustly('{"intent": "test"}')
    assert res == {"intent": "test"}
    
    # 2. Markdown blocks
    res = planner._parse_json_robustly('```json\n{"intent": "test"}\n```')
    assert res == {"intent": "test"}
    
    # 3. Conversational trailing text
    res = planner._parse_json_robustly('Here is the plan:\n{"intent": "test"}\nHope this helps!')
    assert res == {"intent": "test"}

def test_validate_and_clean_planner_schema():
    planner = Planner(llm_manager=MagicMock())
    
    raw = {
        "intent": "photo_search",
        "is_locked": 1,
        "entities": {
            "people": ["family"],
            "locations": ["Goa"],
            "events": ["trip"],
            "objects": ["sunset"],
            "time_range": "2024",
            "limit": 15
        },
        "constraints": {
            "must_match": ["people", "locations"],
            "soft_match": ["objects", "invalid_match"]
        },
        "ranking": {
            "prefer_favorites": "true",
            "prefer_recent": False
        }
    }
    
    cleaned = planner._validate_and_clean_planner_schema(raw)
    assert cleaned["intent"] == "photo_search"
    assert cleaned["is_locked"] is True
    
    entities = cleaned["entities"]
    assert entities["people"] == ["family"]
    assert entities["locations"] == ["Goa"]
    assert entities["events"] == ["trip"]
    assert entities["objects"] == ["sunset"]
    assert entities["time_range"] == 2024
    
    constraints = cleaned["constraints"]
    assert constraints["must_match"] == ["people", "locations"]
    assert constraints["soft_match"] == ["objects"]
    
    ranking = cleaned["ranking"]
    assert ranking["prefer_favorites"] is True
    assert ranking["prefer_recent"] is False

@pytest.mark.asyncio
async def test_agent_caching():
    # Test Planner caching
    llm_mock = MagicMock()
    llm_mock.return_value = {"choices": [{"text": '{"intent": "photo_search", "is_locked": false, "entities": {}, "constraints": {}, "ranking": {}}'}]}
    llm_manager = MagicMock()
    llm_manager.get_llm.return_value = llm_mock
    
    planner = Planner(llm_manager=llm_manager)
    
    plan1 = planner.extract_search_parameters("query 1")
    plan2 = planner.extract_search_parameters("query 1")
    
    assert plan1 == plan2
    assert llm_mock.call_count == 1  # Verify cache was hit, calling LLM only once

@pytest.mark.asyncio
async def test_search_tools_locked_filtering(db_session):
    # Insert locked and unlocked photos
    photo_unlocked = Photo(id=10, filename="unlocked.jpg", path="/unlocked.jpg", is_locked=False, width=1, height=1, aspect_ratio=1.0)
    photo_locked = Photo(id=20, filename="locked.jpg", path="/locked.jpg", is_locked=True, width=1, height=1, aspect_ratio=1.0)
    photo_unlocked.caption = "beautiful dog"
    photo_locked.caption = "beautiful dog"
    
    db_session.add(photo_unlocked)
    db_session.add(photo_locked)
    await db_session.commit()
    
    tools = SearchTools()
    
    # 1. Metadata Search
    res_unlocked = await tools.search_metadata(db_session, is_locked=False)
    res_locked = await tools.search_metadata(db_session, is_locked=True)
    assert 10 in res_unlocked
    assert 20 not in res_unlocked
    assert 20 in res_locked
    assert 10 not in res_locked
    
    # 2. Caption Search
    res_unlocked = await tools.search_captions(db_session, "dog", is_locked=False)
    res_locked = await tools.search_captions(db_session, "dog", is_locked=True)
    assert 10 in res_unlocked
    assert 20 not in res_unlocked
    assert 20 in res_locked
    assert 10 not in res_locked

def test_heuristic_score_photos():
    orchestrator = AgentOrchestrator(planner=MagicMock(), search_tools=MagicMock())
    
    photo1 = Photo(id=1, filename="sunset.jpg", caption="a beautiful sunset over goa", city="Goa", is_favorite=True)
    photo2 = Photo(id=2, filename="sunset2.jpg", caption="a sunset", is_favorite=False)
    photo3 = Photo(id=3, filename="cat.jpg", caption="my favorite cat", is_favorite=True)
    
    # Query: "favorite sunset in goa"
    ranked = orchestrator.heuristic_score_photos("favorite sunset in goa", [photo2, photo3, photo1])
    
    # photo1 matches favorites + sunset keyword + city "Goa" -> highest score
    # photo2 matches sunset keyword -> medium score
    # photo3 matches favorites keyword -> low score
    assert ranked[0].id == 1
    assert ranked[1].id == 3 or ranked[1].id == 2  # both match some keyword
    assert ranked[2].id == 3 or ranked[2].id == 2

@pytest.mark.asyncio
async def test_chat_stream_progress_and_combination(db_session):
    # Setup test photos
    photo1 = Photo(id=100, filename="dog.jpg", path="/dog.jpg", caption="dog", is_locked=False, width=1, height=1, aspect_ratio=1.0)
    db_session.add(photo1)
    await db_session.commit()

    # Mock Planner and SearchTools
    planner = MagicMock()
    planner.extract_search_parameters.return_value = {
        "intent": "photo_search",
        "is_locked": False,
        "entities": {
            "people": [],
            "locations": ["Goa"],
            "events": [],
            "objects": ["dog"],
            "time_range": 2025
        },
        "constraints": {
            "must_match": ["locations"],
            "soft_match": ["objects"]
        },
        "ranking": {
            "prefer_favorites": True,
            "prefer_recent": True
        },
        "limit": 10
    }
    planner.verify_photos_match.return_value = [100]
    planner.generate_chat_response.return_value = "Here is the dog photo."

    search_tools = MagicMock()
    # search_metadata (strict tool) returns matching ID
    search_tools.search_metadata = AsyncMock(return_value={100})
    # search_captions (soft tool) returns photo 100
    search_tools.search_captions = AsyncMock(return_value={100})

    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)

    events = []
    async for event in orchestrator.chat_stream("find dog"):
        events.append(event)

    # Ensure progress events were yielded
    states = [e.get("state") for e in events if e.get("type") == "progress"]
    assert "planning" in states
    assert "running_tools" in states
    assert "verifying" in states
    assert "generating_response" in states

    # Ensure final result event is correct
    result = next(e for e in events if e.get("type") == "result")
    assert result["text"] == "Here is the dog photo."
    assert len(result["photos"]) == 1
    assert result["photos"][0]["id"] == 100
