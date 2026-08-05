# Rust ML Migration — Retire Python, Restore All Features

**Repo:** `prism-desktop` | **Branch:** `rust-ml-migration` | **Goal:** single Rust backend on :8269, zero Python at runtime, full feature parity with the Python backend

---

## Why

The Rust backend still depends on the Python ML microservice (`ml_service.py`, :8270) for live endpoints, while several features were dead twice over — not implemented in `ml_service.py` AND never called by the frontend. This migration ports everything to in-process Rust, restores dead features, and ultimately deletes Python entirely.

---

## Progress

### ✅ Done

| Phase | Work | Status |
|---|---|---|
| **0** | `llm_server.rs` + `llm_client.rs` — llama-server lifecycle, vision/OCR/agent LLM clients | ✅ Complete |
| **1** | `siglip.rs` — in-process SigLIP2 image+text towers via `ort`; ONNX models exported | ✅ Complete |
| **2** | `segmentation.rs` — real ONNX inference: U²-Net-p (background), SegFormer ADE20K-150 (semantic), BiSeNet face-parsing (portrait) | ✅ Complete |
| **2** | `auto_enhance.rs` — in-process HSV heuristic (image crate), replaces Python `metadata.py` | ✅ Complete |
| **2** | Route method fix — `auto-enhance` was GET, fixed to POST | ✅ Complete |
| **3** | `inpaint.rs` — LaMa inpainting via `simple_lama_inpainting` subprocess; ONNX-ready interface | ✅ Complete |
| **Wiring** | All mask/enhance/inpaint route handlers now call in-process Rust services, no `ml_client` proxy | ✅ Complete |

### ⏳ Remaining

| Phase | Work |
|---|---|
| **4** | YOLOv8n ONNX detection + SAM mask decoder; in-process `interrogate.rs` |
| **5** | Agent LLM intelligence (real `/preload`, planner, 9 search tools, semantic vector search) |
| **6** | Stories via llama-server (agent mode :9090) |
| **7** | Subtitle generation via `whisper-cli` subprocess |
| **8** | Summaries enrichment, XMP upload-import/check, `/explore/themes` |
| **9** | Delete `backend/` Python folder, strip Python from launcher scripts |

---

## Architecture

### ML Endpoint Status

| Endpoint | Python impl | Rust replacement | Status |
|---|---|---|---|
| `/ml/siglip` | SigLIP2 via transformers (torch) | `siglip.rs` (ort, lazy OnceLock) | ✅ Replaced |
| `/ml/vision` | llama-server :9091 (Gemma E2B) | `llm_client.rs` direct HTTP | ✅ Replaced |
| `/ml/ocr` | llama-server :9092 (PaddleOCR-VL) | `llm_client.rs` direct HTTP | ✅ Replaced |
| `/ml/interrogate` | EXIF + OCR + vision + detection stub | `ml_client.interrogate` (Python still) | 🔄 Phase 4 |
| `/ml/semantic-masks` | `semantic.onnx` (ADE20K SegFormer) | `segmentation.rs` | ✅ Replaced |
| `/ml/background-mask` | `u2netp.onnx` | `segmentation.rs` | ✅ Replaced |
| `/ml/portrait-masks` | `face_parsing.onnx` (BiSeNet) | `segmentation.rs` | ✅ Replaced |
| `/ml/auto-enhance` | cv2 HSV heuristics (`metadata.py`) | `auto_enhance.rs` (image crate) | ✅ Replaced |
| `/ml/inpaint` | simple-lama / diffusers | `inpaint.rs` (LaMa subprocess) | ✅ Replaced |

---

## Key Technical Decisions

### Phase 0 & 1 — LLM Server + SigLIP

- **`llm_server.rs`**: Ports `ai_orchestrator.py` — 3 mutually exclusive modes (agent :9090, vision :9091, OCR :9092). Each spawns `llama-server` binary, waits for health, and kills the previous mode.
- **`llm_client.rs`**: Replicates Python payloads exactly — base64 images, structured prompts for vision/OCR/tags.
- **`siglip.rs`**: Lazy `OnceLock<Arc<SiglipEngine>>`. Sessions wrapped in `Mutex` (required by `ort` 2.x `Session::run(&mut self)`). Outputs correctly named with `output_names=["last_hidden_state", "image_features"]` in export script to avoid shape mismatch.
- **ONNX export**: `export_siglip.py` uses `dynamo=True` (torch.export backend), `output_names` must explicitly list both outputs. Model saved at `backend_rust/models/llm/siglip2_image.onnx` and `siglip2_text.onnx`.
- **Tokenizer**: `tokenizers = "0.20.0"` required — v0.19.x fails on `"ignore_merges"` key in newer HuggingFace tokenizer configs.

### Phase 2 & 3 — Segmentation, Auto-Enhance, Inpaint

#### Segmentation models

| Model | File | Input | Output | Notes |
|---|---|---|---|---|
| U²-Net-p | `models/segmentation/u2netp.onnx` | `input.1` `[1,3,320,320]` float32 [0,1] | `1959` `[1,1,320,320]` float32 | First output is the highest-resolution sigmoid mask |
| SegFormer | `models/segmentation/semantic.onnx` | `pixel_values` `[1,3,H,W]` float32 [0,1] | `logits` `[1,150,H',W']` float32 | ADE20K 150-class; argmax over label dim → class map |
| BiSeNet | `models/face/face_parsing.onnx` | `input` `[1,3,512,512]` float32 [0,1] | `[0]` `[1,C,512,512]` float32 | CelebAMask-HQ 19 classes; class 0 = background |

All three use:
- NCHW channel-first layout, values normalized to `[0, 1]`
- Image resized to model input size, mask resized back to original dimensions
- Saved as grayscale PNG to `thumbnails/masks/mask_{id}_{type}.png`
- Background mask: disk-cached (skips re-inference if file already exists)

#### `ort` 2.x API patterns used

```rust
// Session building
let session = Session::builder()?
    .with_optimization_level(GraphOptimizationLevel::Level3)?
    .commit_from_file("model.onnx")?;

// Multi-threaded sharing — Session::run takes &mut self
let session: Mutex<Session> = Mutex::new(session);

// Running inference
let tensor = Value::from_array(([1usize, 3, 320, 320], flat_data))?;
let inputs = ort::inputs!["input_name" => tensor];
let mut guard = session.lock().unwrap();   // named binding required for lifetime
let outputs = guard.run(inputs)?;

// Extracting output — returns (Shape, CowArray<f32, IxDyn>)
let (shape, data) = outputs["output_name"].try_extract_tensor::<f32>()?;
let shape: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
let flat: Vec<f32> = data.iter().copied().collect();
```

> **Note**: `outputs[key].try_extract_tensor()` borrows `outputs`, so the session guard (`guard`) must live as long as `outputs`. Never inline the lock on the same line as `.run()`.

#### `auto_enhance.rs`

Pure Rust port of `metadata.py` HSV analysis. No ML, no ONNX — just the `image` crate:

1. Thumbnail to 256×256 for speed
2. Per-pixel: compute HSV max/delta → V (value/brightness) and S (saturation) in [0,255]
3. Compute `avg_v`, `std_v`, `avg_s`
4. Map to `AutoEnhanceParams`: exposure/shadows (underexposed), highlights/exposure (overexposed), contrast/whites/blacks (flat), saturation/vibrance (dull/oversaturated)

Returns `AutoEnhanceParams` struct, serialised as JSON by the route handler.

#### `inpaint.rs`

LaMa ONNX export from `big-lama.pt` (TorchScript JIT) is blocked by the new `torch.export`-based dynamo exporter — it cannot inspect TorchScript signatures. Current implementation calls `simple_lama_inpainting` Python package as a subprocess:

1. Decode base64 mask → temp PNG file
2. Spawn `backend/.venv/bin/python -c "..."` with inline script
3. Script runs `SimpleLama(device="cpu")(image, mask)`, prints base64 PNG to stdout
4. Return `{"success": true, "result": "data:image/png;base64,...", "model": "lama"}`

**Future ONNX path**: When export is resolved (use `dynamo=False` with the legacy `torch.jit.trace` wrapper), swap the subprocess call with direct `ort::Session` inference — the public interface is identical.

---

## Dependencies

```toml
ort = { version = "2.0.0-rc.13", features = ["ndarray"] }
tokenizers = "0.20.0"
image = "0.25"
base64 = "0.22"
```

### Models on disk

| Model | Path | Size |
|---|---|---|
| SigLIP2 vision | `backend_rust/models/llm/siglip2_image.onnx` | ~385MB |
| SigLIP2 text | `backend_rust/models/llm/siglip2_text.onnx` | ~70MB |
| SigLIP2 tokenizer | `backend_rust/models/llm/tokenizer.json` | — |
| U²-Net-p | `backend_rust/models/segmentation/u2netp.onnx` | ~4.5MB |
| SegFormer ADE20K | `backend_rust/models/segmentation/semantic.onnx` | ~15MB |
| BiSeNet face | `backend_rust/models/face/face_parsing.onnx` | ~50MB |
| LaMa (TorchScript) | `~/.cache/torch/hub/checkpoints/big-lama.pt` | ~200MB |
| Gemma E4B (agent) | `backend_rust/models/llm/*.gguf` | — |
| Gemma E2B (vision) | `backend_rust/models/llm/*.gguf` | — |
| PaddleOCR-VL | `backend_rust/models/PaddleOCR/` | — |

---

## Verification Gates

- [x] `cargo check` clean after each phase
- [x] All unit tests pass (`cargo test -- --nocapture`): 3/3
- [x] SigLIP: cosine similarity > 0 (positive) between related image+text embeddings
- [ ] Auto-enhance: output params verified equal to Python on sample photos
- [ ] Masks: PNG files generated correctly from real photos
- [ ] Inpaint: base64 result returned, visible fill applied
- [ ] Phase 4+: object detection, semantic agent search
- [ ] Python stays running until Phase 9 — instant rollback available

---

## Remaining Phases Detail

### Phase 4 — Interrogate parity: SAM + object detection
- One-time ONNX export of `models/SAM/SAM.safetensors` → `image_encoder.onnx` + `mask_decoder.onnx`
- `services/sam.rs`: point-prompted segmentation (1024 resize, point scaling)
- `services/object_detector.rs`: YOLOv8n ONNX (~12MB) via `ort` — real detections
- `services/interrogate.rs`: EXIF + OCR + vision + objects + SAM → same JSON shape as Python
- Retire: `/ml/interrogate`

### Phase 5 — Agent LLM intelligence
Chosen scope: **LLM plans → run SQL tools → LLM summarizes** (~600 lines, no full ReAct loop).
- `agent_llm.rs`: real `/preload` (start :9090 warm)
- `agent_planner.rs`: port LLM JSON prompts (extract_search_parameters, verify_photos_match, generate_chat_response)
- `agent_search.rs`: 9 search tools to SQLite — metadata/people/captions/albums/OCR/events + **semantic_search** (SigLIP text tower + cosine over stored embeddings) + **similar_image**
- Upgrade `fused_search` from LIKE-only

### Phase 6 — Stories
Port `story_service.py`: metadata-only LLM recaps (tags/names/locations/dates, never images), 2–4 sentences, temp 0.3 via agent-mode llama-server.

### Phase 7 — Subtitles
`video.rs generate_subtitles` via `whisper-cli` binary subprocess (avoids `whisper-rs` C++ toolchain issues). Extract audio via ffmpeg subprocess. `ggml-small.en` GGUF model.

### Phase 8 — Enrichment, XMP, Themes
- Summaries: add metadata enrichment + `Prism_ENC` guard
- XMP: `upload-import` + `check` endpoints
- Themes: new `/explore/themes` in `explore.rs`

### Phase 9 — Delete Python
- Remove `MlClient`, `python_ml_url` config
- Delete `backend/` (ml_service.py, app/, .venv, models/, uv files)
- Strip ML-service launch from `run-web.sh` / `run-desktop.sh`
- Update `PRISM_CONTEXT.md`, `README.md`

---

## Risks

| Risk | Mitigation |
|---|---|
| **LaMa ONNX export** — dynamo exporter can't inspect TorchScript JIT signatures | Subprocess bridge in place; use `dynamo=False` + `torch.jit.trace` wrapper when resolving |
| **SigLIP parity** | Cosine similarity gate; use `tokenizers = "0.20.0"` (not 0.19.x) |
| **whisper-rs build** | Use `whisper-cli` binary subprocess instead |
| **llama-server lifecycle** | `llm_server.rs` replicates Python spawn/health/kill + mode mutual-exclusion |
| **Binary size** | `ort` +~30MB; `face_id` crate and `ort` share same ONNX Runtime library |

---

## Order of Execution

Phase 0 → 1 → 2 → 3 → **4** → **5** → **6** → **7** → **8** → **9**

Phases 0–3 are **complete**. Next: Phase 4 (interrogate + YOLO + SAM).
