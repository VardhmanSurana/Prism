# Prism CLI

Prism ships a **Rust CLI** (`prism`) that talks to the running Rust backend's REST API. It is a thin, self-contained binary — no Python or `uv` required.

## Build & run

```bash
# from the prism-desktop root
pnpm run cli -- --help          # build + run via cargo
# or directly:
cd cli && cargo run -- --help
# or build a release binary:
pnpm run cli:build && ./cli/target/release/prism --help
```

The CLI requires the backend to be running (`./run-web.sh`, `./run-desktop.sh`, or `pnpm run backend`).

## Configuration

| Option | Description |
| --- | --- |
| `--api-url <url>` | Backend base URL, default `http://127.0.0.1:8269` (env: `PRISM_API_URL`) |
| `--json` | Print raw JSON instead of human-readable tables |
| `-v`, `--verbose` | Show the request URL and full error detail |

## Commands

| Command | Endpoint | Description |
| --- | --- | --- |
| `prism status` | `GET /health` + `GET /api/v1/photos/stats` | Backend health + library stats |
| `prism stats` | `GET /api/v1/photos/stats` | Library statistics |
| `prism photos [--limit N]` | `GET /api/v1/photos?limit=N` | List recent photos |
| `prism photo <id>` | `GET /api/v1/photos/:id` | Show a single photo's metadata (id or uuid) |
| `prism search [query] [--limit N]` | `GET /api/v1/utilities/search/fused` | Fused metadata + semantic search |
| `prism people` | `GET /api/v1/people` | List known people |
| `prism albums` | `GET /api/v1/albums` | List albums |

## Command Details

- **`prism status`** — Backend health plus library stats in one call. Prints the backend status, service, version, and database state.
- **`prism stats`** — Aggregate library statistics: photo/video counts, favorites, trash, locked, and total storage used.
- **`prism photos --limit N`** — List the most recent photos (default `--limit 25`).
- **`prism photo <id>`** — Full metadata for one photo, by numeric id or UUID.
- **`prism search [query] --limit N`** — Fused search across metadata, captions, people, albums, OCR text, and semantic embeddings. Omit the query to list recent photos.
- **`prism people`** / **`prism albums`** — List known people and albums.

All commands accept `--json` for machine-readable output.

## JSON Output

Add `--json` to any data-returning command (`status`, `stats`, `photos`, `photo`, `search`, `people`, `albums`) to receive structured output. This is useful for scripting and automation.

## Database Location

The CLI operates against the running backend, which reads its database configuration from `backend_rust/src/config.rs` or Prism's platform data directory:

| OS | Default data directory |
| --- | --- |
| Linux | `~/.local/share/prism` |
| macOS | `~/Library/Application Support/prism` |
| Windows | `%APPDATA%/prism` |

## Error Handling

- If the backend is not reachable, the CLI prints a clear error and exits with code `1`.
- Responses that do not match the expected shape produce a descriptive error.
- `--verbose` prints the request URL and full error detail for debugging.
