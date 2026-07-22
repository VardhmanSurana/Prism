import pytest
import json
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

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


def test_rerank_and_explain():
    planner = MagicMock()
    search_tools = MagicMock()
    # Mock query embedding client
    emb_client = MagicMock()
    emb_client.get_query_embedding.return_value = [0.1] * 128
    search_tools.embedding_client = emb_client
    
    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)
    
    # 1. Setup mock photos
    photo1 = Photo(id=1, filename="sunset.jpg", caption="a beautiful sunset over goa", city="Goa", is_favorite=True, date_taken=None, embedding=None)
    photo2 = Photo(id=2, filename="sunset2.jpg", caption="a sunset", is_favorite=False, date_taken=None, embedding=None)
    photo3 = Photo(id=3, filename="cat.jpg", caption="my favorite cat", is_favorite=True, date_taken=None, embedding=None)
    
    # Mock people relationship on photo1
    mock_person = Person(id=10, name="Rahul")
    mock_photoperson = PhotoPerson(photo_id=1, person_id=10, person=mock_person, confidence=0.96)
    photo1.people = [mock_photoperson]
    photo2.people = []
    photo3.people = []

    # Mock embedding similarity check on photo2
    photo2.embedding = json.dumps([0.1] * 128) # exact match

    plan = {
        "entities": {
            "people": ["Rahul"],
            "locations": ["Goa"],
            "events": [],
            "objects": ["sunset"]
        }
    }
    
    ranked = orchestrator.rerank_and_explain("favorite sunset with Rahul in Goa", [photo1, photo2, photo3], plan)
    
    # photo1 matches: Goa (+2.0), Rahul detected (0.96 * 2.0 = +1.92), sunset in caption (+1.5), goa in caption (+1.5), favorite (+2.0), filename sunset (+0.5) -> 9.42
    # photo2 matches: sunset in caption (+1.5), AI visual match (cos similarity 1.28 * 10 -> +12.8), filename sunset (+0.5) -> 14.8
    # photo3 matches: favorite (+2.0), favorite in caption (+1.5) -> 3.5
    
    assert len(ranked) == 3
    assert ranked[0].id == 2
    assert ranked[1].id == 1
    assert ranked[2].id == 3
    
    # Check explanations
    assert photo1.search_explanation["score"] == 9.42
    assert "Rahul Detected" in photo1.search_explanation["matched"]
    assert photo2.search_explanation["score"] == 14.8
    assert "Ai Visual Match" in photo2.search_explanation["matched"]
    assert photo3.search_explanation["score"] == 3.5
    assert "Favorite" in photo3.search_explanation["matched"]


@pytest.mark.asyncio
async def test_conversational_memory_refinement(db_session):
    from datetime import datetime
    planner = MagicMock()
    search_tools = MagicMock()
    
    # Mock search tools to prevent await MagicMock errors
    search_tools.search_metadata = AsyncMock(return_value=set())
    search_tools.search_people = AsyncMock(return_value={20, 40})
    search_tools.search_captions = AsyncMock(return_value=set())
    search_tools.semantic_search = AsyncMock(return_value=set())
    search_tools.search_albums = AsyncMock(return_value=set())
    search_tools.search_ocr = AsyncMock(return_value=set())
    search_tools.search_events = AsyncMock(return_value=set())
    
    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)
    
    # Pre-populate session cache
    session_key = orchestrator._get_session_key([], "show photos of goa")
    orchestrator.session_cache[session_key] = {
        "base_query": "show photos of goa",
        "filters": [],
        "photo_ids": {10, 20, 30}
    }
    
    # Mock next query plan indicating refinement
    planner.extract_search_parameters.return_value = {
        "intent": "photo_search",
        "is_locked": False,
        "refine_previous": True,
        "entities": {
            "people": ["Rahul"]
        },
        "constraints": {
            "must_match": ["people"]
        },
        "ranking": {}
    }
    
    # Create Photo with required fields
    p1 = Photo(
        id=20, 
        filename="p20.jpg", 
        path="/p20.jpg", 
        is_trash=False, 
        is_locked=False, 
        width=1, 
        height=1, 
        aspect_ratio=1.0, 
        upload_date=datetime.utcnow(), 
        date_taken=datetime.utcnow()
    )
    p1.people = []
    p1.embedding = None
    
    mock_db_res = MagicMock()
    mock_db_res.scalars.return_value.all.return_value = [p1]
    
    with patch("app.agent.orchestrator.async_session") as mock_session_ctx:
        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_db_res
        mock_session_ctx.return_value.__aenter__.return_value = mock_db
        
        events = []
        async for event in orchestrator.chat_stream("only the ones with Rahul", history=[{"role": "user", "content": "show photos of goa"}]):
            events.append(event)
            
        # Verify db was queried with the intersected photo ID: 20 (intersection of {10, 20, 30} and {20, 40})
        called_stmt = mock_db.execute.call_args[0][0]
        stmt_str = str(called_stmt)
        assert "photos.id IN" in stmt_str
        
        # Verify the session cache was updated with the final returned ID: 20
        new_session_key = orchestrator._get_session_key([{"role": "user", "content": "show photos of goa"}], "only the ones with Rahul")
        assert orchestrator.session_cache[new_session_key]["photo_ids"] == {20}
        assert "only the ones with Rahul" in orchestrator.session_cache[new_session_key]["filters"]


@pytest.mark.asyncio
async def test_search_events(db_session):
    from app.models import Event
    from datetime import datetime

    ev = Event(
        title="Goa Trip 2025",
        event_type="trip",
        location="Goa",
        start_date=datetime(2025, 1, 1),
        end_date=datetime(2025, 1, 10),
        summary="A fun beach holiday"
    )
    db_session.add(ev)
    await db_session.flush()

    photo_linked = Photo(
        filename="linked.jpg",
        path="/linked.jpg",
        width=1,
        height=1,
        aspect_ratio=1.0,
        event_id=ev.id,
        upload_date=datetime.utcnow(),
        date_taken=datetime(2025, 1, 5)
    )
    
    photo_unlinked_goa = Photo(
        filename="unlinked.jpg",
        path="/unlinked.jpg",
        width=1,
        height=1,
        aspect_ratio=1.0,
        city="Goa",
        upload_date=datetime.utcnow(),
        date_taken=datetime(2025, 1, 3)
    )

    photo_other = Photo(
        filename="other.jpg",
        path="/other.jpg",
        width=1,
        height=1,
        aspect_ratio=1.0,
        city="Yelagiri",
        upload_date=datetime.utcnow(),
        date_taken=datetime(2024, 5, 5)
    )

    db_session.add_all([photo_linked, photo_unlinked_goa, photo_other])
    await db_session.commit()

    tools = SearchTools()
    
    results = await tools.search_events(db_session, "Goa Trip")
    assert photo_linked.id in results
    assert photo_unlinked_goa.id in results
    assert photo_other.id not in results


@pytest.mark.asyncio
async def test_search_metadata_month_year(db_session):
    from datetime import datetime
    p1 = Photo(
        id=500, filename="nov_2025.jpg", path="/nov_2025.jpg", width=1, height=1, aspect_ratio=1.0,
        date_taken=datetime(2025, 11, 15)
    )
    p2 = Photo(
        id=501, filename="jan_2026.jpg", path="/jan_2026.jpg", width=1, height=1, aspect_ratio=1.0,
        date_taken=datetime(2026, 1, 12)
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    tools = SearchTools()
    
    # Check that search_metadata filters correctly by year and month
    res_nov = await tools.search_metadata(db_session, year=2025, month=11)
    assert 500 in res_nov
    assert 501 not in res_nov

    res_jan = await tools.search_metadata(db_session, year=2026, month=1)
    assert 501 in res_jan
    assert 500 not in res_jan


@pytest.mark.asyncio
async def test_agent_analyze_photo_intent(db_session):
    from datetime import datetime
    photo = Photo(
        id=94,
        filename="IMG_20250423_165211.jpg",
        path="/IMG_20250423_165211.jpg",
        width=1920,
        height=1080,
        aspect_ratio=1.77,
        city="Mumbai",
        country="India",
        date_taken=datetime(2025, 4, 23, 16, 52, 11)
    )
    photo.people = []
    db_session.add(photo)
    await db_session.commit()

    planner = MagicMock()
    planner.extract_search_parameters.return_value = {
        "intent": "analyze_photo",
        "is_locked": False,
        "entities": {
            "photo_id": 94
        },
        "constraints": {},
        "ranking": {}
    }
    planner.generate_photo_analysis_response.return_value = "Photo IMG_20250423_165211.jpg (ID: 94) was taken in Mumbai, India."

    search_tools = MagicMock()
    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)

    events = []
    async for event in orchestrator.chat_stream('Analyze and describe photo: "IMG_20250423_165211.jpg" (ID: 94). What date, metadata, and location details can you find?'):
        events.append(event)

    result = next(e for e in events if e.get("type") == "result")
    assert result["text"] == "Photo IMG_20250423_165211.jpg (ID: 94) was taken in Mumbai, India."
    assert len(result["photos"]) == 1
    assert result["photos"][0]["id"] == 94


@pytest.mark.asyncio
async def test_agent_sessions_crud(db_session):
    from app.models import AgentSession, AgentMessage

    # 1. Create session
    sess = AgentSession(id="sess-123", title="Trip to Goa")
    db_session.add(sess)
    await db_session.commit()

    # Add messages
    msg1 = AgentMessage(session_id="sess-123", role="user", content="Find beach photos")
    msg2 = AgentMessage(session_id="sess-123", role="assistant", content="Found 2 beach photos")
    db_session.add_all([msg1, msg2])
    await db_session.commit()

    # 2. Query session with messages
    stmt = select(AgentSession).where(AgentSession.id == "sess-123").options(selectinload(AgentSession.messages))
    res = await db_session.execute(stmt)
    retrieved = res.scalar_one()

    assert retrieved.title == "Trip to Goa"
    assert len(retrieved.messages) == 2
    assert retrieved.messages[0].content == "Find beach photos"

    # 3. Update title
    retrieved.title = "Goa Vacation"
    await db_session.commit()

    # 4. Delete session (cascades messages)
    await db_session.delete(retrieved)
    await db_session.commit()

    res_deleted = await db_session.execute(select(AgentSession).where(AgentSession.id == "sess-123"))
    assert res_deleted.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_agent_uploaded_image_flow(db_session, tmp_path):
    img_file = tmp_path / "test_upload.jpg"
    img_file.write_bytes(b"fake image bytes")

    photo = Photo(
        id=77,
        filename="similar.jpg",
        path="/similar.jpg",
        width=100,
        height=100,
        aspect_ratio=1.0
    )
    db_session.add(photo)
    await db_session.commit()

    planner = MagicMock()
    planner.llm_manager.query_chat_server.return_value = {
        "choices": [{"message": {"content": "This image shows a scenic mountain sunset."}}]
    }

    search_tools = MagicMock()
    search_tools.embedding_client.get_image_embedding.return_value = [0.1] * 128
    search_tools.search_similar_by_embedding = AsyncMock(return_value={77})

    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)

    # 1. Test visual Q&A
    events_qa = []
    async for event in orchestrator.chat_stream("What is in this picture?", image_path=str(img_file)):
        events_qa.append(event)
    result_qa = next(e for e in events_qa if e.get("type") == "result")
    assert "mountain sunset" in result_qa["text"]

    # 2. Test similar photo search
    events_sim = []
    async for event in orchestrator.chat_stream("Find photos similar to this image", image_path=str(img_file)):
        events_sim.append(event)
    result_sim = next(e for e in events_sim if e.get("type") == "result")
    assert "visually similar" in result_sim["text"]
    assert len(result_sim["photos"]) == 1
    assert result_sim["photos"][0]["id"] == 77


@pytest.mark.asyncio
async def test_agent_analyse_spelling_and_context_fallback(db_session):
    planner = Planner(llm_manager=MagicMock())

    # 1. Test heuristic fallback for 'analyse the image' (British spelling)
    plan = planner.heuristic_fallback("analyse the image")
    assert plan["intent"] == "analyze_photo"

    # 2. Add a photo to DB
    photo = Photo(id=99, filename="latest.jpg", path="/latest.jpg", width=100, height=100, aspect_ratio=1.0)
    db_session.add(photo)
    await db_session.commit()

    # 3. Test orchestrator behavior without explicit photo_id (falls back to latest photo)
    planner.generate_photo_analysis_response = MagicMock(return_value="Analysis of latest.jpg (ID: 99)")
    search_tools = MagicMock()
    orchestrator = AgentOrchestrator(planner=planner, search_tools=search_tools)

    events = []
    async for event in orchestrator.chat_stream("analyze the image"):
        events.append(event)

    result = next(e for e in events if e.get("type") == "result")
    assert result["text"] == "Analysis of latest.jpg (ID: 99)"
    assert len(result["photos"]) == 1
    assert result["photos"][0]["id"] == 99



