"""unify_runtime_schema

Applies the same additive schema patches defined in
``app.schema_migrations`` so Alembic CLI and app startup stay aligned.

Revision ID: a1b2c3d4e5f6
Revises: 6f3a1b2c4d5e
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.schema_migrations import (
    ALBUM_COLUMN_PATCHES,
    BACKGROUND_JOB_COLUMN_PATCHES,
    PHOTO_COLUMN_PATCHES,
    PHOTO_INDEXES,
    VIDEO_CLIP_COLUMN_PATCHES,
    VIDEO_PROJECT_COLUMN_PATCHES,
)

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "6f3a1b2c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_columns(bind, table: str) -> list[str]:
    rows = bind.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return [row[1] for row in rows]


def _add_missing(bind, table: str, patches) -> None:
    columns = _table_columns(bind, table)
    if not columns:
        return
    for name, sql_type in patches:
        if name not in columns:
            bind.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))


def upgrade() -> None:
    bind = op.get_bind()

    _add_missing(bind, "photos", PHOTO_COLUMN_PATCHES)
    bind.execute(
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
    bind.execute(
        text("CREATE INDEX IF NOT EXISTS idx_sync_peers_peer_id ON sync_peers (peer_id)")
    )
    _add_missing(bind, "background_jobs", BACKGROUND_JOB_COLUMN_PATCHES)
    _add_missing(bind, "albums", ALBUM_COLUMN_PATCHES)
    try:
        _add_missing(bind, "video_projects", VIDEO_PROJECT_COLUMN_PATCHES)
    except Exception:
        pass
    try:
        _add_missing(bind, "video_clips", VIDEO_CLIP_COLUMN_PATCHES)
    except Exception:
        pass
    for stmt in PHOTO_INDEXES:
        bind.execute(text(stmt))

    bind.execute(
        text(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename, caption, location, city, country,
                ai_summary, auto_tags, ocr_text
            )
            """
        )
    )
    fts_cols = _table_columns(bind, "photos_fts")
    if fts_cols and "ocr_text" not in fts_cols:
        bind.execute(text("DROP TABLE IF EXISTS photos_fts"))
        bind.execute(
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
        bind.execute(text("DROP TRIGGER IF EXISTS after_photo_insert"))
        bind.execute(text("DROP TRIGGER IF EXISTS after_photo_delete"))
        bind.execute(text("DROP TRIGGER IF EXISTS after_photo_update"))
        bind.execute(
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

    bind.execute(
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
    bind.execute(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS after_photo_delete AFTER DELETE ON photos
            BEGIN
                DELETE FROM photos_fts WHERE photo_id = old.id;
            END;
            """
        )
    )
    bind.execute(
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


def downgrade() -> None:
    """No-op: additive schema patches are not reversed automatically."""
    pass
