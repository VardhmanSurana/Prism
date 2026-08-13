# prism-cli

A thin command-line client for **Prism**. It talks to the running Rust backend's
REST API (`http://127.0.0.1:8269` by default) — so the backend must be up
(`./run-web.sh`, `./run-desktop.sh`, or `pnpm run backend`).

> This is the **thin REST-client** CLI. A fuller **offline, direct-DB** port that
> reuses the backend's internal modules (no server required) is planned next.

## Build & run

```bash
# from the project root
cd cli
cargo run -- --help

# or, after building, use the `prism` binary directly:
cargo build --release
./target/release/prism --help
```

## Configuration

- `--api-url <url>` (or env `PRISM_API_URL`) — backend base URL, default `http://127.0.0.1:8269`
- `--json` — print raw JSON instead of human-readable tables/text
- `-v` / `--verbose` — show the request URL and full error detail

## Commands

| Command | Endpoint | Description |
| --- | --- | --- |
| `prism status` | `GET /health` + `GET /api/v1/photos/stats` | Backend health + library stats |
| `prism stats` | `GET /api/v1/photos/stats` | Library statistics |
| `prism photos [--limit N]` | `GET /api/v1/photos` | List recent photos |
| `prism photo <id>` | `GET /api/v1/photos/:id` | Show a single photo's metadata |
| `prism search <query> [--limit N]` | `GET /api/v1/utilities/search/fused` | Fused metadata search |
| `prism people` | `GET /api/v1/people` | List known people |
| `prism albums` | `GET /api/v1/albums` | List albums |
| `prism import <path> [--recursive]` | `POST /api/v1/photos/expand-directory` | Directory scanning and photo expansion |
| `prism export -o <dir> [--album-id N]` | `POST /api/v1/photos/export` | Export photos to an output directory |
| `prism config [key] [value]` | `GET /api/v1/settings` / `POST /api/v1/settings/general` | Read all settings or update key-value pair |
| `prism purge-trash` | `POST /api/v1/utilities/purge-trash` | Permanently purge trashed photos |
| `prism diagnostics` | `GET /api/v1/utilities/diagnostics` | Fetch system diagnostics & metrics |

`<id>` accepts either the numeric id or the uuid.

## Examples

```bash
# Expand and scan a directory for photo files
prism import /home/user/Pictures/Vacation

# Export photos from album 1 to output directory
prism export --album-id 1 -o /tmp/export

# Read all backend settings
prism config

# Update a setting key-value pair
prism config ENABLE_AI_CLIP false

# Purge trashed items permanently
prism purge-trash

# Fetch system diagnostics
prism diagnostics
```
