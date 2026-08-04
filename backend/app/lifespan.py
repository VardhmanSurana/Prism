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

        # Apply additive schema patches (columns, indexes, FTS5, triggers)
        from app.schema_migrations import apply_schema
        await apply_schema(conn)


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
