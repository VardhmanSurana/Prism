#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$ROOT/backend/backend.log"

# Cleanup: kill frontend and log streamer, leave backend detached
cleanup() {
  echo ""
  echo "[desktop] Shutting down UI..."
  [ -n "$TAURI_PID" ] && kill $TAURI_PID 2>/dev/null || true
  [ -n "$LOG_PID" ] && kill $LOG_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Check if Backend is already running ─────────────────────────────────────
BACKEND_PORT=8000
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "[desktop] Backend is already running on port $BACKEND_PORT."
    echo "[desktop] Reconnecting to active session logs..."
else
    echo "[desktop] Starting Backend in background..."
    # Ensure log file exists
    touch "$BACKEND_LOG"
    (
      cd "$ROOT/backend"

      # ── Compiler Setup (Fix for llama-cpp-python and CUDA) ────────────────
      # Use GCC 15 if available, as nvcc 13.2 doesn't support GCC 16 (default on this system)
      # and the user's environment might be requesting a missing gcc-14.
      if [ -x "/home/linuxbrew/.linuxbrew/bin/gcc-15" ]; then
        export CMAKE_ARGS="-DGGML_CUDA=on -DCMAKE_C_COMPILER=gcc-15 -DCMAKE_CXX_COMPILER=g++-15 -DCMAKE_CUDA_HOST_COMPILER=gcc-15"
        export CUDAHOSTCXX=gcc-15
        # Ensure brew bin is in PATH so CMake can find gcc-15/g++-15
        export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
      fi

      # ── Fix for inspireface library (executable stack issue) ──────────────
      LIB_PATH=".venv/lib/python3.11/site-packages/inspireface/modules/core/libs/linux/x64/libInspireFace.so"
      if [ -f "$LIB_PATH" ] && which execstack >/dev/null 2>&1; then
        if execstack -q "$LIB_PATH" | grep -q "^X"; then
          echo "[desktop] Fixing executable stack for inspireface library..."
          execstack -c "$LIB_PATH"
        fi
      fi

      VENV_LIBS="$ROOT/backend/.venv/lib/python3.11/site-packages/nvidia"
      SYSTEM_CUDA="/usr/local/cuda/lib64"
      
      NEW_LD_PATH=""
      if [ -d "$VENV_LIBS" ]; then
        NEW_LD_PATH="$VENV_LIBS/cublas/lib:$VENV_LIBS/cudnn/lib:$VENV_LIBS/cuda_runtime/lib:$VENV_LIBS/cufft/lib:$VENV_LIBS/cusolver/lib:$VENV_LIBS/cusparse/lib"
      fi
      
      if [ -d "$SYSTEM_CUDA" ]; then
        if [ -n "$NEW_LD_PATH" ]; then
          NEW_LD_PATH="$NEW_LD_PATH:$SYSTEM_CUDA"
        else
          NEW_LD_PATH="$SYSTEM_CUDA"
        fi
      fi

      if [ -n "$NEW_LD_PATH" ]; then
        export LD_LIBRARY_PATH="$NEW_LD_PATH:${LD_LIBRARY_PATH:-}"
      fi

      export PYTHONUNBUFFERED=1
      nohup uv run python -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port $BACKEND_PORT \
        --log-level info > "$BACKEND_LOG" 2>&1 &
      
      echo $! > "$ROOT/backend/backend.pid"
      echo "[desktop] Backend started (PID $(cat "$ROOT/backend/backend.pid"))"
    )
fi

# ── Stream Backend Logs ──────────────────────────────────────────────────────
# This allows you to see the [AI] logs in the terminal
tail -f "$BACKEND_LOG" &
LOG_PID=$!

# ── Tauri (frontend + desktop shell) ─────────────────────────────────────────
(
  cd "$ROOT/frontend"
  exec bunx tauri dev
) &

TAURI_PID=$!
echo "[desktop] Tauri started (PID $TAURI_PID)"

# Wait for Tauri to exit
wait $TAURI_PID 2>/dev/null || true
