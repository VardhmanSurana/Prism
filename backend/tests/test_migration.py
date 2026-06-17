import pytest
from sqlalchemy import text, create_engine
from sqlalchemy.ext.asyncio import create_async_engine

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.mark.asyncio
async def test_dynamic_migration_and_data_preservation():
    # 1. Start with an empty in-memory DB and create a legacy table schema manually
    engine = create_async_engine(TEST_DB_URL)
    
    async with engine.begin() as conn:
        # Create legacy photos table
        await conn.execute(text("""
            CREATE TABLE photos (
                id INTEGER PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                path VARCHAR(512) NOT NULL,
                url VARCHAR(512),
                width INTEGER,
                height INTEGER,
                aspect_ratio FLOAT,
                caption VARCHAR(512),
                city VARCHAR(255),
                state VARCHAR(255),
                country VARCHAR(255),
                latitude FLOAT,
                longitude FLOAT,
                location VARCHAR(512),
                is_favorite BOOLEAN,
                is_locked BOOLEAN,
                is_trash BOOLEAN,
                mime_type VARCHAR(50),
                file_type VARCHAR(20),
                device_id VARCHAR(255),
                is_external BOOLEAN,
                ai_summary TEXT
            )
        """))
        
        # Insert seed data
        await conn.execute(text("""
            INSERT INTO photos (filename, path, width, height, aspect_ratio, is_favorite, is_locked)
            VALUES ('old_pic.jpg', '/home/user/Pictures/old_pic.jpg', 1920, 1080, 1.77, 1, 0)
        """))

    # 2. Run the dynamic migration logic (simulated from lifespan in main.py)
    async with engine.begin() as conn:
        res = await conn.execute(text("PRAGMA table_info(photos)"))
        columns = [row[1] for row in res.fetchall()]
        
        # Verify columns didn't exist before
        assert "blur_score" not in columns
        assert "file_size" not in columns
        assert "auto_tags" not in columns
        assert "embedding" not in columns
        assert "event_id" not in columns
        
        # Run migrations
        await conn.execute(text("ALTER TABLE photos ADD COLUMN blur_score FLOAT"))
        await conn.execute(text("ALTER TABLE photos ADD COLUMN file_size INTEGER"))
        await conn.execute(text("ALTER TABLE photos ADD COLUMN auto_tags TEXT"))
        await conn.execute(text("ALTER TABLE photos ADD COLUMN embedding TEXT"))
        await conn.execute(text("ALTER TABLE photos ADD COLUMN event_id INTEGER"))
        
        # Create indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_blur_score ON photos (blur_score)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos (event_id)"))
        
        # Create FTS5 virtual table
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename,
                caption,
                location,
                city,
                country,
                ai_summary,
                auto_tags
            )
        """))
        
        # Build sync triggers
        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_insert AFTER INSERT ON photos
            BEGIN
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags)
                VALUES (new.id, new.filename, new.caption, new.location, new.city, new.country, new.ai_summary, new.auto_tags);
            END;
        """))

    # 3. Verify the final migrated schema state and data integrity
    async with engine.connect() as conn:
        res = await conn.execute(text("PRAGMA table_info(photos)"))
        columns = [row[1] for row in res.fetchall()]
        
        assert "blur_score" in columns
        assert "file_size" in columns
        assert "auto_tags" in columns
        assert "embedding" in columns
        assert "event_id" in columns
        
        # Verify index was created
        idx_res = await conn.execute(text("PRAGMA index_list(photos)"))
        indexes = [row[1] for row in idx_res.fetchall()]
        assert "idx_photos_blur_score" in indexes
        assert "idx_photos_event_id" in indexes
        
        # Verify original seed data remains untouched
        data_res = await conn.execute(text("SELECT filename, is_favorite, blur_score FROM photos"))
        row = data_res.fetchone()
        assert row is not None
        assert row[0] == 'old_pic.jpg'
        assert row[1] == 1  # True
        assert row[2] is None  # new column default value

    await engine.dispose()
