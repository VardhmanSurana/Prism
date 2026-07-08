import asyncio
import datetime
import gc
import json
import os
import time
import traceback
from loguru import logger
from sqlalchemy import select, update, func

from app.config import settings
from app.db import async_session
from app.models import Photo, BackgroundJob, PhotoPerson
from app.services.vision_pipeline import extract_features_and_tags


class AdaptiveThrottler:
    def __init__(self):
        self._paused = False
        self._check_interval = 30
        self._last_check = 0.0
        self._active_video_operations = 0

    def increment_video_ops(self):
        self._active_video_operations += 1
        self._paused = True
        logger.info(f"Background queue throttler paused due to active video processing (active ops: {self._active_video_operations})")

    def decrement_video_ops(self):
        self._active_video_operations = max(0, self._active_video_operations - 1)
        if self._active_video_operations == 0:
            self._last_check = 0.0
            self._paused = False
            logger.info("Background queue throttler released: no active video operations")

    def should_pause(self) -> bool:
        if self._active_video_operations > 0:
            return True

        now = time.time()
        if now - self._last_check < self._check_interval:
            return self._paused
        self._last_check = now

        try:
            import psutil
            battery = psutil.sensors_battery()
            if battery and not battery.power_plugged and battery.percent < settings.JOB_QUEUE_THROTTLE_BATTERY_THRESHOLD:
                logger.info(f"Throttling: battery low ({battery.percent}%)")
                self._paused = True
                return True

            cpu_percent = psutil.cpu_percent(interval=1)
            if cpu_percent > settings.JOB_QUEUE_THROTTLE_CPU_THRESHOLD:
                logger.info(f"Throttling: CPU high ({cpu_percent}%)")
                self._paused = True
                return True

            if self._paused:
                if battery and battery.power_plugged:
                    logger.info("Throttling released: plugged in")
                    self._paused = False
                elif cpu_percent < 60:
                    logger.info(f"Throttling released: CPU normal ({cpu_percent}%)")
                    self._paused = False

            return self._paused
        except Exception:
            return False

    async def wait_if_paused(self):
        while self.should_pause():
            await asyncio.sleep(5)


STAGE_ORDER = ["siglip", "face", "vision", "ocr"]


class ProcessingQueue:
    def __init__(self):
        self._worker_task = None
        self._active = False
        self._wakeup_event = asyncio.Event()
        self._throttler = AdaptiveThrottler()

    def start(self):
        if not self._active:
            self._active = True
            self._worker_task = asyncio.create_task(self._worker())
            asyncio.create_task(self._reset_interrupted_jobs())
            logger.info("Persistent DB background processing queue worker started.")
        elif self._worker_task and self._worker_task.done():
            logger.warning("Worker task died unexpectedly — restarting.")
            self._worker_task = asyncio.create_task(self._worker())

    async def shutdown(self):
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
        self.start()

        async def _async_enqueue():
            try:
                async with async_session() as db:
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

    async def _broadcast_stage_progress(self, stage: str, completed: int, total: int):
        try:
            from app.services.sync_service import sync_service
            sync_service.broadcast({
                "type": "job_stage_progress",
                "data": {
                    "stage": stage,
                    "completed": completed,
                    "total": total,
                }
            })
        except Exception as e:
            logger.error(f"Failed to broadcast stage progress: {e}")

    async def _broadcast_status(self, completed_batch=False):
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

                ocr_stmt = select(func.count(Photo.id)).where(
                    Photo.is_locked == False,
                    Photo.is_trash == False,
                    Photo.ocr_text.isnot(None)
                )
                ocr_processed = (await db.execute(ocr_stmt)).scalar() or 0

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
            ocr_processed = min(ocr_processed, total_photos)

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
                "ocr": {
                    "processed": ocr_processed,
                    "total": total_photos,
                    "progress": round((ocr_processed / total_photos * 100) if total_photos > 0 else 0, 1),
                    "is_processing": is_processing and settings.ENABLE_AI_OCR
                },
                "queue": queue_counts
            }

            sync_service.broadcast({"type": "background_job_status", "data": status_data})

            if completed_batch and not is_processing:
                sync_service.broadcast({"type": "background_job_completed", "data": status_data})

        except Exception as e:
            logger.error(f"Failed to broadcast background status: {e}")

    async def _get_pending_jobs(self) -> list[dict]:
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
                    job.updated_at = datetime.datetime.utcnow()
                    job_infos.append({
                        "id": job.id,
                        "photo_id": job.photo_id,
                        "attempt_count": job.attempt_count,
                        "current_stage": job.current_stage,
                    })
                await db.commit()
                asyncio.create_task(self._broadcast_status())
                return job_infos
        except Exception as e:
            logger.error(f"Failed to fetch pending background jobs: {e}")
        return []

    async def _get_resume_stage_index(self, photo) -> int:
        if photo.embedding is not None:
            return 1
        try:
            async with async_session() as db:
                stmt = select(PhotoPerson).where(PhotoPerson.photo_id == photo.id)
                res = await db.execute(stmt)
                if res.scalar_one_or_none() is not None:
                    return 2
        except Exception:
            pass
        if photo.ai_summary is not None:
            return 3
        if photo.ocr_text is not None:
            return 4
        return 0

    async def _update_job_stage(self, job_id: int, stage: str, completed: int, total: int):
        try:
            async with async_session() as db:
                db_job = await db.get(BackgroundJob, job_id)
                if db_job:
                    db_job.current_stage = stage
                    db_job.stage_progress = json.dumps({"total": total, "completed": completed})
                    db_job.updated_at = datetime.datetime.utcnow()
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to update job stage for job {job_id}: {e}")

    async def _worker(self):
        while self._active:
            try:
                await self._throttler.wait_if_paused()

                job_infos = await self._get_pending_jobs()
                if not job_infos:
                    self._wakeup_event.clear()
                    try:
                        await asyncio.wait_for(self._wakeup_event.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        pass
                    continue

                logger.info(f"Processing batch of {len(job_infos)} background jobs...")

                results = {}

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
                        "ocr_text": None,
                        "stage1_success": True,
                        "stage2_success": True,
                        "stage3_success": True,
                        "stage4_success": True,
                        "errors": [],
                        "resume_from": 0,
                    }

                    try:
                        async with async_session() as db:
                            photo = await db.get(Photo, photo_id)
                            if not photo:
                                raise FileNotFoundError(f"Photo record not found in database for ID {photo_id}")
                            photo_path = photo.path
                            results[photo_id]["resume_from"] = await self._get_resume_stage_index(photo)

                        if not os.path.exists(photo_path):
                            try:
                                os.stat(photo_path)
                            except OSError as stat_err:
                                if not isinstance(stat_err, FileNotFoundError):
                                    raise OSError(f"Photo file exists but is unreadable due to system/IO error: {stat_err}")
                            raise FileNotFoundError(f"Photo file not found on disk: {photo_path}")

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
                            results[photo_id]["resume_from"] = 4
                    except Exception as e:
                        logger.error(f"Failed to initialize photo {photo_id}: {e}")
                        results[photo_id]["errors"].append(str(e))
                        results[photo_id]["stage1_success"] = False
                        results[photo_id]["stage2_success"] = False
                        results[photo_id]["stage3_success"] = False
                        results[photo_id]["stage4_success"] = False

                batch_size = len(job_infos)

                # ── Stage 1: SigLIP 2 Embedding Generation (CRITICAL) ──
                if settings.ENABLE_AI_CLIP:
                    active_stage1_photos = [
                        j for j in job_infos
                        if not results[j["photo_id"]]["is_encrypted"]
                        and results[j["photo_id"]]["stage1_success"]
                        and results[j["photo_id"]]["resume_from"] <= 0
                    ]
                    if active_stage1_photos:
                        from app.services.vision_pipeline import _get_siglip, unload_models, extract_siglip_embedding

                        logger.info("Stage 1: Loading SigLIP2 Model for batch (CRITICAL)...")
                        try:
                            _get_siglip()

                            for idx, job in enumerate(active_stage1_photos):
                                pid = job["photo_id"]
                                await self._update_job_stage(job["id"], "siglip", idx, len(active_stage1_photos))
                                await self._broadcast_stage_progress("siglip", idx, len(active_stage1_photos))
                                path = results[pid]["photo_path"]
                                try:
                                    embedding = await asyncio.to_thread(extract_siglip_embedding, path)
                                    results[pid]["embedding_json"] = json.dumps(embedding)
                                except Exception as e:
                                    logger.error(f"SigLIP embedding generation failed for photo {pid}: {e}")
                                    results[pid]["errors"].append(f"SigLIP error: {str(e)}")
                                    results[pid]["stage2_success"] = False
                            await self._broadcast_stage_progress("siglip", len(active_stage1_photos), len(active_stage1_photos))
                        except Exception as e:
                            logger.error(f"Failed to load SigLIP2 model: {e}")
                            for job in active_stage1_photos:
                                pid = job["photo_id"]
                                results[pid]["stage2_success"] = False
                                results[pid]["errors"].append(f"Failed to load SigLIP: {str(e)}")
                        finally:
                            logger.info("Stage 1 complete. Unloading SigLIP resources.")
                            unload_models()
                    else:
                        logger.info("Stage 1: SigLIP skipped - all photos already have embeddings.")

                if self._throttler.should_pause():
                    logger.info("Pausing between stages due to system load")
                    await self._throttler.wait_if_paused()

                # ── Stage 2: Face Detection & Clustering (InspireFace) (CRITICAL) ──
                active_stage2_photos = [
                    j for j in job_infos
                    if not results[j["photo_id"]]["is_encrypted"]
                    and results[j["photo_id"]]["stage2_success"]
                    and results[j["photo_id"]]["resume_from"] <= 1
                ]
                if active_stage2_photos:
                    from app.services.face_sdk import face_sdk
                    from app.services.face_clustering import face_service

                    logger.info("Stage 2: Initializing Face SDK for batch (CRITICAL)...")
                    try:
                        session = face_sdk.session

                        from app.services.sync.handler import is_video_file

                        video_jobs = [j for j in active_stage2_photos if is_video_file(results[j["photo_id"]]["photo_path"])]
                        image_jobs = [j for j in active_stage2_photos if not is_video_file(results[j["photo_id"]]["photo_path"])]

                        for idx, job in enumerate(image_jobs):
                            pid = job["photo_id"]
                            await self._update_job_stage(job["id"], "face", idx, len(image_jobs))
                            await self._broadcast_stage_progress("face", idx, len(image_jobs))
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

                        for idx, job in enumerate(video_jobs):
                            pid = job["photo_id"]
                            await self._update_job_stage(job["id"], "face", idx, len(video_jobs))
                            await self._broadcast_stage_progress("face", idx, len(video_jobs))
                            path = results[pid]["photo_path"]
                            try:
                                async with async_session() as db:
                                    faces_found = await face_service.scan_and_cluster_video_faces(pid, path, db)
                                results[pid]["faces_found"] = faces_found
                                logger.info(f"Video face scan complete. Detected {faces_found} unique faces in video ID {pid}.")
                            except Exception as e:
                                logger.error(f"Video face scanning failed for video {pid}: {e}")
                                results[pid]["errors"].append(f"Video face scan error: {str(e)}")
                                results[pid]["stage3_success"] = False
                        await self._broadcast_stage_progress("face", len(active_stage2_photos), len(active_stage2_photos))
                    except Exception as e:
                        logger.error(f"Failed to launch Face SDK: {e}")
                        for job in active_stage2_photos:
                            pid = job["photo_id"]
                            results[pid]["stage3_success"] = False
                            results[pid]["errors"].append(f"Failed to launch Face SDK: {str(e)}")
                    finally:
                        logger.info("Stage 2 complete. Shutting down Face SDK resources.")
                        face_sdk.shutdown()
                else:
                    logger.info("Stage 2: Face detection skipped - all photos already have face data.")

                for job in job_infos:
                    pid = job["photo_id"]
                    res = results[pid]
                    if res["embedding_json"] is not None or res["is_encrypted"]:
                        try:
                            async with async_session() as db:
                                photo = await db.get(Photo, pid)
                                if photo:
                                    if res["is_encrypted"]:
                                        pass
                                    elif settings.ENABLE_AI_CLIP:
                                        if res["embedding_json"] is not None:
                                            photo.embedding = res["embedding_json"]
                                    await db.commit()
                                    logger.info(f"Saved critical AI data (embeddings/faces) for photo ID {pid}.")
                        except Exception as e:
                            logger.error(f"Failed to update Photo fields in DB for photo {pid}: {e}")
                            res["errors"].append(f"DB update error: {str(e)}")

                if self._throttler.should_pause():
                    logger.info("Pausing between stages due to system load")
                    await self._throttler.wait_if_paused()

                # ── Stage 3: Gemma 4 E2B Vision (OPTIONAL) ──
                if settings.ENABLE_AI_CLIP:
                    from app.services.sync.handler import is_video_file
                    active_stage3_photos = [
                        j for j in job_infos
                        if not results[j["photo_id"]]["is_encrypted"]
                        and results[j["photo_id"]]["stage3_success"]
                        and results[j["photo_id"]]["resume_from"] <= 2
                        and not (results[j["photo_id"]]["photo_path"] and is_video_file(results[j["photo_id"]]["photo_path"]))
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
                                for idx, job in enumerate(active_stage3_photos):
                                    pid = job["photo_id"]
                                    await self._update_job_stage(job["id"], "vision", idx, len(active_stage3_photos))
                                    await self._broadcast_stage_progress("vision", idx, len(active_stage3_photos))
                                    path = results[pid]["photo_path"]
                                    try:
                                        summary = await asyncio.to_thread(generate_ollama_summary, path)
                                        tags = await asyncio.to_thread(generate_tags_json, path)
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
                                await self._broadcast_stage_progress("vision", len(active_stage3_photos), len(active_stage3_photos))
                        finally:
                            logger.info("Stage 3 complete. Unloading Vision LLM resources.")
                            VisionManager.unload_vision()
                    else:
                        logger.info("Stage 3: Gemma Vision skipped - all photos already have summaries.")

                for job in job_infos:
                    pid = job["photo_id"]
                    res = results[pid]
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

                if self._throttler.should_pause():
                    logger.info("Pausing between stages due to system load")
                    await self._throttler.wait_if_paused()

                # ── Stage 4: PaddleOCR-VL Text Extraction (OPTIONAL) ──
                if settings.ENABLE_AI_OCR:
                    from app.services.sync.handler import is_video_file
                    active_stage4_photos = [
                        j for j in job_infos
                        if not results[j["photo_id"]]["is_encrypted"]
                        and results[j["photo_id"]]["stage4_success"]
                        and results[j["photo_id"]]["resume_from"] <= 3
                        and not (results[j["photo_id"]]["photo_path"] and is_video_file(results[j["photo_id"]]["photo_path"]))
                    ]
                    if active_stage4_photos:
                        from app.services.ocr import OCRManager, extract_ocr_text

                        logger.info("Stage 4: Starting PaddleOCR-VL server for batch (OPTIONAL)...")
                        try:
                            ocr_func = OCRManager.get_ocr()
                            if not ocr_func:
                                logger.warning("PaddleOCR server failed to start - skipping OCR extraction")
                                for job in active_stage4_photos:
                                    results[job["photo_id"]]["stage4_success"] = False
                            else:
                                for idx, job in enumerate(active_stage4_photos):
                                    pid = job["photo_id"]
                                    await self._update_job_stage(job["id"], "ocr", idx, len(active_stage4_photos))
                                    await self._broadcast_stage_progress("ocr", idx, len(active_stage4_photos))
                                    path = results[pid]["photo_path"]
                                    try:
                                        text = await asyncio.to_thread(extract_ocr_text, path)
                                        if text:
                                            results[pid]["ocr_text"] = text
                                    except Exception as e:
                                        logger.error(f"OCR extraction failed for photo {pid}: {e}")
                                        results[pid]["errors"].append(f"OCR error: {str(e)}")
                                        results[pid]["stage4_success"] = False
                                await self._broadcast_stage_progress("ocr", len(active_stage4_photos), len(active_stage4_photos))
                        finally:
                            logger.info("Stage 4 complete. Unloading PaddleOCR server.")
                            OCRManager.unload()
                    else:
                        logger.info("Stage 4: OCR skipped - all photos already have OCR text.")

                for job in job_infos:
                    pid = job["photo_id"]
                    res = results[pid]
                    if res["ocr_text"] is not None:
                        try:
                            async with async_session() as db:
                                photo = await db.get(Photo, pid)
                                if photo:
                                    photo.ocr_text = res["ocr_text"]
                                    await db.commit()
                                    logger.info(f"Saved OCR text for photo ID {pid}.")
                        except Exception as e:
                            logger.error(f"Failed to save OCR text for photo {pid}: {e}")

                # ── Stage 5: Content Classification (photo/screenshot/document) ──
                if settings.ENABLE_AI_CONTENT_CLASSIFY:
                    from app.services.content_classifier import classify_content, ContentType
                    from app.services.sync.handler import is_video_file

                    for job in job_infos:
                        pid = job["photo_id"]
                        res = results[pid]
                        if res["is_encrypted"] or not res["photo_path"] or not os.path.exists(res["photo_path"]):
                            continue
                        if is_video_file(res["photo_path"]):
                            continue
                        try:
                            async with async_session() as db:
                                photo = await db.get(Photo, pid)
                                if not photo:
                                    continue
                                ext = os.path.splitext(photo.filename)[1] if photo.filename else ""
                                content_type = classify_content(
                                    width=photo.width,
                                    height=photo.height,
                                    file_ext=ext,
                                    exif_make=photo.exif_make,
                                    exif_model=photo.exif_model,
                                    ocr_text=res.get("ocr_text") or photo.ocr_text,
                                    thumbnail_path=photo.url if photo.url and not photo.url.startswith("local://") else None,
                                    filename=photo.filename or "",
                                )
                                photo.content_type = content_type.value
                                await db.commit()
                                logger.info(f"Content classification for photo {pid}: {content_type.value}")
                        except Exception as e:
                            logger.error(f"Content classification failed for photo {pid}: {e}")

                max_retries = settings.JOB_QUEUE_MAX_RETRIES

                for job in job_infos:
                    job_id = job["id"]
                    pid = job["photo_id"]
                    attempt = job["attempt_count"]
                    res = results[pid]

                    from app.services.sync.handler import is_video_file
                    is_video = is_video_file(res["photo_path"]) if res["photo_path"] else False

                    stage2_needed = not res["is_encrypted"] and settings.ENABLE_AI_CLIP
                    stage3_needed = not res["is_encrypted"] and settings.ENABLE_AI_CLIP and not is_video

                    s2_ok = res["stage2_success"] if stage2_needed else True
                    s3_ok = res["stage3_success"] if stage3_needed else True
                    stage4_needed = not res["is_encrypted"] and settings.ENABLE_AI_OCR and not is_video
                    s4_ok = res["stage4_success"] if stage4_needed else True

                    if not res["stage1_success"] and not res["is_encrypted"]:
                        logger.warning(f"Gemma Vision failed for photo {pid}, but embeddings/faces succeeded. Job will complete.")

                    success = s2_ok and s3_ok and s4_ok
                    err_msg = "\n".join(res["errors"]) if res["errors"] else None

                    try:
                        async with async_session() as db:
                            db_job = await db.get(BackgroundJob, job_id)
                            if db_job:
                                if success:
                                    db_job.status = "completed"
                                    db_job.current_stage = None
                                    db_job.stage_progress = None
                                else:
                                    db_job.last_error = err_msg
                                    if attempt >= max_retries:
                                        db_job.status = "failed"
                                        logger.error(f"Job ID {job_id} failed permanently after {max_retries} attempts.")
                                    else:
                                        db_job.status = "pending"
                                        delay_seconds = min(2 ** attempt * 30, 600)
                                        db_job.created_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=delay_seconds)
                                        logger.info(f"Job ID {job_id} retry {attempt}/{max_retries}, delayed {delay_seconds}s")
                                db_job.updated_at = datetime.datetime.utcnow()
                                await db.commit()
                    except Exception as e:
                        logger.error(f"Failed to update background job status for job {job_id}: {e}")

                gc.collect()
                await self._broadcast_status(completed_batch=True)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Persistent Queue worker encountered unhandled error: {e}")
                await asyncio.sleep(2.0)

processing_queue = ProcessingQueue()
