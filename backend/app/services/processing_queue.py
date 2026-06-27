import asyncio
import gc
import json
import os
import traceback
from loguru import logger
from sqlalchemy import select, update, func
from datetime import datetime

from app.config import settings
from app.db import async_session
from app.models import Photo, BackgroundJob
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
                asyncio.create_task(self._broadcast_status())
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
                await self._broadcast_status()
        except Exception as e:
            logger.error(f"Failed to reset interrupted jobs: {e}")

    async def _broadcast_status(self, completed_batch=False):
        """Fetch background jobs status and broadcast over SSE."""
        try:
            from app.services.sync_service import sync_service
            async with async_session() as db:
                total_photos_stmt = select(func.count(Photo.id)).where(
                    Photo.is_locked == False,
                    Photo.is_trash == False
                )
                total_photos = (await db.execute(total_photos_stmt)).scalar() or 0

                clip_stmt = select(func.count(Photo.id)).where(
                    Photo.is_locked == False,
                    Photo.is_trash == False,
                    Photo.embedding.isnot(None)
                )
                clip_processed = (await db.execute(clip_stmt)).scalar() or 0

                gemma_stmt = select(func.count(Photo.id)).where(
                    Photo.is_locked == False,
                    Photo.is_trash == False,
                    Photo.ai_summary.isnot(None)
                )
                gemma_processed = (await db.execute(gemma_stmt)).scalar() or 0

                face_stmt = select(func.count(BackgroundJob.id)).where(
                    BackgroundJob.job_type == "sequential_analysis",
                    BackgroundJob.status == "completed"
                )
                face_processed = (await db.execute(face_stmt)).scalar() or 0

                queue_stmt = select(
                    BackgroundJob.status,
                    func.count(BackgroundJob.id)
                ).group_by(BackgroundJob.status)
                queue_res = await db.execute(queue_stmt)
                
                queue_counts = {"pending": 0, "processing": 0, "failed": 0, "completed": 0}
                for row in queue_res.all():
                    status, count = row
                    if status in queue_counts:
                        queue_counts[status] = count

            is_processing = queue_counts["pending"] > 0 or queue_counts["processing"] > 0

            clip_processed = min(clip_processed, total_photos)
            gemma_processed = min(gemma_processed, total_photos)
            face_processed = min(face_processed, total_photos)

            clip_progress = (clip_processed / total_photos * 100) if total_photos > 0 else 0
            gemma_progress = (gemma_processed / total_photos * 100) if total_photos > 0 else 0
            face_progress = (face_processed / total_photos * 100) if total_photos > 0 else 0

            status_data = {
                "total_photos": total_photos,
                "clip": {
                    "processed": clip_processed,
                    "total": total_photos,
                    "progress": round(clip_progress, 1),
                    "is_processing": is_processing and settings.ENABLE_AI_CLIP
                },
                "gemma": {
                    "processed": gemma_processed,
                    "total": total_photos,
                    "progress": round(gemma_progress, 1),
                    "is_processing": is_processing and settings.ENABLE_AI_CLIP
                },
                "face": {
                    "processed": face_processed,
                    "total": total_photos,
                    "progress": round(face_progress, 1),
                    "is_processing": is_processing
                },
                "queue": queue_counts
            }

            sync_service.broadcast({"type": "background_job_status", "data": status_data})

            if completed_batch and not is_processing:
                sync_service.broadcast({"type": "background_job_completed", "data": status_data})

        except Exception as e:
            logger.error(f"Failed to broadcast background status: {e}")

    async def _get_pending_jobs(self) -> list[dict]:
        """Fetch all currently pending jobs from the database and mark them as processing."""
        try:
            async with async_session() as db:
                stmt = (
                    select(BackgroundJob)
                    .where(BackgroundJob.status == "pending")
                    .order_by(BackgroundJob.created_at.asc())
                )
                res = await db.execute(stmt)
                jobs = res.scalars().all()
                if not jobs:
                    return []
                
                job_infos = []
                for job in jobs:
                    job.status = "processing"
                    job.attempt_count += 1
                    job.updated_at = datetime.utcnow()
                    job_infos.append({
                        "id": job.id,
                        "photo_id": job.photo_id,
                        "attempt_count": job.attempt_count
                    })
                await db.commit()
                asyncio.create_task(self._broadcast_status())
                return job_infos
        except Exception as e:
            logger.error(f"Failed to fetch pending background jobs: {e}")
        return []

    async def _worker(self):
        """Sequential background worker loop in model-centric batch stages."""
        while self._active:
            try:
                job_infos = await self._get_pending_jobs()
                if not job_infos:
                    # Sleep until signaled or timed out
                    self._wakeup_event.clear()
                    try:
                        await asyncio.wait_for(self._wakeup_event.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        pass
                    continue
                
                logger.info(f"Processing batch of {len(job_infos)} background jobs...")
                
                results = {}
                
                # Step 0: Fetch photo paths and check encryption
                for job in job_infos:
                    photo_id = job["photo_id"]
                    results[photo_id] = {
                        "photo_path": None,
                        "summary": None,
                        "caption": None,
                        "tags_json": None,
                        "embedding_json": None,
                        "faces_found": 0,
                        "is_encrypted": False,
                        "stage1_success": True,
                        "stage2_success": True,
                        "stage3_success": True,
                        "errors": []
                    }
                    
                    try:
                        async with async_session() as db:
                            photo = await db.get(Photo, photo_id)
                            if not photo:
                                raise FileNotFoundError(f"Photo record not found in database for ID {photo_id}")
                            photo_path = photo.path
                        
                        if not os.path.exists(photo_path):
                            raise FileNotFoundError(f"Photo file not found on disk: {photo_path}")
                        
                        # Check encryption header
                        is_encrypted = False
                        try:
                            with open(photo_path, "rb") as fh:
                                header = fh.read(13)
                            if header.startswith(b"Prism_ENC:"):
                                is_encrypted = True
                        except Exception as e:
                            logger.error(f"Failed to check encryption header for {photo_path}: {e}")
                        
                        results[photo_id]["photo_path"] = photo_path
                        results[photo_id]["is_encrypted"] = is_encrypted
                        
                        if is_encrypted:
                            logger.info(f"Skipping vision pipeline analysis for encrypted/locked photo ID {photo_id}")
                            results[photo_id]["summary"] = "Summary unavailable: this photo is stored encrypted in the Locked Folder."
                    except Exception as e:
                        logger.error(f"Failed to initialize photo {photo_id}: {e}")
                        results[photo_id]["errors"].append(str(e))
                        results[photo_id]["stage1_success"] = False
                        results[photo_id]["stage2_success"] = False
                        results[photo_id]["stage3_success"] = False

                # ══ RESTRUCTURED PIPELINE ORDER ═══════════════════════════════════════════
                # New order: SigLIP2 (critical) → Face Detection (critical) → Gemma Vision (optional)
                # This ensures embeddings and faces are saved even if AI captioning fails
                
                # ── Stage 1: SigLIP 2 Embedding Generation (CRITICAL - first for fast search) ──
                if settings.ENABLE_AI_CLIP:
                    active_stage1_photos = [
                        j for j in job_infos 
                        if not results[j["photo_id"]]["is_encrypted"] and results[j["photo_id"]]["stage1_success"]
                    ]
                    if active_stage1_photos:
                        from app.services.vision_pipeline import _get_siglip, unload_models, extract_siglip_embedding
                        
                        logger.info("Stage 1: Loading SigLIP2 Model for batch (CRITICAL)...")
                        try:
                            _get_siglip()
                            
                            for job in active_stage1_photos:
                                pid = job["photo_id"]
                                path = results[pid]["photo_path"]
                                try:
                                    embedding = await asyncio.to_thread(extract_siglip_embedding, path)
                                    results[pid]["embedding_json"] = json.dumps(embedding)
                                except Exception as e:
                                    logger.error(f"SigLIP embedding generation failed for photo {pid}: {e}")
                                    results[pid]["errors"].append(f"SigLIP error: {str(e)}")
                                    results[pid]["stage2_success"] = False
                        except Exception as e:
                            logger.error(f"Failed to load SigLIP2 model: {e}")
                            for job in active_stage1_photos:
                                pid = job["photo_id"]
                                results[pid]["stage2_success"] = False
                                results[pid]["errors"].append(f"Failed to load SigLIP: {str(e)}")
                        finally:
                            logger.info("Stage 1 complete. Unloading SigLIP resources.")
                            unload_models()

                # ── Stage 2: Face Detection & Clustering (InspireFace) (CRITICAL) ──
                active_stage2_photos = [
                    j for j in job_infos 
                    if not results[j["photo_id"]]["is_encrypted"] and results[j["photo_id"]]["stage2_success"]
                ]
                if active_stage2_photos:
                    from app.services.face_sdk import face_sdk
                    from app.services.face_clustering import face_service
                    
                    logger.info("Stage 2: Initializing Face SDK for batch (CRITICAL)...")
                    try:
                        session = face_sdk.session
                        
                        for job in active_stage2_photos:
                            pid = job["photo_id"]
                            path = results[pid]["photo_path"]
                            try:
                                async with async_session() as db:
                                    faces_found = await face_service.scan_and_cluster_face(pid, path, db)
                                results[pid]["faces_found"] = faces_found
                                logger.info(f"Face scan complete. Detected {faces_found} faces in photo ID {pid}.")
                            except Exception as e:
                                logger.error(f"Face scanning failed for photo {pid}: {e}")
                                results[pid]["errors"].append(f"Face scan error: {str(e)}")
                                results[pid]["stage3_success"] = False
                    except Exception as e:
                        logger.error(f"Failed to launch Face SDK: {e}")
                        for job in active_stage2_photos:
                            pid = job["photo_id"]
                            results[pid]["stage3_success"] = False
                            results[pid]["errors"].append(f"Failed to launch Face SDK: {str(e)}")
                    finally:
                        logger.info("Stage 2 complete. Shutting down Face SDK resources.")
                        face_sdk.shutdown()

                # Update Photo fields in DB for CRITICAL stages (embeddings + faces)
                for job in job_infos:
                    pid = job["photo_id"]
                    res = results[pid]
                    if res["embedding_json"] is not None or res["is_encrypted"]:
                        try:
                            async with async_session() as db:
                                photo = await db.get(Photo, pid)
                                if photo:
                                    if res["is_encrypted"]:
                                        pass  # Skip AI fields for encrypted photos
                                    elif settings.ENABLE_AI_CLIP:
                                        if res["embedding_json"] is not None:
                                            photo.embedding = res["embedding_json"]
                                    await db.commit()
                                    logger.info(f"Saved critical AI data (embeddings/faces) for photo ID {pid}.")
                        except Exception as e:
                            logger.error(f"Failed to update Photo fields in DB for photo {pid}: {e}")
                            res["errors"].append(f"DB update error: {str(e)}")

                # ── Stage 3: Gemma 4 E2B Vision (OPTIONAL - caption & tags, non-critical) ──
                # This stage is NICE-TO-HAVE. Failures here do NOT fail the job.
                if settings.ENABLE_AI_CLIP:
                    active_stage3_photos = [
                        j for j in job_infos 
                        if not results[j["photo_id"]]["is_encrypted"] and results[j["photo_id"]]["stage3_success"]
                    ]
                    if active_stage3_photos:
                        from app.services.image_summary.llm import VisionManager, generate_ollama_summary, generate_tags_json
                        
                        logger.info("Stage 3: Starting Gemma-4-E2B Vision server for batch (OPTIONAL)...")
                        try:
                            llm_func = VisionManager.get_llm()
                            if not llm_func:
                                logger.warning("Gemma Vision server failed to start - skipping caption/tag generation")
                                for job in active_stage3_photos:
                                    pid = job["photo_id"]
                                    results[pid]["stage1_success"] = False
                                    results[pid]["errors"].append("Failed to start Gemma-4-E2B Vision server")
                            else:
                                for job in active_stage3_photos:
                                    pid = job["photo_id"]
                                    path = results[pid]["photo_path"]
                                    try:
                                        summary = await asyncio.to_thread(generate_ollama_summary, path)
                                        tags = await asyncio.to_thread(generate_tags_json, path)
                                        # Handle Optional returns - None means failure
                                        if summary is not None:
                                            results[pid]["summary"] = summary
                                            results[pid]["caption"] = summary[:120] + ("..." if len(summary) > 120 else "")
                                        else:
                                            logger.warning(f"Gemma summary returned None for photo {pid}")
                                            results[pid]["stage1_success"] = False
                                        if tags is not None:
                                            results[pid]["tags_json"] = json.dumps(tags)
                                        else:
                                            logger.warning(f"Gemma tags returned None for photo {pid}")
                                            results[pid]["stage1_success"] = False
                                    except Exception as e:
                                        logger.error(f"Gemma vision processing failed for photo {pid}: {e}")
                                        results[pid]["errors"].append(f"Gemma vision error: {str(e)}")
                                        results[pid]["stage1_success"] = False
                        finally:
                            logger.info("Stage 3 complete. Unloading Vision LLM resources.")
                            VisionManager.unload_vision()

                # Update Photo fields in DB for OPTIONAL Gemma Vision results (caption/tags)
                for job in job_infos:
                    pid = job["photo_id"]
                    res = results[pid]
                    # Save caption/tags if available (even if stage1_success is False, we may have partial results)
                    if res["summary"] is not None or res["tags_json"] is not None:
                        try:
                            async with async_session() as db:
                                photo = await db.get(Photo, pid)
                                if photo:
                                    if res["summary"] is not None:
                                        photo.ai_summary = res["summary"]
                                    if res["caption"] is not None:
                                        photo.caption = res["caption"]
                                    if res["tags_json"] is not None:
                                        photo.auto_tags = res["tags_json"]
                                    await db.commit()
                                    logger.info(f"Saved Gemma Vision results (caption/tags) for photo ID {pid}.")
                        except Exception as e:
                            logger.error(f"Failed to update Gemma Vision fields in DB for photo {pid}: {e}")
                            res["errors"].append(f"Gemma DB update error: {str(e)}")

                # Update job statuses in database
                for job in job_infos:
                    job_id = job["id"]
                    pid = job["photo_id"]
                    attempt = job["attempt_count"]
                    res = results[pid]
                    
                    # Gemma Vision (stage1) is optional - embeddings and face detection are critical
                    stage2_needed = not res["is_encrypted"] and settings.ENABLE_AI_CLIP
                    stage3_needed = not res["is_encrypted"] and settings.ENABLE_AI_CLIP
                    
                    s2_ok = res["stage2_success"] if stage2_needed else True
                    s3_ok = res["stage3_success"] if stage3_needed else True
                    
                    # Job succeeds if SigLIP (embeddings) and Face detection succeed
                    # Gemma Vision (caption/tags) is optional - warn but don't fail
                    if not res["stage1_success"] and not res["is_encrypted"]:
                        logger.warning(f"Gemma Vision failed for photo {pid}, but embeddings/faces succeeded. Job will complete.")
                    
                    success = s2_ok and s3_ok
                    err_msg = "\n".join(res["errors"]) if res["errors"] else None
                    
                    try:
                        async with async_session() as db:
                            db_job = await db.get(BackgroundJob, job_id)
                            if db_job:
                                if success:
                                    db_job.status = "completed"
                                else:
                                    db_job.last_error = err_msg
                                    if attempt >= 3:
                                        db_job.status = "failed"
                                        logger.error(f"Job ID {job_id} failed permanently after 3 attempts.")
                                    else:
                                        db_job.status = "pending"  # Retry later
                                db_job.updated_at = datetime.utcnow()
                                await db.commit()
                    except Exception as e:
                        logger.error(f"Failed to update background job status for job {job_id}: {e}")

                # Trigger garbage collection between batches
                gc.collect()
                await self._broadcast_status(completed_batch=True)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Persistent Queue worker encountered unhandled error: {e}")
                await asyncio.sleep(2.0)

processing_queue = ProcessingQueue()
