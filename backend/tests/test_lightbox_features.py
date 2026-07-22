import pytest
import cv2
import numpy as np
import os
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models import Base, Photo, Person, PhotoPerson
from app.api.photos.metadata import update_photo_metadata, get_photo_faces, tag_photo_face, PhotoMetadataUpdateRequest, FaceTagRequest
from app.api.photos.export import export_photo_preset, ExportPresetRequest


@pytest.mark.asyncio
async def test_lightbox_features_and_endpoints(tmp_path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create dummy image file for export test
    img_path = os.path.join(tmp_path, "sample_photo.jpg")
    img = np.zeros((1000, 1500, 3), dtype=np.uint8)
    cv2.imwrite(img_path, img)

    async with async_session() as db:
        photo = Photo(
            filename="sample_photo.jpg",
            path=img_path,
            width=1500,
            height=1000,
            aspect_ratio=1.5,
            city="Old City",
            country="India",
        )
        db.add(photo)
        await db.commit()
        await db.refresh(photo)

        # 1. Manual Metadata Update
        payload = PhotoMetadataUpdateRequest(
            date_taken="2025-06-15T14:30:00Z",
            caption="Sunset at the beach",
            city="Panaji",
            state="Goa",
            country="India",
            exif_make="Fujifilm",
            exif_model="X-T4",
            exif_focal_length=23.0,
            exif_iso=160,
        )
        res_meta = await update_photo_metadata(photo.id, payload, db)
        assert res_meta["caption"] == "Sunset at the beach"
        assert res_meta["city"] == "Panaji"
        assert res_meta["exif_make"] == "Fujifilm"

        # 2. Tag Face
        tag_payload = FaceTagRequest(
            person_name="John Doe",
            face_box='{"x":0.2,"y":0.2,"w":0.3,"h":0.3}'
        )
        res_tag = await tag_photo_face(photo.id, tag_payload, db)
        assert res_tag["status"] == "success"
        assert res_tag["person_name"] == "John Doe"

        # 3. Query Faces
        res_faces = await get_photo_faces(photo.id, db)
        assert len(res_faces["faces"]) == 1
        assert res_faces["faces"][0]["person_name"] == "John Doe"

        # 4. Quick Export Preset
        exp_payload = ExportPresetRequest(preset="instagram_1_1")
        res_exp = await export_photo_preset(photo.id, exp_payload, db)
        assert res_exp.status_code == 200
        assert res_exp.media_type == "image/jpeg"

    await engine.dispose()
