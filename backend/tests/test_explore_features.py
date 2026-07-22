import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models import Base, Photo, Event, Album, PhotoAlbum, Person
from app.api.explore import explore_insights, explore_themes, explore_timeline, explore_on_this_day, explore_seasons, explore_activity, explore_highlights, generate_highlight_project, explore_rediscover_prompts


@pytest.mark.asyncio
async def test_explore_endpoints_and_features():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Populate test data
        p1 = Photo(
            filename="vacation1.jpg",
            path="/tmp/vacation1.jpg",
            width=1920,
            height=1080,
            aspect_ratio=1.77,
            city="Goa",
            country="India",
            exif_make="Sony",
            exif_model="A7IV",
            exif_focal_length=35.0,
            exif_iso=400,
            auto_tags='["sunset", "beach"]',
            blur_score=45.0,
        )
        p2 = Photo(
            filename="blurry_doc.jpg",
            path="/tmp/blurry_doc.jpg",
            width=800,
            height=600,
            aspect_ratio=1.33,
            blur_score=12.0,
        )
        db.add_all([p1, p2])
        await db.commit()

        event = Event(
            title="Goa Trip",
            event_type="trip",
            start_date=datetime.now(timezone.utc),
            location="Goa",
            summary="A fun beach trip"
        )
        db.add(event)
        await db.commit()

        alb = Album(name="Summer 2025", type="custom", photo_count=1)
        db.add(alb)
        await db.commit()

        # 1. Insights
        res_insights = await explore_insights(db)
        assert res_insights["photo_count"] == 2
        assert len(res_insights["cameras"]) >= 1
        assert res_insights["cameras"][0]["label"] == "Sony A7IV"

        # 2. Themes
        res_themes = await explore_themes(db)
        assert "themes" in res_themes

        # 3. Activity Feed
        res_act = await explore_activity(db)
        assert "activities" in res_act
        assert len(res_act["activities"]) >= 1

        # 4. Highlight Reels
        res_hl = await explore_highlights(db)
        assert "highlights" in res_hl

        # 5. Highlight Project Generation
        res_gen = await generate_highlight_project({"event_id": event.id}, db)
        assert res_gen["status"] == "ok"
        assert "project_json" in res_gen

        # 6. Rediscover Prompts
        res_redisc = await explore_rediscover_prompts(db)
        assert "unnamed_faces_count" in res_redisc
        assert "blurry_count" in res_redisc
        assert res_redisc["blurry_count"] >= 1

    await engine.dispose()
