# Video Face Detection & Clustering — Implementation Plan

## Overview
Add face detection and clustering for videos using a **hybrid sampling strategy**: scene-change keyframes + uniform gap-filling + cross-frame face deduplication. Reuses existing InspireFace pipeline — no new AI models.

## Strategy

### Frame Sampling (Hybrid)
```
Video (10min, 30fps)
  ↓
1. ffprobe → duration, fps
2. ffmpeg scene detection → extract ~20-50 keyframes at scene boundaries
3. Gap filling → if >5s between keyframes, add uniform samples
4. Deduplicate frames by perceptual hash (skip near-identical)
5. Result: ~30-80 unique frames to analyze
```

### Cross-Frame Face Dedup
- Track face embeddings seen so far in this video
- For each new face in each frame, compare against already-seen embeddings
- If cosine similarity > 0.7 → same person in nearby frames → skip
- Only create PhotoPerson records for truly unique face appearances

### Cost Comparison
| Strategy | Frames | Time (10min video) |
|---|---|---|
| Every frame (30fps) | 18,000 | ~50 min |
| Uniform 1fps | 600 | ~2 min |
| **Hybrid (this plan)** | **30-80** | **~15-30s** |

---

## Phase 1: Video Frame Sampling Utility

### Step 1.1: Add scene-change detection to `backend/app/utils/video.py`
Add function after `extract_frame_at_time()`:

```python
def extract_scene_keyframes(file_path: str, output_dir: str, threshold: float = 0.3, max_frames: int = 50) -> list[tuple[float, str]]:
    """Extract keyframes at scene boundaries using ffmpeg scene detection.
    
    Returns list of (timestamp, frame_path) sorted by time.
    """
    # ffmpeg -i {file} -vf "select='gt(scene,{threshold})',showinfo" -vsync vfp {output_dir}/scene_%04d.jpg
    # Parse showinfo output to get timestamps
    # Cap at max_frames
    ...

def compute_frame_hash(frame_path: str) -> str:
    """Compute perceptual hash of a frame for deduplication."""
    # Use PIL ImageHash or simple downscale+grayscale hash
    ...

def sample_video_frames(file_path: str, duration: float, output_dir: str) -> list[tuple[float, str]]:
    """Hybrid frame sampling: scene detection + uniform gap filling + dedup.
    
    1. Extract scene keyframes
    2. Find gaps > 5s between keyframes, add uniform samples
    3. Deduplicate by perceptual hash
    Returns sorted list of (timestamp, frame_path).
    """
    ...
```

### Step 1.2: Add `load_frame_as_image()` to `backend/app/services/face_utils.py`
New function that loads a frame from a file path (extracted PNG/JPG) into a numpy array for face detection:

```python
def load_frame_as_image(frame_path: str):
    """Load an extracted video frame for face detection."""
    img = cv2.imread(frame_path)
    return img
```

This reuses the same pattern as `load_image()` but for pre-extracted frames.

---

## Phase 2: Video Face Detection Service

### Step 2.1: Add `scan_and_cluster_video_faces()` to `backend/app/services/face_clustering.py`

New method on `FaceClusteringService`. This is the core of the implementation:

```python
async def scan_and_cluster_video_faces(self, photo_id: int, video_path: str, db: AsyncSession) -> int:
    """Scan a video for faces using hybrid frame sampling.
    
    Strategy:
    1. Check if already processed (PhotoPerson exists for this photo_id)
    2. Extract frames via hybrid sampling
    3. For each frame: detect faces, extract embeddings
    4. Cross-frame dedup: skip if same person seen in nearby frames
    5. Match against existing people in DB
    6. Create PhotoPerson associations for unique faces
    
    Returns total unique faces found.
    """
    # 1. Skip if already processed
    existing_check = await db.execute(
        select(func.count()).select_from(PhotoPerson).where(PhotoPerson.photo_id == photo_id)
    )
    if (existing_check.scalar() or 0) > 0:
        return 0

    # 2. Check ffmpeg availability
    if not _check_ffmpeg_available():
        return 0

    # 3. Extract frames via hybrid sampling
    import tempfile
    with tempfile.TemporaryDirectory() as tmp_dir:
        frames = sample_video_frames(video_path, duration, tmp_dir)
        if not frames:
            return 0

        # 4. Load embedding cache
        embedding_cache, existing_people = await self._recognizer.load_embedding_cache(db)
        face_thumb_dir = ensure_face_thumbnail_dir()

        face_results = []
        seen_embeddings = []  # Cross-frame dedup: list of (embedding, person_id_or_None)

        for timestamp, frame_path in frames:
            img = load_frame_as_image(frame_path)
            if img is None:
                continue

            faces, detect_img, scale, stream = self._detector.detect_faces(img)
            if not faces:
                free_image_memory(detect_img, img, stream)
                continue

            for face in faces:
                if not self._detector.is_quality_face(face):
                    continue

                feat = self._recognizer.extract_embedding(stream, face)
                if feat is None:
                    continue

                # Cross-frame dedup: skip if already seen
                is_duplicate = False
                for seen_emb, _ in seen_embeddings:
                    sim = float(np.dot(feat, seen_emb))
                    if sim > 0.7:
                        is_duplicate = True
                        break
                if is_duplicate:
                    continue

                # Find best match
                best_match_person, best_score = self._recognizer.find_best_match(
                    feat, existing_people, embedding_cache
                )

                matched_person = None
                uncertain_person = None
                if best_match_person:
                    if best_score > settings.FACE_MATCH_THRESHOLD:
                        matched_person = best_match_person
                    elif best_score > settings.FACE_UNCERTAIN_MATCH_THRESHOLD:
                        uncertain_person = best_match_person

                # Crop and save thumbnail
                x1, y1, x2, y2 = self._detector.get_face_location_scaled(face, scale)
                cropped_img = crop_face_thumbnail(img, x1, y1, x2, y2)
                thumb_filename = save_face_thumbnail(cropped_img, photo_id, face_thumb_dir)
                box_json = format_face_box_json(x1, y1, x2, y2)

                face_results.append({...})  # Same structure as scan_and_cluster_face

                # Track for cross-frame dedup
                seen_embeddings.append((feat, matched_person.id if matched_person else None))

            free_image_memory(detect_img, img, stream)

    # 5. DB writes (same pattern as scan_and_cluster_face Loop 2)
    ...
    return faces_count
```

Key differences from `scan_and_cluster_face()`:
- Takes video path, uses frame sampling instead of single image
- Cross-frame dedup via `seen_embeddings` list
- Uses `load_frame_as_image()` instead of `load_image()`
- Handles temp directory cleanup

---

## Phase 3: Processing Queue Integration

### Step 3.1: Modify `enqueue()` in `backend/app/services/processing_queue.py`

Change the video skip to only skip non-face AI stages. Face detection should still run for videos:

```python
def enqueue(self, photo_id: int, photo_path: str):
    from app.services.sync.handler import is_video_file
    if is_video_file(photo_path):
        # For videos, only run face detection (skip SigLIP, vision, OCR)
        # Enqueue with a special job type
        ...
        return
    # ... existing code for images
```

### Step 3.2: Modify Stage 2 in `_worker()` to handle videos

In the Stage 2 block (line 337-370), add video-aware processing:

```python
# Separate video jobs from image jobs
video_jobs = [j for j in active_stage2_photos if is_video_file(results[j["photo_id"]]["photo_path"])]
image_jobs = [j for j in active_stage2_photos if not is_video_file(results[j["photo_id"]]["photo_path"])]

# Process image jobs with existing scan_and_cluster_face
for job in image_jobs:
    ...

# Process video jobs with scan_and_cluster_video_faces
for job in video_jobs:
    pid = job["photo_id"]
    path = results[pid]["photo_path"]
    try:
        async with async_session() as db:
            faces_found = await face_service.scan_and_cluster_video_faces(pid, path, db)
        results[pid]["faces_found"] = faces_found
    except Exception as e:
        ...
```

### Step 3.3: Remove video skip from `enqueue()` for face detection

The current `enqueue()` returns early for ALL videos. Change it to:
- For videos: still create a BackgroundJob, but mark it as video-type so the worker knows to use video face detection
- The worker skips SigLIP/vision/OCR for videos but runs face detection

---

## Phase 4: Model & Migration

### Step 4.1: Add `video_faces_scanned` field to Photo model
**File:** `backend/app/models.py`

```python
video_faces_scanned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
```

### Step 4.2: Add dynamic migration
**File:** `backend/app/main.py`

```python
if "video_faces_scanned" not in columns:
    await conn.execute(text("ALTER TABLE photos ADD COLUMN video_faces_scanned BOOLEAN DEFAULT 0"))
```

### Step 4.3: Update serializer
**File:** `backend/app/api/albums/utils.py`

Add `"video_faces_scanned": photo.video_faces_scanned` to `photo_to_dict()`.

---

## Phase 5: Face Detection Config for Video

### Step 5.1: Add video face sampling config to `backend/app/config.py`

```python
# Video face detection settings
VIDEO_FACE_SCENE_THRESHOLD: float = 0.3  # ffmpeg scene detection threshold
VIDEO_FACE_MAX_FRAMES: int = 50          # Max frames to analyze per video
VIDEO_FACE_MIN_GAP_SECONDS: float = 5.0  # Min gap between uniform samples
VIDEO_FACE_DEDUP_THRESHOLD: float = 0.7  # Cosine similarity for cross-frame dedup
```

---

## Files Modified Summary

| File | Change |
|---|---|
| `backend/app/utils/video.py` | Add `extract_scene_keyframes()`, `compute_frame_hash()`, `sample_video_frames()` |
| `backend/app/services/face_utils.py` | Add `load_frame_as_image()` |
| `backend/app/services/face_clustering.py` | Add `scan_and_cluster_video_faces()` method |
| `backend/app/services/processing_queue.py` | Video-aware Stage 2, remove blanket video skip |
| `backend/app/models.py` | Add `video_faces_scanned` field |
| `backend/app/main.py` | Dynamic migration for `video_faces_scanned` |
| `backend/app/api/albums/utils.py` | Serialize `video_faces_scanned` |
| `backend/app/config.py` | Video face sampling settings |

---

## Verification

### Backend Tests
1. **Unit test frame sampling** — mock ffmpeg output, verify scene detection + gap filling + dedup
2. **Unit test cross-frame dedup** — verify faces with similarity > 0.7 are skipped
3. **Integration test video face detection** — use a small test video with known faces, verify PhotoPerson records created
4. **Test idempotency** — run twice on same video, verify no duplicate PhotoPerson records
5. **Test graceful degradation** — verify behavior when ffmpeg not installed

### Manual End-to-End Test
```bash
# Start the app
bun run desktop

# Import a video with faces
# 1. Click Import → select an .mp4 with people in it
# 2. Wait for background processing (check logs for "Stage 2" face detection)
# 3. Navigate to People view → verify faces from video appear
# 4. Click on a person → verify video frames are in their photo grid
# 5. Import same video again → verify no duplicate processing (idempotent)
# 6. Check that processing time is reasonable (~15-30s for 10min video)
```
