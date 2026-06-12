import asyncio
import gc
import json
from loguru import logger
from sqlalchemy import select

from app.db import async_session
from app.models import Photo
from app.services import face_service
from app.services.vision_pipeline import extract_features_and_tags

class ProcessingQueue:
    def __init__(self):
        self._queue = asyncio.Queue()
        self._worker_task = None
        self._active = False

    def start(self):
        """Start the background sequential worker task."""
        if not self._active:
            self._active = True
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("Sequential background processing queue worker started.")

    async def shutdown(self):
        """Gracefully stop the background worker task."""
        self._active = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("Sequential background processing queue worker stopped.")

    def enqueue(self, photo_id: int, photo_path: str):
        """Enqueue a photo for sequential background summary and face scanning."""
        self.start()  # Lazy start if worker is not yet running
        self._queue.put_nowait((photo_id, photo_path))
        logger.info(f"Enqueued photo ID {photo_id} for sequential analysis.")

    async def _worker(self):
        """Sequential background worker loop."""
        while self._active:
            try:
                photo_id, photo_path = await self._queue.get()
                
                logger.info(f"Starting sequential analysis for photo ID {photo_id}...")
                
                # --- Phase 1: AI Summary, Tag & Embedding Generation ---
                try:
                    # Guard against encrypted locked files (Prism_ENC header)
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
                    else:
                        # Run GPU/CPU heavy model inference in a thread to keep async loop free
                        res = await asyncio.to_thread(extract_features_and_tags, photo_path)
                        
                        summary = res.get("detailed_caption")
                        caption = res.get("caption")
                        tags_json = json.dumps(res.get("tags", []))
                        embedding_json = json.dumps(res.get("embedding", []))

                    # Update Photo fields in DB
                    async with async_session() as db:
                        stmt = select(Photo).where(Photo.id == photo_id)
                        res = await db.execute(stmt)
                        photo = res.scalar_one_or_none()
                        if photo:
                            photo.ai_summary = summary
                            if not is_encrypted:
                                photo.caption = caption
                                photo.auto_tags = tags_json
                                photo.embedding = embedding_json
                            await db.commit()
                            logger.info(f"Saved vision pipeline analysis for photo ID {photo_id}.")
                except Exception as e:
                    logger.error(f"Failed to run vision pipeline for photo ID {photo_id}: {e}")

                # Trigger garbage collection between memory-heavy tasks
                gc.collect()

                # --- Phase 2: Face Detection & Clustering ---
                try:
                    async with async_session() as db:
                        faces_found = await face_service.scan_and_cluster_face(photo_id, photo_path, db)
                        logger.info(f"Face scan complete. Detected {faces_found} faces in photo ID {photo_id}.")
                except Exception as e:
                    logger.error(f"Failed to run face clustering for photo ID {photo_id}: {e}")

                # Mark queue item as done
                self._queue.task_done()
                
                # Explicit cleanup and garbage collection
                gc.collect()
                logger.info(f"Successfully processed photo ID {photo_id}. Memory cleared.")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Queue worker encountered error: {e}")
                await asyncio.sleep(1.0) # Avoid infinite rapid-loop on global failures

processing_queue = ProcessingQueue()
