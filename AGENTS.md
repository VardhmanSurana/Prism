# AGENTS.md

This file provides guidance for AI coding agents working on the Prism codebase.

## Project Overview

**Prism** is a privacy-first, local-only desktop photo and video library application built with:
- **Frontend**: React 18 + TypeScript 5.8 + Vite 6 + Tailwind CSS
- **Backend**: Rust (Axum) + SQLite (WAL + FTS5)
- **Desktop Shell**: Tauri v2
- **ML/AI**: ONNX Runtime (SigLIP2, face-id, segmentation, inpainting)

## Architecture Quick Reference

```
┌─────────────────────────────────────────────────┐
│              Tauri v2 Desktop Shell               │
│       Vite React UI (port 3005)                  │
└───────────────────────┬─────────────────────────┘
                        │ HTTP (127.0.0.1:8269)
┌───────────────────────┴───────────────────────────┐
│             Rust (Axum) Backend                    │
│  Routes → Services → SQLite + File System         │
└────────────────────────────────────────────────────┘
```

## Key Files & Directories

### Frontend (`frontend/`)
| Path | Purpose |
|------|---------|
| `App.tsx` | Main React app entry |
| `types.ts` | Core TypeScript types (Photo, Album, ViewMode) |
| `constants.ts` | API_BASE, resolveUrl helpers |
| `components/` | UI components organized by feature |
| `hooks/` | Custom React hooks |
| `store/` | Zustand state stores |
| `services/` | API client, event system |

### Backend (`backend_rust/src/`)
| Path | Purpose |
|------|---------|
| `main.rs` | Axum app factory, server startup |
| `config.rs` | Configuration from env vars |
| `db.rs` | SQLite pool, table creation, migrations |
| `models.rs` | Data structs |
| `routes/mod.rs` | Router composition, middleware |
| `routes/photos/` | Photo CRUD, upload, metadata |
| `routes/photos_ai.rs` | AI photo endpoints |
| `routes/agent.rs` | AI agent sessions and chat |
| `routes/nle.rs` | Video project CRUD, export |
| `services/` | Business logic (ML, thumbnails, etc.) |

### CLI (`cli/`)
| Path | Purpose |
|------|---------|
| `src/main.rs` | Thin REST client for the backend |

## Development Commands

### Frontend
```bash
cd frontend
pnpm install          # Install dependencies
pnpm dev              # Start Vite dev server (port 3005)
pnpm build            # Production build
pnpm test             # Run tests (vitest)
pnpm lint             # Run linter (eslint)
pnpm tsc              # Type check
```

### Backend
```bash
cd backend_rust
cargo build           # Debug build
cargo build --release # Release build
cargo run             # Start server (port 8269)
cargo test            # Run tests
cargo clippy          # Lint
cargo fmt             # Format
```

### CLI
```bash
cd cli
cargo build --release
./target/release/prism status
```

### Run Scripts
```bash
./run-web.sh          # Start backend + Vite (web mode)
./run-desktop.sh      # Start backend + Tauri (desktop mode)
```

## Code Conventions

### TypeScript/Frontend
- **State Management**: Zustand stores in `store/`
- **Component Organization**: Feature-based folders in `components/`
- **Type Safety**: Strict TypeScript, explicit types for props
- **Styling**: Tailwind CSS utility classes
- **State Updates**: Immutable updates with spread operator

### Rust/Backend
- **Async**: Tokio runtime for all async operations
- **Error Handling**: `Result<T, E>` with `anyhow` for application errors
- **Database**: SQLx with compile-time query checking
- **Serialization**: Serde for JSON
- **API**: Axum handlers with proper error responses

### Common Patterns
```typescript
// Frontend: API call
const response = await fetch(`${API_BASE}/api/v1/photos`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
});
const data = await response.json();

// Backend: Handler
async fn handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Request>,
) -> Result<Json<Response>, StatusCode> {
    // ...
    Ok(Json(response))
}
```

## Testing

### Frontend Tests
```bash
cd frontend
pnpm test                    # Run all tests
pnpm test -- --watch         # Watch mode
pnpm test -- --coverage      # Coverage report
```

### Backend Tests
```bash
cd backend_rust
cargo test                   # Run all tests
cargo test -- --nocapture    # Show output
```

## Git Workflow

### Branch Naming
- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `docs/description` — Documentation updates

### Commit Messages
```
feat(scope): description

- Detail 1
- Detail 2

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>
```

### Scopes
- `frontend` — Frontend changes
- `backend` — Backend changes
- `cli` — CLI changes
- `ai` — AI/ML features
- `nle` — Video editor
- `ui` — UI components
- `api` — API changes

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Backend bind host |
| `PORT` | `8269` | Backend bind port |
| `DATABASE_URL` | `sqlite://prism.db` | SQLite database URL |
| `UPLOAD_DIR` | `uploads` | Media upload directory |
| `THUMBNAILS_DIR` | `thumbnails` | Thumbnail storage |
| `API_KEY` | *(empty)* | Optional API key |
| `GPU_MODE` | `cpu` | GPU mode (cpu/cuda/metal) |
| `RUST_LOG` | `info` | Log level |

## Common Tasks

### Add New API Endpoint
1. Add handler function in `backend_rust/src/routes/`
2. Add route in `backend_rust/src/routes/mod.rs`
3. Add types in `backend_rust/src/models.rs`
4. Add frontend API call in `frontend/services/apiClient.ts`

### Add New UI Component
1. Create component in `frontend/components/`
2. Export from `index.ts`
3. Add to relevant view in `frontend/components/layout/MainContent.tsx`

### Add New Zustand Store
1. Create store in `frontend/store/`
2. Export hook and actions
3. Import in components that need it

### Add New Database Table
1. Add migration in `backend_rust/src/db.rs`
2. Add model struct in `backend_rust/src/models.rs`
3. Add CRUD handlers in `backend_rust/src/routes/`

## Performance Tips

### Frontend
- Use `React.memo` for expensive components
- Use `useMemo`/`useCallback` for expensive computations
- Virtualize long lists with TanStack Virtual
- Lazy load heavy components

### Backend
- Use connection pooling for database
- Use background tasks for heavy processing
- Cache frequently accessed data
- Use streaming for large responses

## Security Considerations

- Never commit secrets (API keys, passwords)
- Use environment variables for sensitive config
- Validate all user input
- Use parameterized queries (SQLx handles this)
- Rate limit expensive endpoints
- CORS only allows specific origins

## Debugging

### Frontend
```bash
# Enable debug mode
localStorage.setItem('prism-debug', 'true')

# Check React DevTools
# Install React DevTools browser extension
```

### Backend
```bash
# Enable debug logging
RUST_LOG=debug cargo run

# Check logs
tail -f backend_rust/backend.log
```

### Database
```bash
# Open SQLite CLI
sqlite3 backend_rust/prism.db

# Common queries
.tables
.schema photos
SELECT COUNT(*) FROM photos;
```

## Getting Help

- **Documentation**: See `docs/` directory
- **Code Comments**: Check inline comments
- **Type Definitions**: Refer to `types.ts` and `models.rs`
- **Examples**: Look at existing handlers and components
