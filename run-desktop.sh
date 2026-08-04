#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$ROOT/backend_rust/backend.log"

# Cleanup: kill frontend and log streamer, leave backend detached
cleanup() {
  echo ""
  echo "[desktop] Shutting down UI..."
  [ -n "$TAURI_PID" ] && kill $TAURI_PID 2>/dev/null || true
  [ -n "$LOG_PID" ] && kill $LOG_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Check if Backend is already running ─────────────────────────────────────
BACKEND_PORT=8269
ML_PORT=8270

if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "[desktop] Backend is already running on port $BACKEND_PORT."
    echo "[desktop] Killing existing backend for clean restart..."
    pkill -f "prism-backend-rust" 2>/dev/null || true
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    sleep 1
fi

PYTHON_BACKEND_DIR="${PYTHON_BACKEND_DIR:-$ROOT/backend}"
if [ -d "$PYTHON_BACKEND_DIR" ]; then
  echo "[desktop] Starting Python ML microservice on port $ML_PORT..."
  (
    cd "$PYTHON_BACKEND_DIR"
    nohup uv run python ml_service.py > "$PYTHON_BACKEND_DIR/ml_service.log" 2>&1 &
  )
else
  echo "[desktop] Python ML microservice directory ($PYTHON_BACKEND_DIR) not found, skipping ML service launch."
fi

echo "[desktop] Starting Rust Backend on port $BACKEND_PORT..."
touch "$BACKEND_LOG"
(
  cd "$ROOT/backend_rust"
  export PORT=$BACKEND_PORT
  export PYTHON_ML_URL="http://127.0.0.1:$ML_PORT"
  nohup cargo run > "$BACKEND_LOG" 2>&1 &
  echo $! > "$ROOT/backend_rust/backend.pid"
  echo "[desktop] Rust Backend started (PID $(cat "$ROOT/backend_rust/backend.pid"))"
)

# ── Wait for backend to be ready ─────────────────────────────────────────────
echo "[desktop] Waiting for backend on port $BACKEND_PORT..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:$BACKEND_PORT/api/v1/photos/stats" 2>/dev/null; then
    echo "[desktop] Backend is ready."
    break
  fi
  sleep 0.5
done

# ── Stream Backend Logs ──────────────────────────────────────────────────────
# This allows you to see the [AI] logs in the terminal
tail -f "$BACKEND_LOG" &
LOG_PID=$!

# ── Tauri (frontend + desktop shell) ─────────────────────────────────────────
# Fix WebKitGTK DMA-BUF buffer retention bugs on Mesa/Intel iGPU
export WEBKIT_DISABLE_DMABUF_RENDERER=1
# Force WebKitGTK to use hardware-accelerated compositing (not software rendering)
export WEBKIT_DISABLE_COMPOSITING_MODE=0
# Use GL DOM acceleration for better GPU utilization
export WEBKIT_USE_GLDOM=1

(
  cd "$ROOT/frontend"
  exec pnpm exec tauri dev
) &

TAURI_PID=$!
echo "[desktop] Tauri started (PID $TAURI_PID)"

# Wait for Tauri to exit
wait $TAURI_PID 2>/dev/null || true
