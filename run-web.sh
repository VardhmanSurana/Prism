#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$ROOT/backend/backend.log"

# Cleanup: kill frontend and log streamer
cleanup() {
  echo ""
  echo "[web] Shutting down Vite web server..."
  [ -n "$VITE_PID" ] && kill $VITE_PID 2>/dev/null || true
  [ -n "$LOG_PID" ] && kill $LOG_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Check if Backend is already running ─────────────────────────────────────
BACKEND_PORT=8269
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "[web] Backend is already running on port $BACKEND_PORT."
    echo "[web] Killing existing backend for clean restart..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    sleep 1
    pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
    sleep 1
fi
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "[web] WARNING: Port $BACKEND_PORT still in use after kill."
else
    echo "[web] Starting Backend in background..."
    touch "$BACKEND_LOG"
    (
      cd "$ROOT/backend"

      if [ -x "/home/linuxbrew/.linuxbrew/bin/gcc-15" ]; then
        export CMAKE_ARGS="-DGGML_CUDA=on -DCMAKE_C_COMPILER=gcc-15 -DCMAKE_CXX_COMPILER=g++-15 -DCMAKE_CUDA_HOST_COMPILER=gcc-15"
        export CUDAHOSTCXX=gcc-15
        export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
      fi

      LIB_PATH=".venv/lib/python3.11/site-packages/inspireface/modules/core/libs/linux/x64/libInspireFace.so"
      if [ -f "$LIB_PATH" ] && which execstack >/dev/null 2>&1; then
        if execstack -q "$LIB_PATH" | grep -q "^X"; then
          echo "[web] Fixing executable stack for inspireface library..."
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
        --reload \
        --host 127.0.0.1 \
        --port $BACKEND_PORT \
        --log-level info > "$BACKEND_LOG" 2>&1 &
      
      echo $! > "$ROOT/backend/backend.pid"
      echo "[web] Backend started (PID $(cat "$ROOT/backend/backend.pid"))"
    )
fi

# ── Wait for backend to be ready ─────────────────────────────────────────────
echo "[web] Waiting for backend on port $BACKEND_PORT..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:$BACKEND_PORT/api/v1/photos/stats" 2>/dev/null; then
    echo "[web] Backend is ready."
    break
  fi
  sleep 0.5
done

# ── Stream Backend Logs ──────────────────────────────────────────────────────
tail -f "$BACKEND_LOG" &
LOG_PID=$!

# ── Frontend (Vite web server only, no Tauri) ─────────────────────────────────
(
  cd "$ROOT/frontend"
  exec pnpm run dev
) &

VITE_PID=$!
echo "[web] Vite web server started (PID $VITE_PID)"

wait $VITE_PID 2>/dev/null || true
