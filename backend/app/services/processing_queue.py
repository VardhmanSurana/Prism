import asyncio
import gc
import json
import traceback
from loguru import logger
from sqlalchemy import select, update
from datetime import datetime

from app.config import settings
from app.db import async_session
from app.models import Photo, BackgroundJob
from app.services import face_service
from app.services.vision_pipeline import extract_features_and_tags


class ProcessingQueue:
    def __init__(self):
        self._worker_task = None
        self._active = False
        self._wakeup_event = asyncio.Event()

    def start(self):
        """Start the background sequential worker task."""
        if not self._active:
            self._active = True
            self._worker_task = asyncio.create_task(self._worker())
            # Mark any interrupted "processing" jobs as "pending" on startup
            asyncio.create_task(self._reset_interrupted_jobs())
            logger.info("Persistent DB background processing queue worker started.")

    async def shutdown(self):
        """Gracefully stop the background worker task."""
        self._active = False
        self._wakeup_event.set()
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("Persistent DB background processing queue worker stopped.")

    def enqueue(self, photo_id: int, photo_path: str):
        """Enqueue a photo for sequential background summary and face scanning in DB."""
        self.start()  # Lazy start if worker is not yet running
        
        async def _async_enqueue():
            try:
                async with async_session() as db:
                    # Check if a pending or processing job already exists for this photo
                    stmt = select(BackgroundJob).where(
                        BackgroundJob.photo_id == photo_id,
                        BackgroundJob.job_type == "sequential_analysis",
                        BackgroundJob.status.in_(["pending", "processing"])
                    )
                    res = await db.execute(stmt)
                    if res.scalar_one_or_none():
                        logger.info(f"Job already exists for photo ID {photo_id}. Skipping duplicate enqueue.")
                        return

                    new_job = BackgroundJob(
                        photo_id=photo_id,
                        job_type="sequential_analysis",
                        status="pending"
                    )
                    db.add(new_job)
                    await db.commit()
                
                logger.info(f"Enqueued photo ID {photo_id} in database background jobs.")
                self._wakeup_event.set()
            except Exception as e:
                logger.error(f"Failed to enqueue background job in database: {e}")

        asyncio.create_task(_async_enqueue())

    async def _reset_interrupted_jobs(self):
        """Resets jobs stuck in 'processing' status back to 'pending' on startup."""
        try:
            async with async_session() as db:
                stmt = (
                    update(BackgroundJob)
                    .where(BackgroundJob.status == "processing")
                    .values(status="pending", last_error="Interrupted by application restart")
                )
                await db.execute(stmt)
                await db.commit()
                logger.info("Reset interrupted processing jobs to pending.")
                self._wakeup_event.set()
        except Exception as e:
            logger.error(f"Failed to reset interrupted jobs: {e}")

    async def _get_next_job(self) -> BackgroundJob | None:
        """Fetch the next pending job from the database."""
        try:
            async with async_session() as db:
                stmt = (
                    select(BackgroundJob)
                    .where(BackgroundJob.status == "pending")
                    .order_by(BackgroundJob.created_at.asc())
                    .limit(1)
                )
                res = await db.execute(stmt)
                job = res.scalar_one_or_none()
                if job:
                    # Mark as processing
                    job.status = "processing"
                    job.attempt_count += 1
                    job.updated_at = datetime.utcnow()
                    await db.commit()
                    # Return a detached copy of the ID and details to process outside session
                    return {
                        "id": job.id,
                        "photo_id": job.photo_id,
                        "attempt_count": job.attempt_count
                    }
        except Exception as e:
            logger.error(f"Failed to fetch next background job: {e}")
        return None

    async def _worker(self):
        """Sequential background worker loop."""
        while self._active:
            try:
                job_info = await self._get_next_job()
                if not job_info:
                    # Sleep until signaled or timed out
                    self._wakeup_event.clear()
                    try:
                        await asyncio.wait_for(self._wakeup_event.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        pass
                    continue
                
                job_id = job_info["id"]
                photo_id = job_info["photo_id"]
                attempt = job_info["attempt_count"]

                logger.info(f"Processing background job ID {job_id} (Photo ID {photo_id}, Attempt {attempt})...")
                
                success = False
                err_msg = None

                try:
                    # Fetch Photo details
                    async with async_session() as db:
                        photo = await db.get(Photo, photo_id)
                        if not photo:
                            raise FileNotFoundError(f"Photo record not found in database for ID {photo_id}")
                        photo_path = photo.path

                    # Check encryption header
                    is_encrypted = False
                    try:
                        with open(photo_path, "rb") as fh:
                            header = fh.read(13)
                        if header.startswith(b"Prism_ENC:"):
                            is_encrypted = True
                    except Exception as e:
                        logger.error(f"Failed to check encryption header for {photo_path}: {e}")

                    if is_encrypted:
                        logger.info(f"Skipping vision pipeline analysis for encrypted/locked photo ID {photo_id}")
                        summary = "Summary unavailable: this photo is stored encrypted in the Locked Folder."
                        caption = None
                        tags_json = None
                        embedding_json = None
                    elif not settings.ENABLE_AI_CLIP:
                        logger.info(f"Skipping vision pipeline analysis for photo ID {photo_id}: AI CLIP is disabled.")
                        summary = None
                        caption = None
                        tags_json = None
                        embedding_json = None
                    else:
                        # Process ML tasks in a thread pool
                        res = await asyncio.to_thread(extract_features_and_tags, photo_path)
                        summary = res.get("detailed_caption")
                        caption = res.get("caption")
                        tags_json = json.dumps(res.get("tags", []))
                        embedding_json = json.dumps(res.get("embedding", []))

                    # Update Photo fields in DB
                    async with async_session() as db:
                        photo = await db.get(Photo, photo_id)
                        if photo:
                            if summary is not None:
                                photo.ai_summary = summary
                            if not is_encrypted and settings.ENABLE_AI_CLIP:
                                photo.caption = caption
                                photo.auto_tags = tags_json
                                photo.embedding = embedding_json
                            await db.commit()
                            logger.info(f"Saved vision pipeline analysis for photo ID {photo_id}.")
                    
                    # Run Face Detection & Clustering
                    async with async_session() as db:
                        faces_found = await face_service.scan_and_cluster_face(photo_id, photo_path, db)
                        logger.info(f"Face scan complete. Detected {faces_found} faces in photo ID {photo_id}.")
                    
                    success = True
                except Exception as ex:
                    err_msg = f"{str(ex)}\n{traceback.format_exc()}"
                    logger.error(f"Failed to process job ID {job_id}: {ex}")

                # Update job status in database
                async with async_session() as db:
                    job = await db.get(BackgroundJob, job_id)
                    if job:
                        if success:
                            job.status = "completed"
                        else:
                            job.last_error = err_msg
                            if attempt >= 3:
                                job.status = "failed"
                                logger.error(f"Job ID {job_id} failed permanently after 3 attempts.")
                            else:
                                job.status = "pending"  # Retry later
                        job.updated_at = datetime.utcnow()
                        await db.commit()

                # Trigger garbage collection between memory-heavy tasks
                gc.collect()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Persistent Queue worker encountered unhandled error: {e}")
                await asyncio.sleep(2.0)

processing_queue = ProcessingQueue()
