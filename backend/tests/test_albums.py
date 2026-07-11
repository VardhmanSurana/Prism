import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import Photo, Album, PhotoAlbum
from sqlalchemy import select
from unittest.mock import patch

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


@pytest.mark.asyncio
async def test_location_smart_albums_and_photos(db_session):
    db_session.add_all([
        Photo(
            filename="paris-1.jpg",
            path="/paris-1.jpg",
            url="local:///paris-1.jpg",
            width=1200,
            height=800,
            aspect_ratio=1.5,
            city="Paris",
            state="Ile-de-France",
            country="FR",
            latitude=48.8566,
            longitude=2.3522,
        ),
        Photo(
            filename="paris-2.jpg",
            path="/paris-2.jpg",
            url="local:///paris-2.jpg",
            width=1200,
            height=800,
            aspect_ratio=1.5,
            city="Paris",
            state="Ile-de-France",
            country="FR",
            latitude=48.857,
            longitude=2.351,
        ),
    ])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/albums/smart")
        assert res.status_code == 200
        smart_albums = res.json()

        place_album = next((album for album in smart_albums if album["smart_type"] == "places"), None)
        assert place_album is not None
        assert place_album["name"] == "Paris, FR"
        assert place_album["photo_count"] == 2
        assert place_album["metadata"]["city"] == "Paris"

        photos_res = await client.get(
            "/api/v1/albums/smart/photos",
            params={"album_id": place_album["id"]},
        )
        assert photos_res.status_code == 200
        payload = photos_res.json()
        assert payload["total"] == 2
        assert len(payload["photos"]) == 2
        assert all(photo["city"] == "Paris" for photo in payload["photos"])


@pytest.mark.asyncio
async def test_location_smart_albums_backfill_missing_reverse_geocoding(db_session):
    photo = Photo(
        filename="unknown-place.jpg",
        path="/unknown-place.jpg",
        url="local:///unknown-place.jpg",
        width=1000,
        height=750,
        aspect_ratio=1.33,
        latitude=35.6764,
        longitude=139.6500,
    )
    db_session.add(photo)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        with patch("app.api.albums.reverse_geocode_coords", return_value={
            "city": "Tokyo",
            "state": "Tokyo",
            "country": "JP",
        }):
            res = await client.get("/api/v1/albums/smart")

        assert res.status_code == 200
        smart_albums = res.json()
        place_album = next((album for album in smart_albums if album["smart_type"] == "places"), None)
        assert place_album is not None
        assert place_album["metadata"]["city"] == "Tokyo"

    refreshed = await db_session.get(Photo, photo.id)
    assert refreshed is not None
    assert refreshed.city == "Tokyo"
    assert refreshed.country == "JP"


@pytest.mark.asyncio
async def test_update_photo_location_endpoint(db_session):
    photo = Photo(
        filename="map-edit.jpg",
        path="/map-edit.jpg",
        url="local:///map-edit.jpg",
        width=1200,
        height=800,
        aspect_ratio=1.5,
    )
    db_session.add(photo)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        with patch("app.api.photos.metadata.reverse_geocode_coords", return_value={
            "city": "Kyoto",
            "state": "Kyoto",
            "country": "JP",
        }), patch("app.api.photos.metadata.export_xmp_to_file", return_value="/map-edit.xmp"):
            res = await client.put(
                f"/api/v1/photos/{photo.id}/location",
                json={"latitude": 35.0116, "longitude": 135.7681},
            )

        assert res.status_code == 200
        payload = res.json()
        assert payload["city"] == "Kyoto"
        assert payload["country"] == "JP"
        assert payload["xmp_exported"] is True

    refreshed = await db_session.get(Photo, photo.id)
    assert refreshed is not None
    assert refreshed.latitude == pytest.approx(35.0116)
    assert refreshed.longitude == pytest.approx(135.7681)
    assert refreshed.location == "Kyoto, Kyoto, JP"
