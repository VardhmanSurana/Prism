# CLAUDE.md

## Project Overview
**Prism** is a high-performance, privacy-first, local-only desktop photo and video library application.
- **Backend**: Rust (Axum 0.7, Tokio, SQLx SQLite with WAL + FTS5, ONNX Runtime `ort` 2.0-rc.13)
- **Frontend**: React 18, TypeScript 5.8, Vite 6, Tailwind CSS 3, Zustand 5, Framer Motion, GSAP, Leaflet
- **Desktop Shell**: Tauri v2 (`frontend/src-tauri`)
- **CLI**: Rust binary (`cli/src/main.rs`)
- **AI/ML**: Local on-device ONNX inference (SigLIP2 768d embeddings, face-id/ArcFace, SAM segmentation, Florence-2 captions, PP-OCRv4, inpainting, depth estimation, denoise)

## Master Specification & Deep Architecture Document
> **CRITICAL REFERENCE FOR ALL AGENTS**: For a complete, exhaustive, zero-omission breakdown of the entire Prism codebase (18 SQLite tables, 120+ REST endpoints, in-process ONNX neural models, adaptive hardware scheduler, 11 Zustand stores, Image & Video NLE editors, LAN sync protocol, and CLI), read:  
> 📄 [docs/PRISM_MASTER_SPECIFICATION.md](file:///home/chotaxdon/Work/Projects/Prism/docs/PRISM_MASTER_SPECIFICATION.md)

## Architecture & Port Layout
- **Backend API**: `http://127.0.0.1:8269`
- **Vite Web Frontend**: `http://localhost:3005`
- **Desktop Application**: Tauri v2 embedding `frontend/dist` and spawning `prism-backend-rust`

## Build & Test Commands
### Backend (Rust)
```bash
cd backend_rust
cargo build            # Debug build
cargo build --release  # Release build
cargo run              # Start backend on 127.0.0.1:8269
cargo test             # Run backend test suite
cargo clippy           # Linting
```

### Frontend (React + Vite)
```bash
cd frontend
pnpm install           # Install dependencies
pnpm dev               # Start dev server on port 3005
pnpm build             # Production Vite build (outputs to dist/)
pnpm test              # Run unit tests (vitest)
pnpm lint              # ESLint checks
pnpm tsc               # Type-checking
```

### Desktop App (Tauri v2)
```bash
cd frontend
pnpm tauri dev         # Run Tauri desktop app with hot reload
pnpm tauri build       # Package desktop application (deb/rpm/appimage)
```

### CLI
```bash
cd cli
cargo build --release
./target/release/prism status
```

## Key Code Conventions
- **Zero Speculation**: Strict validation against database schema and actual filesystem paths.
- **Database Safety**: SQLx parameterized queries with PRAGMA foreign_keys = ON, journal_mode = WAL, synchronous = NORMAL.
- **Resource Constraints**: Hardware-aware job scheduling (battery status, CPU thresholds, memory-conscious model execution).
