import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import Photo, Album, PhotoAlbum
from sqlalchemy import select

@pytest.mark.asyncio
async def test_custom_albums_workflow(db_session):
    # Setup photos
    p1 = Photo(filename="p1.jpg", path="/p1.jpg", url="local:///p1.jpg", width=800, height=600, aspect_ratio=1.33)
    p2 = Photo(filename="p2.jpg", path="/p2.jpg", url="local:///p2.jpg", width=800, height=600, aspect_ratio=1.33)
    db_session.add_all([p1, p2])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create album
        res = await client.post("/api/v1/albums/", json={"name": "Paris Trip"})
        assert res.status_code == 200
        album = res.json()
        album_id = album["id"]
        assert album["name"] == "Paris Trip"
        assert album["type"] == "custom"

        # 2. Add photos
        res = await client.post(f"/api/v1/albums/{album_id}/add-photos", json={"photo_ids": [p1.id, p2.id]})
        assert res.status_code == 200
        album = res.json()
        assert album["photo_count"] == 2
        assert album["cover_url"] is not None

        # 3. List photos
        res = await client.get(f"/api/v1/albums/{album_id}/photos")
        assert res.status_code == 200
        photos = res.json()
        assert len(photos) == 2

        # 4. Remove photo
        res = await client.post(f"/api/v1/albums/{album_id}/remove-photos", json={"photo_ids": [p1.id]})
        assert res.status_code == 200
        album = res.json()
        assert album["photo_count"] == 1

        # 5. Rename album
        res = await client.post(f"/api/v1/albums/{album_id}/rename", json={"name": "Paris Vacation"})
        assert res.status_code == 200
        album = res.json()
        assert album["name"] == "Paris Vacation"

        # 6. Delete album
        res = await client.delete(f"/api/v1/albums/{album_id}")
        assert res.status_code == 200
        
        # Verify album is deleted but photos remain
        db_album = await db_session.get(Album, album_id)
        assert db_album is None
        db_p1 = await db_session.get(Photo, p1.id)
        assert db_p1 is not None
