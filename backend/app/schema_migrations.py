"""
Single source of truth for additive SQLite schema evolution.

All runtime schema patches (columns, indexes, FTS5, triggers) live here.
``lifespan`` and Alembic revisions both call ``apply_schema`` so the
PRAGMA-based path and migration history cannot drift apart.

New schema changes:
  1. Update SQLAlchemy models in ``app.models``.
  2. Add an idempotent patch here (or rely on ``create_all`` for new tables).
  3. Optionally add an Alembic revision that also calls ``apply_schema``.
"""

from __future__ import annotations

import logging
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

# Columns that may be missing on older installs of the photos table.
# (name, SQL type fragment for ALTER TABLE)
PHOTO_COLUMN_PATCHES: tuple[tuple[str, str], ...] = (
    ("blur_score", "FLOAT"),
    ("file_size", "INTEGER"),
    ("auto_tags", "TEXT"),
    ("embedding", "TEXT"),
    ("event_id", "INTEGER"),
    ("ocr_text", "TEXT"),
    ("duration", "FLOAT"),
    ("fps", "FLOAT"),
    ("codec", "VARCHAR(50)"),
    ("audio_codec", "VARCHAR(50)"),
    ("rotation", "INTEGER DEFAULT 0"),
    ("video_faces_scanned", "BOOLEAN DEFAULT 0"),
    ("animated_url", "VARCHAR(512)"),
    ("phash", "VARCHAR(64)"),
    ("content_type", "VARCHAR(20) DEFAULT 'photo'"),
    ("exif_make", "VARCHAR(255)"),
    ("exif_model", "VARCHAR(255)"),
    ("exif_focal_length", "FLOAT"),
    ("exif_iso", "INTEGER"),
    ("hash", "VARCHAR(64)"),
    ("ai_summary", "TEXT"),
    ("adjustments_json", "TEXT"),
)

BACKGROUND_JOB_COLUMN_PATCHES: tuple[tuple[str, str], ...] = (
    ("current_stage", "VARCHAR(50)"),
    ("stage_progress", "TEXT"),
)

ALBUM_COLUMN_PATCHES: tuple[tuple[str, str], ...] = (
    ("is_smart", "BOOLEAN DEFAULT 0"),
    ("smart_type", "VARCHAR(20)"),
)

VIDEO_PROJECT_COLUMN_PATCHES: tuple[tuple[str, str], ...] = (
    ("project_json", "TEXT"),
)

VIDEO_CLIP_COLUMN_PATCHES: tuple[tuple[str, str], ...] = (
    ("proxy_status", "VARCHAR(20) DEFAULT 'pending'"),
    ("audio_waveform_json", "TEXT"),
)

PHOTO_INDEXES: tuple[str, ...] = (
    "CREATE INDEX IF NOT EXISTS idx_photos_content_type ON photos (content_type)",
    "CREATE INDEX IF NOT EXISTS idx_photos_blur_score ON photos (blur_score)",
    "CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos (event_id)",
    "CREATE INDEX IF NOT EXISTS idx_photos_video_faces_scanned ON photos (video_faces_scanned)",
    "CREATE INDEX IF NOT EXISTS idx_photos_phash ON photos (phash)",
    "CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos (hash)",
)

FTS_COLUMNS = (
    "photo_id",
    "filename",
    "caption",
    "location",
    "city",
    "country",
    "ai_summary",
    "auto_tags",
    "ocr_text",
)


async def _table_columns(conn: AsyncConnection, table: str) -> list[str]:
    res = await conn.execute(text(f"PRAGMA table_info({table})"))
    return [row[1] for row in res.fetchall()]


async def _add_missing_columns(
    conn: AsyncConnection,
    table: str,
    patches: Iterable[tuple[str, str]],
) -> None:
    columns = await _table_columns(conn, table)
    if not columns:
        # Table does not exist yet; create_all will create the full schema.
        return
    for name, sql_type in patches:
        if name not in columns:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
            logger.info("Added column %s.%s", table, name)


async def _ensure_sync_peers(conn: AsyncConnection) -> None:
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS sync_peers (
                id INTEGER PRIMARY KEY,
                peer_id VARCHAR(64) UNIQUE NOT NULL,
                hostname VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                port INTEGER DEFAULT 8269,
                paired BOOLEAN DEFAULT 0,
                paired_at TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                device_type VARCHAR(50)
            )
            """
        )
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS idx_sync_peers_peer_id ON sync_peers (peer_id)")
    )


async def _ensure_photos_fts(conn: AsyncConnection) -> None:
    await conn.execute(
        text(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename,
                caption,
                location,
                city,
                country,
                ai_summary,
                auto_tags,
                ocr_text
            )
            """
        )
    )

    fts_columns = await _table_columns(conn, "photos_fts")
    if fts_columns and "ocr_text" not in fts_columns:
        logger.info("Migrating photos_fts to include ocr_text column...")
        await conn.execute(text("DROP TABLE IF EXISTS photos_fts"))
        await conn.execute(
            text(
                """
                CREATE VIRTUAL TABLE photos_fts USING fts5(
                    photo_id UNINDEXED,
                    filename, caption, location, city, country,
                    ai_summary, auto_tags, ocr_text
                )
                """
            )
        )
        await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_insert"))
        await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_delete"))
        await conn.execute(text("DROP TRIGGER IF EXISTS after_photo_update"))
        await conn.execute(
            text(
                """
                INSERT INTO photos_fts(
                    photo_id, filename, caption, location, city, country,
                    ai_summary, auto_tags, ocr_text
                )
                SELECT id, filename, caption, location, city, country,
                       ai_summary, auto_tags, ocr_text FROM photos
                """
            )
        )
        logger.info("FTS5 table migrated with ocr_text column.")

    await conn.execute(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS after_photo_insert AFTER INSERT ON photos
            BEGIN
                INSERT INTO photos_fts(
                    photo_id, filename, caption, location, city, country,
                    ai_summary, auto_tags, ocr_text
                )
                VALUES (
                    new.id, new.filename, new.caption, new.location, new.city,
                    new.country, new.ai_summary, new.auto_tags, new.ocr_text
                );
            END;
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS after_photo_delete AFTER DELETE ON photos
            BEGIN
                DELETE FROM photos_fts WHERE photo_id = old.id;
            END;
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS after_photo_update AFTER UPDATE ON photos
            BEGIN
                UPDATE photos_fts SET
                    filename = new.filename,
                    caption = new.caption,
                    location = new.location,
                    city = new.city,
                    country = new.country,
                    ai_summary = new.ai_summary,
                    auto_tags = new.auto_tags,
                    ocr_text = new.ocr_text
                WHERE photo_id = old.id;
            END;
            """
        )
    )

    res_fts = await conn.execute(text("SELECT COUNT(*) FROM photos_fts"))
    if res_fts.scalar() == 0:
        photo_cols = set(await _table_columns(conn, "photos"))
        required = {
            "id",
            "filename",
            "caption",
            "location",
            "city",
            "country",
            "ai_summary",
            "auto_tags",
            "ocr_text",
        }
        if photo_cols and required.issubset(photo_cols):
            logger.info("FTS5 table is empty. Populating from existing photos table...")
            await conn.execute(
                text(
                    """
                    INSERT INTO photos_fts(
                        photo_id, filename, caption, location, city, country,
                        ai_summary, auto_tags, ocr_text
                    )
                    SELECT id, filename, caption, location, city, country,
                           ai_summary, auto_tags, ocr_text FROM photos
                    """
                )
            )
        elif photo_cols:
            logger.debug(
                "Skipping FTS backfill; photos table missing columns: %s",
                sorted(required - photo_cols),
            )


async def apply_schema(conn: AsyncConnection) -> None:
    """
    Apply all additive schema patches idempotently.

    Safe to run on every startup against fresh or legacy databases.
    Call after ``Base.metadata.create_all`` so tables exist for ALTER paths.
    """
    await _add_missing_columns(conn, "photos", PHOTO_COLUMN_PATCHES)
    await _ensure_sync_peers(conn)
    await _add_missing_columns(conn, "background_jobs", BACKGROUND_JOB_COLUMN_PATCHES)
    await _add_missing_columns(conn, "albums", ALBUM_COLUMN_PATCHES)

    try:
        await _add_missing_columns(conn, "video_projects", VIDEO_PROJECT_COLUMN_PATCHES)
    except Exception as e:
        logger.debug("video_projects column patch skipped: %s", e)

    try:
        await _add_missing_columns(conn, "video_clips", VIDEO_CLIP_COLUMN_PATCHES)
    except Exception as e:
        logger.debug("video_clips column patch skipped: %s", e)

    for stmt in PHOTO_INDEXES:
        await conn.execute(text(stmt))

    await _ensure_photos_fts(conn)
