# Prism — TODO (Non-Editing)

Tracks cleanup, docs, and hygiene work that is **not** part of the photo editing
feature (`frontend/components/Editing/`). The editing module's optimization pass
is tracked inline in commit history; this file is for everything else.

Items are grouped by priority, not by file. Check off as you complete them.

---

## 🔒 P0 — Privacy-first cleanup

The privacy-first, fully-local principle is the project's core contract. These
items leak stale Google Gemini references into the codebase and must go.

- [ ] **Remove Gemini env defines from `frontend/vite.config.ts:26-29`**
  - The `define` block exposes `process.env.API_KEY` and `process.env.GEMINI_API_KEY`
  - Privacy-first means no Google AI calls — these must be deleted
  - If the `define` block becomes empty after removal, drop the key too
  - Also check the `envPrefix: ['VITE_', 'TAURI_']` on line 22 is still appropriate
    (no `VITE_GEMINI_*` slipped in via another file)

- [ ] **Rewrite `frontend/README.md` (currently 100% Gemini AI Studio template)**
  - Title says "Run and deploy your AI Studio app"
  - Links to `ai.studio/apps/drive/1MX2sm10sBpGJQZNu27W9wt6YAnXZF7J-`
  - Instructs users to set `GEMINI_API_KEY` in `.env.local`
  - GHBanner image is the Google AI Studio hero
  - Action: replace with a real frontend README covering:
    - Stack (React 18 / TS / Vite 6 / Tauri 2)
    - Setup (`bun install`, `bun run dev`)
    - Tauri integration notes (CORS origins, no remote API)
    - Build (`bun run build`) and preview
    - Project structure highlights (components/, lib/, stores/)

---

## 📝 P1 — Documentation accuracy

- [ ] **Fix `backend/README.md:27` — wrong face-recognition library**
  - Current: *"It uses the InsightFace `buffalo_l` model for state-of-the-art
    face detection and embedding extraction."*
  - Actual: **InspireFace** (C++ SDK) is wired up
    - `backend/pyproject.toml` pins `inspireface>=1.2.3.post5`
    - Imported in `backend/app/services/face_sdk.py` and `face_detection.py`
  - Action: rewrite line 27 to reference InspireFace. Keep the CUDA-12 /
    `LD_LIBRARY_PATH` / `run-desktop.sh` guidance — that part is correct.

---

## 🧹 P2 — TypeScript hygiene (pre-existing errors)

`bunx tsc --noEmit` reports 3 errors project-wide. The editing one is tracked
elsewhere (see "Out of scope"). These two are non-editing and should be cleared.

- [ ] **Fix `frontend/components/LazyImage.tsx:12` — missing React namespace**
  - Error TS2503: Cannot find namespace 'React'
  - Most likely fix: add `import * as React from 'react'` at the top, or
    replace `React.X` usages with named imports (`useState`, `useRef`, etc.)
  - Verify with a re-run of `bunx tsc --noEmit` after the change

- [ ] **Fix `frontend/constants.ts:1` — missing Vite client types**
  - Error TS2339: Property 'env' does not exist on type 'ImportMeta'
  - Cause: no `/// <reference types="vite/client" />` triple-slash directive
  - Most likely fix: add the reference at the top of the file, or add it to
    `frontend/src/vite-env.d.ts` and make sure it's included in `tsconfig`

---

## ❌ Out of scope (editing-feature work)

These items are part of the editing module and tracked separately from this
file. Listed here only so they don't get lost.

- `React.memo` for `components/Editing/*` panel children (to actually benefit
  from `useCallback` on parent handlers)
- Magic `setTimeout(50ms)` / `setTimeout(100ms)` comments in `EditingMode.tsx`
  (likely Cropper.js redraw workarounds — verify, then add named constants)

---

## ✅ Resolved

- **Removed `frontend/components/Editing/test/adjustments.test.ts`**
  - The `bun:test` type error (TS2307) it triggered is gone
  - Empty `test/` directory also cleaned up
  - Resolves the third pre-existing tsc error
  - No replacement tests added — the editing module has no test suite yet

---

## 📋 Verification

After completing P0 items, run:

```bash
cd /home/chotaxdon/Work/Projects/Prism
# Privacy check — should return nothing
rg -i "gemini|google.*ai|ai.*studio" frontend/ backend/
# Build still green
cd frontend && bun run build
```

After P1: `rg -i "insightface|buffalo" backend/` should return nothing.

After P2: `bunx tsc --noEmit` in `frontend/` should report **0 errors**
(was 3, the editing bun:test one is already resolved — see "Resolved" section).
