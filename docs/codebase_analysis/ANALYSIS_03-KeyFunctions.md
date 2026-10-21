# Prism Technical Analysis: Key Functions

> **Document**: ANALYSIS_03-KeyFunctions.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 5  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [1. Media Ingestion: `upload_photo`](#1-media-ingestion-upload_photo)
- [2. Multimodal Retrieval: `fused_search`](#2-multimodal-retrieval-fused_search)
- [3. Background AI Worker: `spawn_worker_loop`](#3-background-ai-worker-spawn_worker_loop)
- [4. Neural Vision Vectorizer: `SiglipEngine::embed_image`](#4-neural-vision-vectorizer-siglipengineembed_image)
- [5. Telemetry Interceptor: `telemetry_tracking_layer`](#5-telemetry-interceptor-telemetry_tracking_layer)
- [6. Visual Perceptual Dedup: `get_visual_duplicates`](#6-visual-perceptual-dedup-get_visual_duplicates)
- [7. Verification Report](#7-verification-report)

---

## 1. Media Ingestion: `upload_photo`

- **Location**: `backend_rust/src/routes/photos/upload.rs:34-175`
- **Purpose**: Ingests image binaries or JSON paths, extracts dimensions and camera EXIF metadata, deduplicates paths, persists records to SQLite, dispatches webhooks, and triggers AI background processing.

### Line-by-Line Code Audit

```rust
// [VERIFY: backend_rust/src/routes/photos/upload.rs:34-65]
pub async fn upload_photo(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Photo>, (StatusCode, String)> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let target_path: PathBuf;

    if content_type.contains("application/json") {
        let payload: UploadJsonPayload = serde_json::from_slice(&body)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid JSON payload: {}", e)))?;

        let raw_path = payload
            .file_path
            .or(payload.path)
            .ok_or((StatusCode::BAD_REQUEST, "Missing file_path in payload".to_string()))?;

        target_path = PathBuf::from(raw_path);
        if !target_path.exists() {
            return Err((StatusCode::NOT_FOUND, format!("File not found: {:?}", target_path)));
        }
    } else {
        let filename = format!("upload_{}.jpg", chrono::Utc::now().timestamp_millis());
        fs::create_dir_all(&state.config.upload_dir).ok();
        target_path = state.config.upload_dir.join(&filename);
        fs::write(&target_path, body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
```

- **Lines 39-42**: Inspects the `Content-Type` header to distinguish between a JSON reference payload (`application/json`) and a raw binary upload.
- **Lines 46-58**: If JSON, resolves the local absolute path from `file_path` or `path` and validates file existence on the host filesystem.
- **Lines 60-64**: If binary, generates a unique timestamped filename `upload_{millis}.jpg`, ensures the target upload directory exists, and writes the bytes to disk.

```rust
// [VERIFY: backend_rust/src/routes/photos/upload.rs:74-98]
    if let Ok(Some(mut existing)) = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE path = ?")
        .bind(&abs_path_str)
        .fetch_optional(&state.db)
        .await
    {
        let sz = existing.file_size.or(file_size);
        if existing.uuid.is_none() || existing.file_size.is_none() {
            let u = existing.uuid.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
            sqlx::query("UPDATE photos SET uuid = ?, file_size = ? WHERE id = ?")
                .bind(&u)
                .bind(sz)
                .bind(existing.id)
                .execute(&state.db)
                .await
                .ok();
            existing.uuid = Some(u);
            existing.file_size = sz;
        }
        let p_key = existing.uuid.as_deref().unwrap_or(&existing.id.to_string()).to_string();
        existing.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
        if existing.date_taken.is_none() {
            existing.date_taken = Some(Utc::now());
        }
        return Ok(Json(existing));
    }
```

- **Lines 74-98**: Deduplication guard. Checks if the file path is already indexed. If present, ensures it possesses a valid UUID and backfilled file size, sets its thumbnail URL, and returns the existing entity immediately.

```rust
// [VERIFY: backend_rust/src/routes/photos/upload.rs:100-138]
    let img_info = get_image_info(&target_path).unwrap_or_else(|_| crate::services::thumbnail::ImageInfo {
        width: 1920,
        height: 1080,
        aspect_ratio: 1.77,
    });
    let exif = extract_exif(&target_path);
    let now_str = Utc::now().to_rfc3339();
    let new_uuid = Uuid::new_v4().to_string();

    let id = sqlx::query(
        r#"
        INSERT INTO photos (uuid, filename, path, width, height, aspect_ratio, exif_make, exif_model, exif_iso, exif_focal_length, date_taken, date, upload_date, file_type, mime_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'image/jpeg', ?)
        "#
    )
    .bind(&new_uuid)
    .bind(&filename)
    .bind(&abs_path_str)
    .bind(img_info.width as i32)
    .bind(img_info.height as i32)
    .bind(img_info.aspect_ratio)
    .bind(&exif.make)
    .bind(&exif.model)
    .bind(&exif.iso)
    .bind(&exif.focal_length)
    .bind(&now_str)
    .bind(&now_str)
    .bind(&now_str)
    .bind(file_size)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .last_insert_rowid();

    let mut photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
```

- **Lines 100-108**: Extracts pixel dimensions and camera parameters (make, model, ISO, focal length).
- **Lines 109-138**: Executes an atomic SQL INSERT into `photos` with parameterized bindings.

```rust
// [VERIFY: backend_rust/src/routes/photos/upload.rs:150-174]
    crate::services::webhooks::WebhookService::dispatch_event(
        &state.db,
        "photo.imported",
        serde_json::json!({
            "id": photo.id,
            "uuid": photo.uuid,
            "filename": photo.filename,
            "path": photo.path
        }),
    )
    .await;

    // Pre-generate thumbnail in background so grid loads instantly
    let src_path = target_path.clone();
    let thumb_dir = state.config.thumbnails_dir.clone();
    let photo_id = photo.id;
    tokio::task::spawn_blocking(move || {
        let _ = crate::services::thumbnail::generate_thumbnail(&src_path, &thumb_dir, photo_id, 400);
    });

    // Enqueue for 4-stage AI processing
    crate::services::worker::enqueue_photo(&state.db, photo.id).await;
    state.worker.notify.notify_one();

    Ok(Json(photo))
```

- **Lines 150-160**: Asynchronously triggers registered HTTP webhooks.
- **Lines 163-168**: Spawns a Tokio blocking thread to render a 400px thumbnail.
- **Lines 171-173**: Enqueues the photo into `background_jobs` and awakens the background AI worker loop via `notify.notify_one()`.

---

## 2. Multimodal Retrieval: `fused_search`

- **Location**: `backend_rust/src/routes/utilities.rs:750-860`
- **Purpose**: Combines 768-dimensional SigLIP2 semantic vector retrieval with full-text SQL matching.

### Line-by-Line Code Audit

```rust
// [VERIFY: backend_rust/src/routes/utilities.rs:750-785]
pub async fn fused_search(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let query = params.get("q").map(|s| s.as_str()).unwrap_or("");
    let limit: usize = params.get("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    if query.is_empty() {
        // Return latest photos when no query is specified
        let results = sqlx::query_as::<_, ...>("SELECT ... FROM photos ORDER BY date_taken DESC LIMIT ?")
            .bind(limit as i64)
            .fetch_all(&state.db)
            .await ...
        return Json(json!({ "results": results, "total": results.len() }));
    }

    let search_tools = crate::services::agent_search::SearchTools::new(
        state.db.clone(),
        crate::services::siglip::get_engine().ok(),
        crate::services::vector_index::get_vector_index(),
    );
    let similar_ids = search_tools.semantic_search(query, limit, false, true).await;
```

- **Lines 754-758**: Parses query string `q` and optional result `limit`.
- **Lines 759-775**: Fast path for empty queries: serves chronological timeline photos directly.
- **Lines 777-782**: Instantiates `SearchTools` with DB pool and SigLIP2 engine, executing dot-product vector search.

```rust
// [VERIFY: backend_rust/src/routes/utilities.rs:804-858]
    if results.len() < limit {
        let terms: Vec<&str> = query.split_whitespace().collect();
        if !terms.is_empty() {
            type PhotoRow = (i64, String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>);
            let mut qb = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT id, uuid, filename, path, date_taken, city, state, country, caption, ai_summary \
                 FROM photos WHERE is_trash = 0 AND is_locked = 0"
            );

            qb.push(" AND (");
            let mut first_term = true;
            for t in &terms {
                if !first_term {
                    qb.push(" OR ");
                }
                first_term = false;
                let escaped = format!("%{}%", t.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"));
                qb.push("(ai_summary LIKE ")
                  .push_bind(escaped.clone())
                  .push(" ESCAPE '\\' OR caption LIKE ")
                  .push_bind(escaped.clone())
                  .push(" ESCAPE '\\' OR auto_tags LIKE ")
                  .push_bind(escaped.clone())
                  .push(" ESCAPE '\\' OR ocr_text LIKE ")
                  .push_bind(escaped)
                  .push(" ESCAPE '\\')");
            }
            qb.push(")");
```

- **Lines 808-835**: If vector search yields fewer items than `limit`, constructs dynamic SQL query with proper escape characters, searching across `ai_summary`, `caption`, `auto_tags`, and `ocr_text`.
- **Lines 837-848**: Explicitly excludes previously retrieved vector matches (`AND id NOT IN (...)`) to guarantee zero duplicate rows.

---

## 3. Background AI Worker: `spawn_worker_loop`

- **Location**: `backend_rust/src/services/worker.rs:465-538`
- **Purpose**: Autonomous, hardware-aware event loop coordinating asynchronous AI processing across photos.

```rust
// [VERIFY: backend_rust/src/services/worker.rs:465-495]
pub fn spawn_worker_loop(
    worker: Arc<WorkerState>,
    ml_client: MlClient,
    db: DbPool,
    scheduler: Arc<JobScheduler>,
    registry: Arc<AnalyzerRegistry>,
) {
    tokio::spawn(async move {
        reset_interrupted_jobs(&db).await;

        let mut sys_state = SystemState::default();

        loop {
            tokio::select! {
                _ = worker.notify.notified() => {}
                _ = sleep(Duration::from_secs(JOB_POLL_INTERVAL_SECS)) => {}
            }

            if worker.is_paused() {
                sleep(Duration::from_secs(1)).await;
                continue;
            }

            if let Some((reason, sleep_secs)) = scheduler.check_system(&mut sys_state) {
                worker.set_throttled(reason);
                sleep(Duration::from_secs(sleep_secs)).await;
                continue;
            }
            worker.clear_throttled();
```

- **Line 475**: Crash recovery: resets interrupted jobs to `pending`.
- **Lines 482-485**: Efficient waking via `tokio::select!`: awakens immediately upon upload notification or every 2 seconds.
- **Lines 491-495**: Telemetry guard: verifies CPU $< 85\%$ and Battery $> 20\%$.

---

## 4. Neural Vision Vectorizer: `SiglipEngine::embed_image`

- **Location**: `backend_rust/src/services/siglip.rs:68-107`
- **Purpose**: Preprocesses raw image bytes into normalized planar NCHW tensors and executes ONNX vision inference.

```rust
// [VERIFY: backend_rust/src/services/siglip.rs:68-107]
pub fn embed_image(&self, photo_path: &str) -> Result<Vec<f32>, String> {
    let bytes = std::fs::read(photo_path)
        .map_err(|e| format!("Failed to read {}: {}", photo_path, e))?;
    let format = image::guess_format(&bytes)
        .map_err(|e| format!("Unsupported image format for {}: {}", photo_path, e))?;
    let img = image::load_from_memory_with_format(&bytes, format)
        .map_err(|e| format!("Failed to decode {}: {}", photo_path, e))?;
    
    let resized = img.resize_exact(224, 224, FilterType::Triangle).to_rgb8();
    let mut pixel_values = vec![0.0f32; 1 * 3 * 224 * 224];
    
    // Channel-first (NCHW): Batch = 0, C = 0..3, H = y, W = x
    for y in 0..224 {
        for x in 0..224 {
            let p = resized.get_pixel(x as u32, y as u32);
            let idx = y * 224 + x;
            pixel_values[0 * 224 * 224 + idx] = (p[0] as f32 / 255.0 - 0.5) / 0.5;
            pixel_values[1 * 224 * 224 + idx] = (p[1] as f32 / 255.0 - 0.5) / 0.5;
            pixel_values[2 * 224 * 224 + idx] = (p[2] as f32 / 255.0 - 0.5) / 0.5;
        }
    }

    let pixel_values_tensor = Value::from_array(([1, 3, 224, 224], pixel_values))
        .map_err(|e| format!("Failed to convert array to Value: {}", e))?;
    let inputs = ort::inputs!["pixel_values" => pixel_values_tensor];
    
    let mut session_guard = self.vision_session.lock()
        .map_err(|_| "Failed to lock vision session Mutex".to_string())?;
    let outputs = session_guard.run(inputs)
        .map_err(|e| format!("Vision ONNX inference failed: {}", e))?;
    
    let output = outputs["image_features"]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract tensor: {}", e))?;
    
    let mut embedding: Vec<f32> = output.1.to_vec();
    l2_normalize(&mut embedding);
    
    Ok(embedding)
}
```

- **Lines 76-88**: Resizes image to $224 \times 224$ and packs planar float channels $[-1.0, 1.0]$.
- **Lines 94-97**: Executes ViT-B/16 inference in ONNX Runtime.
- **Lines 103-104**: Normalizes output vector to unit hypersphere via `l2_normalize`.

---

## 5. Telemetry Interceptor: `telemetry_tracking_layer`

- **Location**: `backend_rust/src/routes/mod.rs:131-160`
- **Purpose**: Tower middleware measuring API execution durations, logging errors, and sampling successful requests.

```rust
// [VERIFY: backend_rust/src/routes/mod.rs:131-160]
async fn telemetry_tracking_layer(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();

    let is_internal_poll = path.starts_with("/api/v1/telemetry/")
        || path == "/api/v1/utilities/background-jobs/status"
        || path == "/api/v1/settings/events";
    if is_internal_poll {
        return next.run(req).await;
    }

    let response = next.run(req).await;

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let status_code = response.status().as_u16();
    let is_error = status_code >= 400;

    let sample_rate = TELEM_SAMPLE_RATE.load(Ordering::Relaxed);
    let telemetry_enabled = TELEM_ENABLED.load(Ordering::Relaxed);
```

- **Lines 143-148**: Filters polling routes to eliminate self-referential log loops.
- **Lines 152-156**: Calculates execution duration in milliseconds and flags error statuses.
- **Lines 159-160**: Evaluates sampling configuration (`1-in-10` by default).

---

## 6. Visual Perceptual Dedup: `get_visual_duplicates`

- **Location**: `backend_rust/src/routes/utilities.rs:483-513`
- **Purpose**: Groups visually identical or burst-shot photos using bitwise Hamming distance over perceptual hashes.

```rust
// [VERIFY: backend_rust/src/routes/utilities.rs:483-513]
pub async fn get_visual_duplicates(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND phash IS NOT NULL"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut clusters: Vec<Value> = Vec::new();
    for (i, a) in photos.iter().enumerate() {
        let mut cluster = vec![json!({ "id": a.id, "filename": a.filename, "path": a.path })];
        for b in photos.iter().skip(i + 1) {
            if let (Some(ref ha), Some(ref hb)) = (&a.phash, &b.phash) {
                if ha.len() == hb.len() {
                    let dist: u32 = ha.bytes().zip(hb.bytes()).map(|(x, y)| (x ^ y).count_ones()).sum();
                    if dist <= 5 {
                        cluster.push(json!({ "id": b.id, "filename": b.filename, "path": b.path, "distance": dist }));
                    }
                }
            }
        }
        if cluster.len() > 1 {
            clusters.push(json!({ "photos": cluster }));
        }
    }

    Json(json!({ "clusters": clusters }))
}
```

- **Lines 495-504**: Uses triangular iteration and single-cycle `count_ones()` (`POPCNT`) to cluster images where Hamming distance $\le 5$.

---

## 7. Verification Report

| Audited Function | Source Code Anchor | Key Features Verified | Status |
|---|---|---|---|
| `upload_photo` | `backend_rust/src/routes/photos/upload.rs:34-175` | Ingestion, EXIF, deduplication, thumbnailing | ✓ Verified |
| `fused_search` | `backend_rust/src/routes/utilities.rs:750-860` | Dual-track vector dot-product + SQL LIKE fallback | ✓ Verified |
| `spawn_worker_loop` | `backend_rust/src/services/worker.rs:465-538` | Crash recovery, reactive notification, throttling | ✓ Verified |
| `embed_image` | `backend_rust/src/services/siglip.rs:68-107` | 224x224 RGB planar NCHW, ONNX, L2 normalization | ✓ Verified |
| `telemetry_tracking_layer` | `backend_rust/src/routes/mod.rs:131-160` | Duration measurement, polling culling, 1-in-N | ✓ Verified |
| `get_visual_duplicates` | `backend_rust/src/routes/utilities.rs:483-513` | Hamming distance XOR bitcount with popcount | ✓ Verified |
