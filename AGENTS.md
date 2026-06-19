# Prism — Agent Guide

## How this repo runs

Two subpackages, no monorepo tool. Root `package.json` scripts cd into each.

| Command | What it does |
|---|---|
| `bun install` (root) | Installs root tool deps only (`concurrently`). |
| `cd backend && uv venv && uv sync` | First-time backend setup. Backend is Python 3.11 + `uv`. |
| `cd frontend && bun install` | Frontend deps. |
| `bun run desktop` | One-click: starts backend on `8000`, streams `backend/backend.log`, runs `bunx tauri dev`. Reuses existing backend if port 8000 is in use. |
| `bun run dev` | Runs `bun run backend` and `bun run frontend` concurrently via `concurrently`. |
| `bun run backend` | `cd backend` then `uv run uvicorn app.main:app --reload` with CUDA `LD_LIBRARY_PATH` tweaked for venv/system libs. |
| `bun run frontend` | `cd frontend && bun run dev` (Vite on port `3005`). |
| `bun run test` | `bun run frontend:typecheck && bun run backend:test`. |

## Exact verification commands

- Frontend typecheck: `cd frontend && bunx tsc --noEmit` (Vite `tsconfig.json`, `@` alias → project root).
- Frontend tests: `cd frontend && bun test` (Vitest, jsdom, setup at `frontend/tests/setup.ts`).
- Backend tests: `cd backend && uv run pytest tests -q`.
- Build frontend: `cd frontend && bun run build` (also what Tauri bundles).

CI order: backend tests → frontend typecheck → frontend build. There is **no frontend lint script** despite `eslint.config.js` existing; do not assume `bun run lint` works.

## Ports and URLs

- Backend FastAPI: `http://127.0.0.1:8000`
- Tauri dev server: `http://localhost:3005` (pinned `strictPort: true` in `frontend/vite.config.ts` — fail-fast if collides).
- Tauri config allows only these CORS origins: `tauri://localhost`, `http://tauri.localhost`, `http://localhost:3005`.

## Backend gotchas

- Entrypoint: `backend/app/main.py` (`app.main:app`). Lifespan does DB init + dynamic SQLite migration for `blur_score`/`file_size` columns. Do not assume Alembic migrations are the source of truth — current schema is largely driven by `app/models.py` + runtime PRAGMAs.
- SQLite pragmas are bound per-connection (`synchronous=NORMAL`, `cache_size=-64000`, `temp_store=MEMORY`) plus WAL mode in `init_db`.
- Feature flags in `backend/app/config.py`: `ENABLE_AI_AGENT`, `ENABLE_AI_FACE`, `ENABLE_AI_CLIP`, `ENABLE_AI_INPAINTING`, `ENABLE_AI_REMBG` — all `False` by default. AI features are opt-in.
- Test DB isolation: `backend/tests/conftest.py` auto-creates FTS5 `photos_fts` + trigger in session setup, truncates all tables between tests, and overrides `get_db`. Tests read `PRISM_TEST=1` or `pytest` in `sys.modules` to redirect data to a temp dir — do not run tests against the real user data dir.
- Backend optional extras (`agent`, `inpaint`, `face`, `clip`, `rembg`) are **not** installed by `uv sync` alone; CI uses `uv sync --all-extras`.

## Frontend gotchas

- Path alias `@` maps to `frontend/` root (`frontend/vite.config.ts`, `frontend/tsconfig.json`).
- Zustand stores live in `frontend/store/`. SSE/API logic in `frontend/services/`. Tauri Rust entrypoints in `frontend/src-tauri/src/{lib,main}.rs`.
- Tests live in `frontend/tests/`; vitest config is inline in `vite.config.ts`.

## Runtime env files (gitignored — do not commit)

- `backend/.env`
- `backend/settings.json`
- `backend/*.db`, `backend/*.sqlite*`, `backend/uploads/`, `backend/thumbnails/`
- `frontend/.env.local`

## Desktop startup quirks (`run-desktop.sh`)

- Sets LD_LIBRARY_PATH for venv/system NVIDIA libs.
- Picks `gcc-15` from linuxbrew if present (needed for llama.cpp/CUDA builds).
- Patches `libInspireFace.so` execstack via `execstack -c` when available.
- Backend PID saved to `backend/backend.pid`; logs to `backend/backend.log`. Use `bun run backend:stop` to clean up.
