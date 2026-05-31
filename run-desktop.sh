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

      VENV_LIBS="$ROOT/backend/.venv/lib/python3.11/site-packages/nvidia"
      if [ -d "$VENV_LIBS" ]; then
        export LD_LIBRARY_PATH=\
"$VENV_LIBS/cublas/lib:\
$VENV_LIBS/cudnn/lib:\
$VENV_LIBS/cuda_runtime/lib:\
$VENV_LIBS/cufft/lib:\
$VENV_LIBS/cusolver/lib:\
$VENV_LIBS/cusparse/lib:\
${LD_LIBRARY_PATH:-}"
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
