# Prism Backend (Python)

The core processing engine for Prism Photos.

## Setup

1. Install `uv` (Fast Python package manager).
2. Install dependencies:
   ```bash
   uv sync
   ```

## Development

- **Start API:**
  ```bash
  uv run uvicorn app.main:app --reload
  ```
- **Tests:**
  ```bash
  export PYTHONPATH=.
  uv run pytest tests/test_face_service.py
  ```

## AI & Hardware Acceleration

This backend is optimized for NVIDIA GPUs (RTX 2050 and above). It uses the InsightFace `buffalo_l` model for state-of-the-art face detection and embedding extraction.

### CUDA Libraries
Ensure your `LD_LIBRARY_PATH` includes the CUDA 12 libraries installed in `.venv`. 
A helper script `run-desktop.sh` in the root folder manages this automatically.
