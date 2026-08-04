import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_get_background_jobs_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/utilities/background-jobs/status")
        assert response.status_code == 200
        data = response.json()
        assert "total_photos" in data
        assert "clip" in data
        assert "gemma" in data
        assert "face" in data
        assert "ocr" in data
        assert "queue" in data
        
        # Verify the structure of the inner fields
        assert "processed" in data["clip"]
        assert "total" in data["clip"]
        assert "progress" in data["clip"]
        assert "is_processing" in data["clip"]
        
        assert "processed" in data["gemma"]
        assert "total" in data["gemma"]
        assert "progress" in data["gemma"]
        assert "is_processing" in data["gemma"]
        
        assert "processed" in data["face"]
        assert "total" in data["face"]
        assert "progress" in data["face"]
        assert "is_processing" in data["face"]

        assert "processed" in data["ocr"]
        assert "total" in data["ocr"]
        assert "progress" in data["ocr"]
        assert "is_processing" in data["ocr"]
        
        assert "pending" in data["queue"]
        assert "processing" in data["queue"]
        assert "failed" in data["queue"]
        assert "completed" in data["queue"]
