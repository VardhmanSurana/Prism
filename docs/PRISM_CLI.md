# Prism CLI

The `prism` command is a command-line companion for Prism's photo-management backend. It is installed with the backend package and provides import, search, metadata, and server operations directly from the terminal.

## Installation

The CLI entry point is registered in the backend package:

```bash
prism --help
```

If the backend virtual environment is active, `prism` is available globally. Otherwise:

```bash
cd backend
uv run prism --help
```

## Global Options

| Option | Description |
| --- | --- |
| `--json` | Print results as JSON instead of human-readable tables or text |
| `-v`, `--verbose` | Show detailed progress and error output |

Most commands output a concise summary by default and switch to JSON when `--json` is passed.

## Command Reference

### `prism import <path>`

Import photos or videos from a file or directory into the Prism library.

```bash
prism import ~/Pictures/vacation
prism import ~/Pictures/photo.heic
```

Behavior:
- Accepts a single file or a directory.
- Recursively scans directories for supported image and video formats.
- Deduplicates by path and by content hash.
- Generates thumbnails and extracts metadata (EXIF, GPS, dimensions, MIME, blur score).
- For videos, extracts duration, FPS, codec, and audio codec.
- Writes a `Photo` record to SQLite and emits a `new_photo` SSE event when the server is running.

Output summary:
```
Found 42 file(s) to import.
Done: 38 imported, 4 skipped, 0 errors (out of 42)
```

### `prism index`

Queue unprocessed photos for background analysis jobs (face detection, OCR, embeddings, captions).

```bash
prism index
```

This enqueues photos that do not already have a pending, processing, or completed `BackgroundJob`. To reprocess from scratch:

```bash
prism index --reprocess
```

`--reprocess` resets all existing jobs and re-enqueues every non-trashed, non-locked photo.

Jobs are executed by the background worker inside `prism serve`. Without the server running, jobs remain pending and are processed on the next server startup.

### `prism search`

Search photos using full-text search, tag filters, person names, or date ranges.

```bash
prism search "sunset beach"
prism search --tag vacation
prism search --person "Alice"
prism search --date 2024
prism search --date 2024-07
```

Search modes:
- **Full-text (`query`)**: Searches FTS5 across filename, caption, location, city, country, AI summary, auto tags, and OCR text. Falls back to caption `ILIKE` if FTS fails.
- **Tag (`--tag`)**: Matches substrings in `auto_tags`.
- **Person (`--person`)**: Joins `people` and `photo_people` for case-insensitive name matches.
- **Date (`--date`)**: Supports `YYYY` (year range) or `YYYY-MM` (month range).

Results show `[id] filename date location caption`. Use `--json` for machine-readable output.

### `prism stats`

Show aggregate library statistics.

```bash
prism stats
```

Includes:
- Total photos, images, and videos
- Favorites count
- People, albums, and events count
- Processed background-job count
- Total library size in human-readable form
- Content-type breakdown
- Oldest and newest photo dates

### `prism people`

List every known person and the number of photos tagged to them.

```bash
prism people
```

### `prism albums`

List every album with its type and photo count.

```bash
prism albums
```

### `prism export-xmp`

Export XMP sidecars for all non-trashed photos.

```bash
prism export-xmp
prism export-xmp --output ~/xmp-export
```

Without `--output`, sidecars are written alongside the original photos. With `--output`, they are written to the specified directory. Face regions stored in Prism are embedded in the XMP.

### `prism import-xmp <directory>`

Import `.xmp` sidecars from a directory into Prism's database.

```bash
prism import-xmp ~/xmp-backup
```

Matches XMP files to photos by basename. Updates captions, tags, ratings, and other XMP metadata stored in Prism.

### `prism classify`

Run content classification on all photos.

```bash
prism classify
```

Classifies each photo based on width, height, file extension, EXIF make/model, OCR text, and thumbnail. The result is written to the `content_type` column.

### `prism serve`

Start the Prism FastAPI server.

```bash
prism serve
prism serve --host 127.0.0.1 --port 8269 --reload
```

Defaults:
- Host: `0.0.0.0`
- Port: `8269`
- Uvicorn log level: `info`

Use `--reload` during development to auto-reload on code changes.

## JSON Output

Add `--json` to any data-returning command (`search`, `stats`, `people`, `albums`, `import`, `index`, `export-xmp`, `import-xmp`, `classify`) to receive structured output. This is useful for scripting and automation.

## Database Location

The CLI operates against the SQLite database configured in `backend/.env` via `DATABASE_PATH` or Prism's platform data directory:

| OS | Default data directory |
| --- | --- |
| Linux | `~/.local/share/prism` |
| macOS | `~/Library/Application Support/prism` |
| Windows | `%APPDATA%/prism` |

Tables are created automatically if they do not exist, including the FTS5 virtual table and sync triggers.

## Error Handling

- Missing paths or unsupported files produce clear `stderr` messages and exit code `1`.
- Duplicate imports (by path or hash) are skipped without inserting new records.
- Database migrations for new columns are applied automatically at startup.
- XMP import logs unmatched files as `not_found` rather than failing the entire run.
