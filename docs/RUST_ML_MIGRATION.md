# Rust ML Migration — Retire Python, Restore All Features

**Repo:** `prism-desktop` | **Goal:** single Rust backend on :8269, zero Python at runtime, full feature parity with the Python backend

## Why

The Rust backend still depends on the Python ML microservice (`ml_service.py`, :8270) for 4 live endpoints, while 5 endpoints (`semantic-masks`, `background-mask`, `portrait-masks`, `auto-enhance`, `inpaint`) are **dead twice over**: they don't exist in `ml_service.py` (404) AND the frontend never calls them. The Python full backend (app.main, :8000) also contains ML services with no Rust implementation at all (agent LLM, stories, subtitles, summaries enrichment, XMP, explore themes). This migration ports everything to in-process Rust, restores the dead features with frontend wiring, and deletes Python entirely.

## Key findings (verified)

- **Rust agent uses no LLM** — `agent.rs` chat is rule-based (MODE 1 formats `ml_client.interrogate` results; MODE 2 is SQL LIKE search + template text). No llama/Ollama calls anywhere in `backend_rust/src`.
- **Vision + OCR both go through llama-server** (llama.cpp binary), spawned/lifecycled by Python's `ai_orchestrator.py`. Vision = Gemma 3.2 E2B on :9091; OCR = PaddleOCR-VL GGUF on :9092. ("Ollama" in `image_summary/llm.py` is a misnomer — it's llama-server.)
- **Agent mode uses Gemma 3.2 E4B on :9090** (llama-server), managed by `app/agent/llm.py` (LlamaManager).
- The three llama-server modes are **mutually exclusive** in Python (starting one kills the previous) — Rust must replicate this.
- **Object detection is stubbed today** — `object_detection.py` SAM/YOLO paths return `[]`; only an OpenCV blob fallback ever ran. Restoring = improvement (real YOLO ONNX).
- **Rust fused search is LIKE-only** — `utilities.rs fused_search` has no embedding index ("Full semantic requires embedding index" comment). Semantic search needs the SigLIP **text tower** + embedding index built.
- **SigLIP embeddings need both towers** — vision tower for photos, text tower for query embeddings (agent `EmbeddingClient` uses `get_text_features`).
- All ONNX models already on disk: `semantic.onnx`, `u2netp.onnx` (models/segmentation), `face_parsing.onnx` (models/face), SAM safetensors (models/SAM/SAM.safetensors), Gemma/PaddleOCR GGUFs (models/llm, models/PaddleOCR).
- Rust deps already present: `reqwest`, `image`, `kamadak-exif`. Missing: `ort`, `whisper-rs`.

## Current ML surface

| Endpoint | Python impl | Status | Rust replacement |
|---|---|---|---|
| `/ml/siglip` | SigLIP2 via transformers (torch) | **LIVE** | `siglip.rs` (ort, image+text towers) |
| `/ml/vision` | llama-server :9091 (Gemma E2B + mmproj), spawned by `ai_orchestrator.py` | **LIVE** | `llm_server.rs` + `llm_client.rs` direct HTTP |
| `/ml/ocr` | llama-server :9092 (PaddleOCR-VL GGUF) | **LIVE** | `llm_server.rs` + direct HTTP |
| `/ml/interrogate` | EXIF + OCR + vision + object-detection (stub) + SAM center-mask | **LIVE** | `interrogate.rs` (composition) |
| `/ml/semantic-masks` | `semantic.onnx` (in app.main, never served) | **404/dead** | `semantic_mask.rs` + frontend wiring |
| `/ml/background-mask` | `u2netp.onnx` | **404/dead** | `background_mask.rs` |
| `/ml/portrait-masks` | `face_parsing.onnx` | **404/dead** | `portrait_mask.rs` |
| `/ml/auto-enhance` | cv2 HSV heuristics (`metadata.py`) | **404/dead** | `auto_enhance.rs` (image crate, no ML) |
| `/ml/inpaint` | diffusers/simple-lama | **404/dead** | `inpaint.rs` (ort + LaMa ONNX) |

## Python-only ML services (no Rust implementation)

| Service | Python | Rust gap |
|---|---|---|
| **Agent LLM** | `app/agent/*` (~2,400 lines): ReAct planner/orchestrator/executor, 9 search tools, Gemma E4B :9090, NDJSON streaming | Rule-based only; `/preload` fake stub |
| **Stories** | `story_service.py` — metadata-only LLM recaps (2–4 sentences, temp 0.3) | Explicit TODO stubs |
| **Video subtitles** | `subtitle_gen.py` — faster-whisper small.en int8 CPU + wav2vec2 fallback | Explicit TODO stub |
| **Summaries** | `image_summary/service.py` — metadata enrichment + vision LLM + `Prism_ENC` guard | Caption only |
| **XMP sidecars** | export / import / upload-import / check | Only export/import skeleton |
| **Explore themes** | `/explore/themes` | Missing endpoint |

## Phases

### Phase 0 — Foundation: llama-server ownership + LLM client
- **New `services/llm_server.rs`**: port of `ai_orchestrator.py` spawn logic — 3 modes, mutual-exclusion (kill previous before starting):
  - agent :9090 — `gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf` + `gemma-4-E4B-it-Q4_0-MTP.gguf` + `mmproj-BF16-E4B.gguf`
  - vision :9091 — `gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf` + `gemma-4-E2B-it-Q4_0-MTP.gguf` + `mmproj-BF16-E2B.gguf`
  - ocr :9092 — `PaddleOCR-VL-1.6-GGUF.gguf` + mmproj
  - Args: `-ngl 999/0` from GPU_MODE, `--mmproj --no-mmproj-offload`, `--flash-attn on -ctk q8_0 -ctv q8_0 -fit off` on GPU, `-c 8192 -np 1`; health-wait loop; kill-on-shutdown (`tokio::process`, Drop/cleanup hook); LD_LIBRARY_PATH for CUDA.
- **New `services/llm_client.rs`**: `chat/completions` replicating Python payloads exactly (base64 `data:image/jpeg;base64,…`):
  - Vision summary: `"Describe this image in a single concise sentence focusing on the main subjects and setting."`
  - Tags: `"Extract 15 descriptive tags…"` + code-fence/JSON fallback parsing.
  - OCR: `"Extract all visible text from this image. Return only the extracted text, preserving line breaks…"` (max_tokens 2000, temp 0.1)
- **Rewire**: `trigger_ocr`, `generate_summary`, worker analyzers (`vision.rs`, `ocr.rs`) → local client. `MlClient` goes unused.
- **Retire**: `/ml/ocr`, `/ml/vision`.
- **Gate**: OCR + caption parity on `sample_images/`.

### Phase 1 — SigLIP in-process (image + text towers)
- **New `services/siglip.rs`**: `ort` session in `OnceLock` (mirror `face_engine.rs`); SigLIP2 preprocessing (resize 224, normalize mean/std 0.5); L2-normalize → 768-dim; both `image_embedding()` and `text_embedding()` (needed by agent semantic search).
- **Model**: one-time export of cached `google/siglip2-base-patch16-224` → ONNX (`scripts/export_siglip2_onnx.py`) or pull `deepghs/siglip_onnx`.
- **Rewire**: semantic-search analyzer.
- **Gate (non-negotiable)**: cosine similarity ≥ 0.999 vs current Python embeddings (vision AND text) on 3+ samples **before** cutover.
- **Retire**: `/ml/siglip`.

### Phase 2 — Masks + auto-enhance (restore dead features)
- **New engines** (all `ort`, lazy-loaded, PNG-base64 masks in the JSON shape Rust routes already expect):
  - `semantic_mask.rs` — `models/segmentation/semantic.onnx` (ADE20K); pre/post from `semantic_service.py`
  - `background_mask.rs` — `models/segmentation/u2netp.onnx`; pre/post from `background_service.py`
  - `portrait_mask.rs` — `models/face/face_parsing.onnx`; pre/post from `portrait_service.py`
  - `auto_enhance.rs` — `image` crate HSV histogram port of `metadata.py` (avg_v/std_v/avg_s → exposure/shadows/highlights/contrast/whites/blacks/saturation/vibrance)
- **Rewire** `photos_ai.rs` routes → in-process.
- **Frontend / Routes Alignment**: Align route methods. Frontend already calls `/api/v1/photos/auto-enhance/${photoId}` via `POST` in [EditingMode.tsx](file:///home/chotaxdon/Work/Projects/Prism/prism-desktop/frontend/components/Editor/ImageEditor/EditingMode/EditingMode.tsx#L442) and [AdjustPanel.tsx](file:///home/chotaxdon/Work/Projects/Prism/prism-desktop/frontend/components/Editor/ImageEditor/AdjustPanel.tsx#L96), but the backend maps it only to `GET` in [mod.rs](file:///home/chotaxdon/Work/Projects/Prism/prism-desktop/backend_rust/src/routes/mod.rs#L370). Update the route to support `POST`. Similarly, ensure mask endpoints mapped by [SelectivePanel.tsx](file:///home/chotaxdon/Work/Projects/Prism/prism-desktop/frontend/components/Editor/ImageEditor/SelectivePanel.tsx#L42-L47) and [PortraitPanel.tsx](file:///home/chotaxdon/Work/Projects/Prism/prism-desktop/frontend/components/Editor/ImageEditor/PortraitPanel.tsx#L33) match their expected response shapes.
- **Gate**: auto-enhance params equal Python's on samples.

### Phase 3 — Inpaint (restore dead feature)
- **New `services/inpaint.rs`**: `ort` + LaMa ONNX (`Carve/LaMa-ONNX` `lama_fp32.onnx`); 512×512 letterbox + mask resize + paste-back (simple-lama semantics; `expand_pixels` already in `InpaintRequest`).
- **Rewire** `process_inpaint`; keep `/inpaint/unload` as no-op.
- **Frontend**: wire inpaint tool (brush/SAM mask → remove) in Lightbox/editor.

### Phase 4 — Interrogate parity: SAM + object detection
- **One-time ONNX export** of `models/SAM/SAM.safetensors` (facebook/sam-vit-base) → `image_encoder.onnx` + `mask_decoder.onnx` (sam-rs format).
- **New `services/sam.rs`**: `ort` point-prompted segmentation (1024 resize, point scaling — sam-rs preprocessing), binary mask out.
- **New `services/object_detector.rs`**: YOLOv8n ONNX (~12MB) via `ort` — real detections (Python returns `[]`; improvement, not regression).
- **New `services/interrogate.rs`**: EXIF (`kamadak-exif`, same 11 wanted tags as `_extract_exif`) + OCR + vision + objects + SAM center-mask → same JSON shape.
- **Retire**: `/ml/interrogate`.

### Phase 5 — Agent LLM intelligence (biggest gap) — pragmatic loop
Chosen scope: **LLM plans → run SQL tools → LLM summarizes** (no full ReAct loop). ~600 lines.
- `agent_llm.rs`: real `/preload` (start :9090 warm) replaces fake stub; mode mutual-exclusion via `llm_server.rs`.
- `agent_planner.rs`: port LLM JSON prompts (`extract_search_parameters`, `verify_photos_match`, `reformulate_search`, `generate_chat_response`); keep existing rule-based ambiguity check as fallback.
- `agent_search.rs`: port 9 `search_tools` queries to the existing SQLite schema:
  - metadata / people / captions / albums / OCR / events → existing Rust query patterns
  - **semantic_search** → new: text-tower embedding (Phase 1) + cosine over photo embeddings
  - **similar_image** → new: cosine over stored embeddings
  - upgrade `fused_search` from LIKE-only
- Keep `agent.rs` NDJSON streaming shape; insert LLM plan/tool/summary chunks.
- Ask-Image tools reuse Phases 0/4: OCR, EXIF, YOLO objects, SAM region.
- Deferred (not ported): executor loop, specialized_agents, multi-step ReAct.

### Phase 6 — Stories
- `stories.rs`: replace both TODO stubs. Port `story_service.py`: `_build_event_context` (metadata-only: tags, names, locations, dates — never images) + `STORY_PROMPT_TEMPLATE` (2–4 sentence recap, temp 0.3); call via agent-mode llama-server; persist to `events.summary`.

### Phase 7 — Subtitles (whisper-rs / whisper-cli)
- `video.rs` `generate_subtitles`: implement via **whisper-cli** (running precompiled `whisper.cpp` binary via subprocess, consistent with the `llama-server` pattern) to avoid toolchain compilation issues associated with `whisper-rs` (C++ dependency compilation errors in target packaging). Extract audio via ffmpeg subprocess. GGML `small.en` model. Drop wav2vec2 fallback.
- Mirror Python gating: `ENABLE_AI_SUBTITLES` + rate limit + video-type check.

### Phase 8 — Summaries enrichment, XMP, Themes (small)
- **Summaries**: `generate_summary` gains metadata enrichment + `Prism_ENC` locked-file guard (from `image_summary/service.py`); keep vision caption.
- **XMP**: add `upload-import` + `check` endpoints to `xmp_operation` (port sidecar format from `photos/xmp.py`).
- **Themes**: new `/explore/themes` in `explore.rs` (analytics; only Python explore endpoint without a Rust counterpart).

### Phase 9 — Delete Python
- Remove `MlClient` + `python_ml_url` config.
- Delete `backend/` (ml_service.py, app/, .venv, models/, uv files).
- Strip ML-service launch + `PYTHON_ML_URL` from `run-web.sh` / `run-desktop.sh`.
- Update stale docs: `PRISM_CONTEXT.md` (SD1.5 inpaint, "optional Python ML microservice", port table §13, MlClient service map), `README.md`.

## New dependencies & models

| Item | Source | Notes |
|---|---|---|
| `ort` crate | crates.io `ort = "2.0.0-rc"` | +~30MB binary; same ONNX Runtime family as face_id |
| `whisper-rs` | crates.io | needs cmake/clang build toolchain — **flagged risk** |
| SigLIP2 ONNX (image+text) | local export from HF cache, or `deepghs/siglip_onnx` | ~400MB |
| LaMa ONNX | HF `Carve/LaMa-ONNX` (`lama_fp32.onnx`) | ~200MB |
| SAM ONNX | export from `models/SAM/SAM.safetensors` | ~380MB |
| YOLOv8n ONNX | ultralytics export / HF | ~12MB |
| `ggml-small.en` GGUF | HF | ~190MB |
| semantic/u2netp/face_parsing ONNX | **already on disk** | — |

## Verification gates
- `cargo build` clean after each phase; backend restart; curl each endpoint on `sample_images/`.
- SigLIP: cosine ≥ 0.999 vs Python (vision + text) before cutover.
- Auto-enhance: output params equal Python's on sample photos.
- Agent: chat against a known photo + a semantic query; verify NDJSON chunks + tool results.
- Frontend: manual pass on restored masks/enhance/inpaint.
- Python stays running until Phase 9 — instant rollback.

## Risks
- **SigLIP parity** — only real parity risk; mitigated by cosine gate and tokenizer integration (recommend Hugging Face `tokenizers` crate for text tower).
- **whisper-rs build** — C++ toolchain requirement. Mitigated by using the `whisper-cli` binary subprocess strategy as the primary design choice.
- **llama-server lifecycle** — must replicate Python's spawn/health/kill + mode mutual-exclusion exactly.
- **Binary size** — `ort` +~30MB; two onnxruntime instances may coexist. Ensure that the `face_id` crate and the `ort` crate share the same library linking to prevent runtime clashes.

## Order of execution
Phase 0 → 1 (unblocks OCR/vision/search critical path, hardest gates first) → 2 → 3 → 4 → 5 (agent) → 6 → 7 → 8 → 9 (delete Python).
