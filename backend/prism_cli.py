#!/usr/bin/env python3
"""
prism — CLI companion for Prism photo management.

Usage:
    prism import <path>          Import photos from a directory or file
    prism index                  Process unprocessed photos (face, OCR, embeddings)
    prism index --reprocess      Reprocess all photos
    prism search <query>         Full-text search the library
    prism search --tag <tag>     Search by tag
    prism search --person <name> Search by person
    prism search --date <date>   Search by date (YYYY or YYYY-MM)
    prism stats                  Show library statistics
    prism export-xmp             Export XMP sidecars
    prism import-xmp <dir>       Import XMP sidecars from a directory
    prism classify               Run content classification
    prism people                 List all people
    prism albums                 List all albums
    prism serve                  Start the FastAPI server
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure we're running from the backend directory or adjust path
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.config import settings
from app.db import init_db, async_session
from app.models import (
    Base, Photo, Person, PhotoPerson, Album, BackgroundJob,
    Event
)
from sqlalchemy import select, func, text, update, delete
from sqlalchemy.orm import selectinload
from app.services.sync.handler import SUPPORTED_EXTENSIONS


def _fmt_size(size_bytes: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(size_bytes) < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def _print_json(data):
    """Print data as JSON."""
    print(json.dumps(data, indent=2, default=str))


def _print_table(headers, rows, indent=2):
    """Print a simple text table."""
    if not rows:
        print("  (no results)")
        return
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))
    prefix = " " * indent
    header_line = prefix + "  ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    print(header_line)
    print(prefix + "  ".join("-" * col_widths[i] for i in range(len(headers))))
    for row in rows:
        print(prefix + "  ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row)))


async def _init_database():
    """Initialize database with WAL mode and create tables."""
    await init_db()
    async with settings.DATABASE_FILE.parent.joinpath("_init").open("w") as f:
        pass
    async with engine_context() as conn:
        pass


class engine_context:
    """Minimal context manager for DB init."""
    def __init__(self):
        from app.db import engine
        self._engine = engine

    async def __aenter__(self):
        return self._engine

    async def __aexit__(self, *args):
        pass


async def _ensure_db():
    """Create tables if they don't exist."""
    from app.db import engine
    await init_db()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Dynamic migrations (same as main.py)
        from sqlalchemy import text
        res = await conn.execute(text("PRAGMA table_info(photos)"))
        columns = [row[1] for row in res.fetchall()]
        migrations = [
            ("blur_score", "ALTER TABLE photos ADD COLUMN blur_score FLOAT"),
            ("file_size", "ALTER TABLE photos ADD COLUMN file_size INTEGER"),
            ("auto_tags", "ALTER TABLE photos ADD COLUMN auto_tags TEXT"),
            ("embedding", "ALTER TABLE photos ADD COLUMN embedding TEXT"),
            ("event_id", "ALTER TABLE photos ADD COLUMN event_id INTEGER"),
            ("ocr_text", "ALTER TABLE photos ADD COLUMN ocr_text TEXT"),
            ("duration", "ALTER TABLE photos ADD COLUMN duration FLOAT"),
            ("fps", "ALTER TABLE photos ADD COLUMN fps FLOAT"),
            ("codec", "ALTER TABLE photos ADD COLUMN codec VARCHAR(50)"),
            ("audio_codec", "ALTER TABLE photos ADD COLUMN audio_codec VARCHAR(50)"),
            ("video_faces_scanned", "ALTER TABLE photos ADD COLUMN video_faces_scanned BOOLEAN DEFAULT 0"),
            ("animated_url", "ALTER TABLE photos ADD COLUMN animated_url VARCHAR(512)"),
            ("phash", "ALTER TABLE photos ADD COLUMN phash VARCHAR(64)"),
            ("content_type", "ALTER TABLE photos ADD COLUMN content_type VARCHAR(20) DEFAULT 'photo'"),
            ("exif_make", "ALTER TABLE photos ADD COLUMN exif_make VARCHAR(255)"),
            ("exif_model", "ALTER TABLE photos ADD COLUMN exif_model VARCHAR(255)"),
        ]
        for col, sql in migrations:
            if col not in columns:
                await conn.execute(text(sql))

        # Album migrations
        album_cols_res = await conn.execute(text("PRAGMA table_info(albums)"))
        album_columns = [row[1] for row in album_cols_res.fetchall()]
        if "is_smart" not in album_columns:
            await conn.execute(text("ALTER TABLE albums ADD COLUMN is_smart BOOLEAN DEFAULT 0"))
        if "smart_type" not in album_columns:
            await conn.execute(text("ALTER TABLE albums ADD COLUMN smart_type VARCHAR(20)"))

        # BackgroundJob migrations
        bgjob_cols_res = await conn.execute(text("PRAGMA table_info(background_jobs)"))
        bgjob_columns = [row[1] for row in bgjob_cols_res.fetchall()]
        if "current_stage" not in bgjob_columns:
            await conn.execute(text("ALTER TABLE background_jobs ADD COLUMN current_stage VARCHAR(50)"))
        if "stage_progress" not in bgjob_columns:
            await conn.execute(text("ALTER TABLE background_jobs ADD COLUMN stage_progress TEXT"))

        # FTS5 table
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename, caption, location, city, country,
                ai_summary, auto_tags, ocr_text
            )
        """))

        # Sync triggers for FTS
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS photos_ai AFTER INSERT ON photos BEGIN
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags, ocr_text)
                VALUES (new.id, new.filename, new.caption, new.location, new.city, new.country, new.ai_summary, new.auto_tags, new.ocr_text);
            END
        """))
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS photos_au AFTER UPDATE ON photos BEGIN
                UPDATE photos_fts SET
                    filename = new.filename, caption = new.caption, location = new.location,
                    city = new.city, country = new.country, ai_summary = new.ai_summary,
                    auto_tags = new.auto_tags, ocr_text = new.ocr_text
                WHERE photo_id = new.id;
            END
        """))
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS photos_ad AFTER DELETE ON photos BEGIN
                DELETE FROM photos_fts WHERE photo_id = old.id;
            END
        """))


# ──────────────────────────────────────────────────────────────────
# Import command
# ──────────────────────────────────────────────────────────────────

async def cmd_import(args):
    """Import photos from a file or directory."""
    target = Path(args.path).resolve()
    if not target.exists():
        print(f"Error: {target} does not exist", file=sys.stderr)
        sys.exit(1)

    files = []
    if target.is_file():
        if target.suffix.lower() in SUPPORTED_EXTENSIONS:
            files = [target]
        else:
            print(f"Error: {target.suffix} is not a supported file type", file=sys.stderr)
            sys.exit(1)
    else:
        for root, dirs, filenames in os.walk(target):
            for fname in filenames:
                fp = Path(root) / fname
                if fp.suffix.lower() in SUPPORTED_EXTENSIONS:
                    files.append(fp)
        files.sort()

    if not files:
        print("No supported files found.")
        return

    print(f"Found {len(files)} file(s) to import.")
    await _ensure_db()

    from app.services.sync.tasks import process_image_task, process_video_task
    from app.services.sync.handler import is_video_file

    imported = 0
    skipped = 0
    errors = 0
    total = len(files)

    async with async_session() as db:
        for i, fp in enumerate(files, 1):
            file_path = str(fp)

            # Check duplicate by path
            stmt = select(Photo).where(Photo.path == file_path)
            res = await db.execute(stmt)
            if res.scalar_one_or_none():
                skipped += 1
                if args.verbose:
                    print(f"  [{i}/{total}] Skip (exists): {fp.name}")
                continue

            if not args.json:
                print(f"\r  [{i}/{total}] Importing: {fp.name}...", end="", flush=True)

            try:
                task_fn = process_video_task if is_video_file(file_path) else process_image_task
                loop = asyncio.get_running_loop()
                pool_result = await loop.run_in_executor(
                    None, task_fn, file_path, str(settings.THUMBNAILS_DIR)
                )

                if not pool_result or not pool_result[0]:
                    errors += 1
                    if args.verbose:
                        print(f" (metadata failed)", end="")
                    continue

                metadata, thumb_url = pool_result
                file_hash = metadata.get("hash")

                # Check duplicate by hash
                if file_hash:
                    hash_stmt = select(Photo).where(Photo.hash == file_hash)
                    hash_res = await db.execute(hash_stmt)
                    if hash_res.scalar_one_or_none():
                        skipped += 1
                        if args.verbose:
                            print(f" (duplicate hash)", end="")
                        continue

                new_photo = Photo(
                    filename=fp.name,
                    path=file_path,
                    url=thumb_url if thumb_url else f"local://{file_path}",
                    hash=file_hash,
                    phash=metadata.get("phash"),
                    width=metadata["width"],
                    height=metadata["height"],
                    aspect_ratio=metadata["aspect_ratio"],
                    mime_type=metadata["mime_type"],
                    file_type=metadata.get("file_type", "image"),
                    caption=metadata.get("caption"),
                    date=metadata.get("date_taken", datetime.now(timezone.utc)),
                    date_taken=metadata.get("date_taken", datetime.now(timezone.utc)),
                    upload_date=datetime.now(timezone.utc),
                    city=metadata.get("city"),
                    state=metadata.get("state"),
                    country=metadata.get("country"),
                    location=metadata.get("location"),
                    latitude=metadata.get("latitude"),
                    longitude=metadata.get("longitude"),
                    device_id=None,
                    is_external=not file_path.startswith(str(Path.home())),
                    blur_score=metadata.get("blur_score"),
                    file_size=metadata.get("file_size"),
                    exif_make=metadata.get("exif_make"),
                    exif_model=metadata.get("exif_model"),
                    duration=metadata.get("duration"),
                    fps=metadata.get("fps"),
                    codec=metadata.get("codec"),
                    audio_codec=metadata.get("audio_codec"),
                    animated_url=metadata.get("animated_url"),
                )

                db.add(new_photo)
                await db.commit()
                imported += 1
            except Exception as e:
                await db.rollback()
                errors += 1
                if args.verbose:
                    print(f" Error: {e}", file=sys.stderr)

    # Clear the progress line
    if not args.json:
        print("\r" + " " * 60 + "\r", end="")

    if args.json:
        _print_json({"imported": imported, "skipped": skipped, "errors": errors, "total_found": total})
    else:
        print(f"Done: {imported} imported, {skipped} skipped, {errors} errors (out of {total})")


# ──────────────────────────────────────────────────────────────────
# Index command
# ──────────────────────────────────────────────────────────────────

async def cmd_index(args):
    """Run background processing on photos."""
    await _ensure_db()

    async with async_session() as db:
        if args.reprocess:
            # Reset all jobs
            await db.execute(update(BackgroundJob).values(status="pending", attempt_count=0, last_error=None))
            await db.commit()

            # Find photos without jobs
            stmt = select(Photo.id).where(
                Photo.is_trash == False,
                Photo.is_locked == False,
                ~Photo.id.in_(select(BackgroundJob.photo_id))
            )
        else:
            stmt = select(Photo.id).where(
                Photo.is_trash == False,
                Photo.is_locked == False,
                ~Photo.id.in_(
                    select(BackgroundJob.photo_id).where(
                        BackgroundJob.status.in_(["pending", "processing", "completed"])
                    )
                )
            )

        res = await db.execute(stmt)
        photo_ids = [row[0] for row in res.fetchall()]

        if not photo_ids:
            print("No photos to process.")
            if args.json:
                _print_json({"queued": 0})
            return

        # Enqueue all
        for pid in photo_ids:
            job = BackgroundJob(photo_id=pid, job_type="sequential_analysis", status="pending")
            db.add(job)
        await db.commit()

    if args.json:
        _print_json({"queued": len(photo_ids)})
    else:
        print(f"Queued {len(photo_ids)} photo(s) for processing.")
        print("Start the server (prism serve) to run the background worker,")
        print("or the jobs will process on next server startup.")


# ──────────────────────────────────────────────────────────────────
# Search command
# ──────────────────────────────────────────────────────────────────

def _sanitize_fts5_query(query: str) -> str:
    """Sanitize a query for FTS5 MATCH."""
    # Remove FTS5 special characters
    cleaned = query.replace('"', '').replace("'", "").replace("*", "").replace("(", "").replace(")", "")
    terms = cleaned.split()
    if not terms:
        return ""
    return " ".join(f'"{t}"' for t in terms)


async def cmd_search(args):
    """Search photos by text, tag, person, or date."""
    await _ensure_db()

    async with async_session() as db:
        results = []

        if args.person:
            # Search by person name
            stmt = (
                select(Photo)
                .join(PhotoPerson, PhotoPerson.photo_id == Photo.id)
                .join(Person, Person.id == PhotoPerson.person_id)
                .where(Person.name.ilike(f"%{args.person}%"))
                .where(Photo.is_trash == False)
                .order_by(Photo.date_taken.desc())
            )
            res = await db.execute(stmt)
            photos = res.scalars().unique().all()
            results = [_photo_to_dict(p) for p in photos]

        elif args.tag:
            # Search by tag in auto_tags
            tag = args.tag.lower()
            stmt = select(Photo).where(
                Photo.is_trash == False,
                Photo.auto_tags.ilike(f"%{tag}%")
            ).order_by(Photo.date_taken.desc())
            res = await db.execute(stmt)
            photos = res.scalars().all()
            results = [_photo_to_dict(p) for p in photos]

        elif args.date:
            # Search by date prefix (YYYY or YYYY-MM)
            date_str = args.date
            stmt = select(Photo).where(Photo.is_trash == False)
            if len(date_str) == 4:
                stmt = stmt.where(Photo.date_taken >= f"{date_str}-01-01")
                stmt = stmt.where(Photo.date_taken < f"{int(date_str)+1}-01-01")
            elif len(date_str) == 7:
                year, month = date_str.split("-")
                stmt = stmt.where(Photo.date_taken >= f"{date_str}-01")
                if int(month) == 12:
                    stmt = stmt.where(Photo.date_taken < f"{int(year)+1}-01-01")
                else:
                    stmt = stmt.where(Photo.date_taken < f"{year}-{int(month)+1:02d}-01")
            else:
                print("Error: date must be YYYY or YYYY-MM format", file=sys.stderr)
                sys.exit(1)
            stmt = stmt.order_by(Photo.date_taken.desc())
            res = await db.execute(stmt)
            photos = res.scalars().all()
            results = [_photo_to_dict(p) for p in photos]

        elif args.query:
            # Full-text search
            fts_query = _sanitize_fts5_query(args.query)
            if fts_query:
                try:
                    fts_stmt = text(
                        "SELECT f.photo_id FROM photos_fts f "
                        "JOIN photos p ON f.photo_id = p.id "
                        "WHERE f.photos_fts MATCH :query AND p.is_trash = 0 "
                        "ORDER BY rank LIMIT 100"
                    )
                    fts_res = await db.execute(fts_stmt, {"query": fts_query})
                    photo_ids = [row[0] for row in fts_res.fetchall()]

                    if photo_ids:
                        stmt = select(Photo).where(Photo.id.in_(photo_ids))
                        res = await db.execute(stmt)
                        photos = res.scalars().all()
                        # Preserve FTS order
                        photo_map = {p.id: p for p in photos}
                        results = [_photo_to_dict(photo_map[pid]) for pid in photo_ids if pid in photo_map]
                except Exception as e:
                    print(f"  FTS search failed: {e}. Trying caption fallback...", file=sys.stderr)

            if not results:
                # Fallback to caption ILIKE
                ilike_q = args.query.replace("%", "\\%").replace("_", "\\_")[:50]
                stmt = select(Photo).where(
                    Photo.caption.ilike(f"%{ilike_q}%"),
                    Photo.is_trash == False
                ).order_by(Photo.date_taken.desc()).limit(100)
                res = await db.execute(stmt)
                photos = res.scalars().all()
                results = [_photo_to_dict(p) for p in photos]

        if args.json:
            _print_json(results)
        else:
            if not results:
                print("No results found.")
            else:
                print(f"Found {len(results)} photo(s):\n")
                for r in results:
                    date_str = r.get("date_taken", r.get("date", ""))[:10] if r.get("date_taken") or r.get("date") else "unknown"
                    loc = r.get("location") or ""
                    caption = r.get("caption") or ""
                    print(f"  [{r['id']}] {r['filename']}  {date_str}  {loc}")
                    if caption:
                        print(f"       {caption[:80]}")
                print()


def _photo_to_dict(photo) -> dict:
    """Convert a Photo model instance to a dict for output."""
    return {
        "id": photo.id,
        "filename": photo.filename,
        "path": photo.path,
        "date_taken": str(photo.date_taken) if photo.date_taken else None,
        "date": str(photo.date) if photo.date else None,
        "caption": photo.caption,
        "location": photo.location,
        "city": photo.city,
        "state": photo.state,
        "country": photo.country,
        "is_favorite": photo.is_favorite,
        "content_type": photo.content_type,
        "mime_type": photo.mime_type,
        "file_type": photo.file_type,
        "width": photo.width,
        "height": photo.height,
        "file_size": photo.file_size,
        "auto_tags": photo.auto_tags,
    }


# ──────────────────────────────────────────────────────────────────
# Stats command
# ──────────────────────────────────────────────────────────────────

async def cmd_stats(args):
    """Show library statistics."""
    await _ensure_db()

    async with async_session() as db:
        total_photos = (await db.execute(
            select(func.count(Photo.id)).where(Photo.is_trash == False)
        )).scalar() or 0

        total_images = (await db.execute(
            select(func.count(Photo.id)).where(Photo.is_trash == False, Photo.file_type == "image")
        )).scalar() or 0

        total_videos = (await db.execute(
            select(func.count(Photo.id)).where(Photo.is_trash == False, Photo.file_type == "video")
        )).scalar() or 0

        total_favorites = (await db.execute(
            select(func.count(Photo.id)).where(Photo.is_trash == False, Photo.is_favorite == True)
        )).scalar() or 0

        total_people = (await db.execute(
            select(func.count(Person.id))
        )).scalar() or 0

        total_albums = (await db.execute(
            select(func.count(Album.id))
        )).scalar() or 0

        total_events = (await db.execute(
            select(func.count(Event.id))
        )).scalar() or 0

        processed_faces = (await db.execute(
            select(func.count(BackgroundJob.id)).where(
                BackgroundJob.job_type == "sequential_analysis",
                BackgroundJob.status == "completed"
            )
        )).scalar() or 0

        total_size = (await db.execute(
            select(func.sum(Photo.file_size)).where(Photo.is_trash == False)
        )).scalar() or 0

        # Content type breakdown
        content_types = (await db.execute(
            select(Photo.content_type, func.count(Photo.id))
            .where(Photo.is_trash == False)
            .group_by(Photo.content_type)
        )).all()

        # Date range
        oldest = (await db.execute(
            select(func.min(Photo.date_taken)).where(Photo.is_trash == False)
        )).scalar()
        newest = (await db.execute(
            select(func.max(Photo.date_taken)).where(Photo.is_trash == False)
        )).scalar()

    if args.json:
        _print_json({
            "total_photos": total_photos,
            "total_images": total_images,
            "total_videos": total_videos,
            "total_favorites": total_favorites,
            "total_people": total_people,
            "total_albums": total_albums,
            "total_events": total_events,
            "processed_photos": processed_faces,
            "total_size_bytes": total_size,
            "total_size_human": _fmt_size(total_size) if total_size else "0 B",
            "content_types": {ct: count for ct, count in content_types},
            "oldest_photo": str(oldest) if oldest else None,
            "newest_photo": str(newest) if newest else None,
        })
    else:
        print("Prism Library Statistics")
        print("=" * 40)
        print(f"  Photos:        {total_photos}")
        print(f"    Images:      {total_images}")
        print(f"    Videos:      {total_videos}")
        print(f"  Favorites:     {total_favorites}")
        print(f"  People:        {total_people}")
        print(f"  Albums:        {total_albums}")
        print(f"  Events:        {total_events}")
        print(f"  Processed:     {processed_faces}")
        print(f"  Total Size:    {_fmt_size(total_size) if total_size else '0 B'}")
        if content_types:
            print(f"\n  Content Types:")
            for ct, count in content_types:
                print(f"    {ct}: {count}")
        if oldest:
            print(f"\n  Date Range:    {str(oldest)[:10]} to {str(newest)[:10]}")


# ──────────────────────────────────────────────────────────────────
# People command
# ──────────────────────────────────────────────────────────────────

async def cmd_people(args):
    """List all people with photo counts."""
    await _ensure_db()

    async with async_session() as db:
        stmt = (
            select(Person, func.count(PhotoPerson.photo_id).label("photo_count"))
            .outerjoin(PhotoPerson, Person.id == PhotoPerson.person_id)
            .group_by(Person.id)
            .order_by(func.count(PhotoPerson.photo_id).desc())
        )
        res = await db.execute(stmt)
        people_data = res.all()

    if args.json:
        _print_json([{
            "id": p.id,
            "name": p.name,
            "photo_count": count,
        } for p, count in people_data])
    else:
        if not people_data:
            print("No people found.")
        else:
            print(f"People ({len(people_data)}):\n")
            _print_table(
                ["ID", "Name", "Photos"],
                [(p.id, p.name, count) for p, count in people_data]
            )
            print()


# ──────────────────────────────────────────────────────────────────
# Albums command
# ──────────────────────────────────────────────────────────────────

async def cmd_albums(args):
    """List all albums."""
    await _ensure_db()

    async with async_session() as db:
        stmt = select(Album).order_by(Album.name)
        res = await db.execute(stmt)
        albums = res.scalars().all()

    if args.json:
        _print_json([{
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "photo_count": a.photo_count,
            "is_smart": a.is_smart,
        } for a in albums])
    else:
        if not albums:
            print("No albums found.")
        else:
            print(f"Albums ({len(albums)}):\n")
            _print_table(
                ["ID", "Name", "Type", "Photos"],
                [(a.id, a.name, a.type, a.photo_count) for a in albums]
            )
            print()


# ──────────────────────────────────────────────────────────────────
# Export XMP command
# ──────────────────────────────────────────────────────────────────

async def cmd_export_xmp(args):
    """Export XMP sidecars for all photos."""
    await _ensure_db()

    from app.services.xmp_service import export_photo_xmp

    output_dir = args.output
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    async with async_session() as db:
        stmt = select(Photo).where(Photo.is_trash == False).order_by(Photo.id)
        res = await db.execute(stmt)
        photos = res.scalars().all()

        exported = 0
        errors = 0
        total = len(photos)

        for i, photo in enumerate(photos, 1):
            if not args.json:
                print(f"\r  [{i}/{total}] Exporting XMP for {photo.filename}...", end="", flush=True)
            try:
                if output_dir:
                    from app.services.xmp_service import export_xmp_to_file, _parse_face_box_json
                    # Load face regions
                    pp_stmt = (
                        select(PhotoPerson)
                        .options(selectinload(PhotoPerson.person))
                        .where(PhotoPerson.photo_id == photo.id)
                    )
                    pp_res = await db.execute(pp_stmt)
                    pp_list = pp_res.scalars().all()

                    face_regions = []
                    for pp in pp_list:
                        if pp.face_box_json and pp.person:
                            normalized = _parse_face_box_json(pp.face_box_json, photo.width, photo.height)
                            if normalized:
                                face_regions.append({
                                    "name": pp.person.name,
                                    "x": normalized["x"], "y": normalized["y"],
                                    "w": normalized["w"], "h": normalized["h"],
                                })

                    base_name = os.path.splitext(os.path.basename(photo.path))[0]
                    sidecar_path = os.path.join(output_dir, base_name + ".xmp")
                    from app.services.xmp_service import export_xmp_to_file as _export
                    _export(photo, face_regions if face_regions else None, sidecar_path)
                else:
                    await export_photo_xmp(photo.id, db)
                exported += 1
            except Exception as e:
                errors += 1
                if args.verbose:
                    print(f" Error: {e}", file=sys.stderr)

        if not args.json:
            print("\r" + " " * 60 + "\r", end="")

    if args.json:
        _print_json({"exported": exported, "errors": errors, "total": total})
    else:
        print(f"Exported {exported} XMP sidecar(s), {errors} errors.")


# ──────────────────────────────────────────────────────────────────
# Import XMP command
# ──────────────────────────────────────────────────────────────────

async def cmd_import_xmp(args):
    """Import XMP sidecars from a directory."""
    target = Path(args.directory).resolve()
    if not target.exists():
        print(f"Error: {target} does not exist", file=sys.stderr)
        sys.exit(1)

    await _ensure_db()

    from app.services.xmp_service import import_photo_xmp, import_xmp_sidecar

    xmp_files = []
    for root, dirs, files in os.walk(target):
        for fname in files:
            if fname.lower().endswith(".xmp"):
                xmp_files.append(os.path.join(root, fname))

    if not xmp_files:
        print("No .xmp files found.")
        return

    print(f"Found {len(xmp_files)} XMP file(s).")

    imported = 0
    not_found = 0
    errors = 0

    async with async_session() as db:
        for xmp_path in xmp_files:
            base_name = os.path.splitext(os.path.basename(xmp_path))[0]

            # Find matching photo by filename
            stmt = select(Photo).where(Photo.filename == base_name, Photo.is_trash == False)
            res = await db.execute(stmt)
            photo = res.scalar_one_or_none()

            if not photo:
                # Try matching by path prefix
                stmt2 = select(Photo).where(
                    Photo.path.like(f"{os.path.dirname(xmp_path)}%"),
                    Photo.is_trash == False
                )
                res2 = await db.execute(stmt2)
                for candidate in res2.scalars().all():
                    if os.path.splitext(os.path.basename(candidate.path))[0] == base_name:
                        photo = candidate
                        break

            if not photo:
                not_found += 1
                continue

            try:
                result = await import_photo_xmp(photo.id, db, xmp_path)
                if "error" not in result:
                    imported += 1
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                if args.verbose:
                    print(f"  Error importing {xmp_path}: {e}", file=sys.stderr)

    if args.json:
        _print_json({
            "xmp_files_found": len(xmp_files),
            "imported": imported,
            "not_found": not_found,
            "errors": errors,
        })
    else:
        print(f"Imported: {imported}, Not found: {not_found}, Errors: {errors}")


# ──────────────────────────────────────────────────────────────────
# Classify command
# ──────────────────────────────────────────────────────────────────

async def cmd_classify(args):
    """Run content classification on all photos."""
    await _ensure_db()

    from app.services.content_classifier import classify_content, ContentType

    async with async_session() as db:
        stmt = select(Photo).where(Photo.is_trash == False).order_by(Photo.id)
        res = await db.execute(stmt)
        photos = res.scalars().all()

        classified = 0
        total = len(photos)

        for i, photo in enumerate(photos, 1):
            if not args.json:
                print(f"\r  [{i}/{total}] Classifying {photo.filename}...", end="", flush=True)

            try:
                ext = os.path.splitext(photo.filename)[1] if photo.filename else ""
                content_type = classify_content(
                    width=photo.width,
                    height=photo.height,
                    file_ext=ext,
                    exif_make=photo.exif_make,
                    exif_model=photo.exif_model,
                    ocr_text=photo.ocr_text,
                    thumbnail_path=photo.url if photo.url and not photo.url.startswith("local://") else None,
                    filename=photo.filename or "",
                )
                photo.content_type = content_type.value
                classified += 1
            except Exception as e:
                if args.verbose:
                    print(f" Error: {e}", file=sys.stderr)

        await db.commit()

        if not args.json:
            print("\r" + " " * 60 + "\r", end="")

    if args.json:
        _print_json({"classified": classified, "total": total})
    else:
        print(f"Classified {classified}/{total} photo(s).")


# ──────────────────────────────────────────────────────────────────
# Serve command
# ──────────────────────────────────────────────────────────────────

def cmd_serve(args):
    """Start the FastAPI server."""
    import uvicorn
    port = args.port or 8269
    host = args.host or "0.0.0.0"
    print(f"Starting Prism server on {host}:{port}...")
    uvicorn.run("app.main:app", host=host, port=port, reload=args.reload, log_level="info")


# ──────────────────────────────────────────────────────────────────
# Main parser
# ──────────────────────────────────────────────────────────────────

def build_parser():
    parser = argparse.ArgumentParser(
        prog="prism",
        description="Prism photo management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # import
    p_import = sub.add_parser("import", help="Import photos from a file or directory")
    p_import.add_argument("path", help="File or directory to import")

    # index
    p_index = sub.add_parser("index", help="Queue photos for background processing")
    p_index.add_argument("--reprocess", action="store_true", help="Reprocess all photos from scratch")

    # search
    p_search = sub.add_parser("search", help="Search the photo library")
    p_search.add_argument("query", nargs="?", default=None, help="Full-text search query")
    p_search.add_argument("--tag", default=None, help="Search by tag")
    p_search.add_argument("--person", default=None, help="Search by person name")
    p_search.add_argument("--date", default=None, help="Search by date (YYYY or YYYY-MM)")

    # stats
    sub.add_parser("stats", help="Show library statistics")

    # export-xmp
    p_export = sub.add_parser("export-xmp", help="Export XMP sidecars for all photos")
    p_export.add_argument("--output", "-o", default=None, help="Output directory (default: alongside photos)")

    # import-xmp
    p_import_xmp = sub.add_parser("import-xmp", help="Import XMP sidecars from a directory")
    p_import_xmp.add_argument("directory", help="Directory containing .xmp files")

    # classify
    sub.add_parser("classify", help="Run content classification on all photos")

    # people
    sub.add_parser("people", help="List all people with photo counts")

    # albums
    sub.add_parser("albums", help="List all albums")

    # serve
    p_serve = sub.add_parser("serve", help="Start the Prism FastAPI server")
    p_serve.add_argument("--host", default=None, help="Host to bind (default: 0.0.0.0)")
    p_serve.add_argument("--port", type=int, default=None, help="Port (default: 8269)")
    p_serve.add_argument("--reload", action="store_true", help="Enable auto-reload")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    cmd_map = {
        "import": cmd_import,
        "index": cmd_index,
        "search": cmd_search,
        "stats": cmd_stats,
        "export-xmp": cmd_export_xmp,
        "import-xmp": cmd_import_xmp,
        "classify": cmd_classify,
        "people": cmd_people,
        "albums": cmd_albums,
        "serve": cmd_serve,
    }

    handler = cmd_map[args.command]

    if args.command == "serve":
        handler(args)
    else:
        asyncio.run(handler(args))


if __name__ == "__main__":
    main()
