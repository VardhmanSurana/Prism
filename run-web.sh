#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$ROOT/backend_rust/backend.log"

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
    pkill -f "prism-backend-rust" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    sleep 1
fi

echo "[web] Starting Rust Backend on port $BACKEND_PORT..."
touch "$BACKEND_LOG"
(
  cd "$ROOT/backend_rust"
  export PORT=$BACKEND_PORT
  nohup cargo run > "$BACKEND_LOG" 2>&1 &
  echo $! > "$ROOT/backend_rust/backend.pid"
  echo "[web] Rust Backend started (PID $(cat "$ROOT/backend_rust/backend.pid"))"
)

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
