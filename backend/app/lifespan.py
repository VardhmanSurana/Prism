import asyncio
import contextlib
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select as sa_select, and_ as sa_and, text

from app.config import settings
from app.db import engine, init_db, async_session
from app.models import Base, Photo
from app.services.ai_orchestrator import AIOrchestrator
from app.services.lan_sync import lan_sync_service
from app.services.sync_service import sync_service
from app.services.locked_service import locked_service

logger = logging.getLogger(__name__)


async def lifespan(app):
    logger.info("Main app starting up...")
    try:
        AIOrchestrator.stop_server()
    except Exception as e:
        logger.warning(f"Failed to clean up orphaned llama-server processes: {e}")

    await init_db()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        res = await conn.execute(text("PRAGMA table_info(photos)"))
        columns = [row[1] for row in res.fetchall()]
        if "blur_score" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN blur_score FLOAT"))
        if "file_size" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN file_size INTEGER"))
        if "auto_tags" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN auto_tags TEXT"))
        if "embedding" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN embedding TEXT"))
        if "event_id" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN event_id INTEGER"))
        if "ocr_text" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN ocr_text TEXT"))
        if "duration" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN duration FLOAT"))
        if "fps" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN fps FLOAT"))
        if "codec" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN codec VARCHAR(50)"))
        if "audio_codec" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN audio_codec VARCHAR(50)"))
        if "rotation" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN rotation INTEGER DEFAULT 0"))
        if "video_faces_scanned" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN video_faces_scanned BOOLEAN DEFAULT 0"))
        if "animated_url" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN animated_url VARCHAR(512)"))
        if "phash" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN phash VARCHAR(64)"))
        if "content_type" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN content_type VARCHAR(20) DEFAULT 'photo'"))
        if "exif_make" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN exif_make VARCHAR(255)"))
        if "exif_model" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN exif_model VARCHAR(255)"))
        if "exif_focal_length" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN exif_focal_length FLOAT"))
        if "exif_iso" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN exif_iso INTEGER"))
        if "adjustments_json" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN adjustments_json TEXT"))

        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS sync_peers (
                id INTEGER PRIMARY KEY,
                peer_id VARCHAR(64) UNIQUE NOT NULL,
                hostname VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                port INTEGER DEFAULT 8269,
                paired BOOLEAN DEFAULT 0,
                paired_at TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                device_type VARCHAR(50)
            )
        """)
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sync_peers_peer_id ON sync_peers (peer_id)"))

        bgjob_cols_res = await conn.execute(text("PRAGMA table_info(background_jobs)"))
        bgjob_columns = [row[1] for row in bgjob_cols_res.fetchall()]
        if "current_stage" not in bgjob_columns:
            await conn.execute(text("ALTER TABLE background_jobs ADD COLUMN current_stage VARCHAR(50)"))
        if "stage_progress" not in bgjob_columns:
            await conn.execute(text("ALTER TABLE background_jobs ADD COLUMN stage_progress TEXT"))

        album_cols_res = await conn.execute(text("PRAGMA table_info(albums)"))
        album_columns = [row[1] for row in album_cols_res.fetchall()]
        if "is_smart" not in album_columns:
            await conn.execute(text("ALTER TABLE albums ADD COLUMN is_smart BOOLEAN DEFAULT 0"))
        if "smart_type" not in album_columns:
            await conn.execute(text("ALTER TABLE albums ADD COLUMN smart_type VARCHAR(20)"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_content_type ON photos (content_type)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_blur_score ON photos (blur_score)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos (event_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_video_faces_scanned ON photos (video_faces_scanned)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_phash ON photos (phash)"))

        try:
            vproj_cols = await conn.execute(text("PRAGMA table_info(video_projects)"))
            vproj_columns = [row[1] for row in vproj_cols.fetchall()]
            if vproj_columns and "project_json" not in vproj_columns:
                await conn.execute(text("ALTER TABLE video_projects ADD COLUMN project_json TEXT"))
        except Exception:
            pass

        try:
            vclip_cols = await conn.execute(text("PRAGMA table_info(video_clips)"))
            vclip_columns = [row[1] for row in vclip_cols.fetchall()]
            if vclip_columns and "proxy_status" not in vclip_columns:
                await conn.execute(text("ALTER TABLE video_clips ADD COLUMN proxy_status VARCHAR(20) DEFAULT 'pending'"))
            if vclip_columns and "audio_waveform_json" not in vclip_columns:
                await conn.execute(text("ALTER TABLE video_clips ADD COLUMN audio_waveform_json TEXT"))
        except Exception:
            pass

        await conn.execute(
            text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename,
                caption,
                location,
                city,
                country,
                ai_summary,
                auto_tags,
                ocr_text
            )
        """)
        )

        res_fts_info = await conn.execute(text("PRAGMA table_info(photos_fts)"))
        fts_columns = [row[1] for row in res_fts_info.fetchall()]
        if "ocr_text" not in fts_columns:
            logger.info("Migrating photos_fts to include ocr_text column...")
            await conn.execute(text("DROP TABLE IF EXISTS photos_fts"))
            await conn.execute(
                text("""
                CREATE VIRTUAL TABLE photos_fts USING fts5(
                    photo_id UNINDEXED,
                    filename, caption, location, city, country,
                    ai_summary, auto_tags, ocr_text
                )
            """)
            )
            await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_insert"))
            await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_delete"))
            await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_update"))
            await conn.execute(
                text("""
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text)
                SELECT id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text FROM photos
            """)
            )
            logger.info("FTS5 table migrated with ocr_text column.")

        await conn.execute(
            text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_insert AFTER INSERT ON photos
            BEGIN
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text)
                VALUES (new.id, new.filename, new.caption, new.location, new.city, new.country, new.ai_summary, new.auto_tags, new.ocr_text);
            END;
        """)
        )

        await conn.execute(
            text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_delete AFTER DELETE ON photos
            BEGIN
                DELETE FROM photos_fts WHERE photo_id = old.id;
            END;
        """)
        )

        await conn.execute(
            text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_update AFTER UPDATE ON photos
            BEGIN
                UPDATE photos_fts SET
                    filename = new.filename,
                    caption = new.caption,
                    location = new.location,
                    city = new.city,
                    country = new.country,
                    ai_summary = new.ai_summary,
                    auto_tags = new.auto_tags,
                    ocr_text = new.ocr_text
                WHERE photo_id = old.id;
            END;
        """)
        )

        res_fts = await conn.execute(text("SELECT COUNT(*) FROM photos_fts"))
        if res_fts.scalar() == 0:
            logger.info("FTS5 table is empty. Populating from existing photos table...")
            await conn.execute(
                text("""
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text)
                SELECT id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text FROM photos
            """)
            )

    try:
        async with async_session() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            stmt = sa_select(Photo).where(sa_and(Photo.is_trash == True, Photo.upload_date < cutoff))
            result = await db.execute(stmt)
            old_trash = result.scalars().all()
            deleted = 0
            for photo in old_trash:
                try:
                    if photo.path and os.path.exists(photo.path):
                        os.remove(photo.path)
                except Exception:
                    pass
                await db.delete(photo)
                deleted += 1
            if deleted > 0:
                await db.commit()
                logger.info(f"Auto-purged {deleted} trashed photos older than 30 days.")
    except Exception as e:
        logger.error(f"Failed to auto-purge trash: {e}")

    try:
        await lan_sync_service.start()
    except Exception as e:
        logger.warning(f"LAN sync service failed to start: {e}")

    await sync_service.initialize()

    # Start background processing queue to recover pending jobs from restart
    try:
        from app.services.processing_queue import processing_queue
        processing_queue.start()
        import asyncio
        asyncio.create_task(processing_queue.enqueue_unfinished_jobs())
        logger.info("Background processing queue worker auto-started on startup.")
    except Exception as e:
        logger.error(f"Failed to start background processing queue: {e}")

    try:
        locked_service.recover_interrupted_files()
    except Exception as e:
        logger.error(f"Failed to recover interrupted files: {e}")

    logger.info(f"Prism Backend ready (PID: {os.getpid()})")

    yield

    try:
        await lan_sync_service.stop()
    except Exception:
        pass
    await sync_service.shutdown()
    try:
        from app.services.processing_queue import processing_queue

        await processing_queue.shutdown()
    except Exception:
        pass
    try:
        from app.services import face_service

        face_service.shutdown()
    except Exception:
        pass

    try:
        AIOrchestrator.stop_server()
    except Exception as e:
        logger.warning(f"Failed to clean up llama-server processes on shutdown: {e}")
