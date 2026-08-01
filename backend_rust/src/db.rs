use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Error, Pool, Sqlite};
use std::str::FromStr;
use tracing::info;
use uuid::Uuid;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db(database_url: &str) -> Result<DbPool, Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await?;

    // Execute schema migrations / setup tables if not already existing
    create_tables(&pool).await?;

    info!("Database pool initialized successfully.");
    Ok(pool)
}

async fn create_tables(pool: &DbPool) -> Result<(), Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            url TEXT,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            aspect_ratio REAL NOT NULL,
            hash TEXT,
            phash TEXT,
            caption TEXT,
            city TEXT,
            state TEXT,
            country TEXT,
            latitude REAL,
            longitude REAL,
            location TEXT,
            date DATETIME,
            date_taken DATETIME,
            upload_date DATETIME,
            is_favorite BOOLEAN DEFAULT 0,
            is_locked BOOLEAN DEFAULT 0,
            is_trash BOOLEAN DEFAULT 0,
            mime_type TEXT DEFAULT 'image/jpeg',
            file_type TEXT DEFAULT 'image',
            device_id TEXT,
            is_external BOOLEAN DEFAULT 0,
            ai_summary TEXT,
            auto_tags TEXT,
            embedding TEXT,
            ocr_text TEXT,
            adjustments_json TEXT,
            blur_score REAL,
            file_size INTEGER,
            content_type TEXT DEFAULT 'photo',
            exif_make TEXT,
            exif_model TEXT,
            exif_focal_length REAL,
            exif_iso INTEGER,
            duration REAL,
            fps REAL,
            codec TEXT,
            audio_codec TEXT,
            rotation INTEGER DEFAULT 0,
            video_faces_scanned BOOLEAN DEFAULT 0,
            animated_url TEXT,
            event_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            is_smart BOOLEAN DEFAULT 0,
            smart_type TEXT,
            cover_url TEXT,
            photo_count INTEGER DEFAULT 0,
            metadata_json TEXT
        );

        CREATE TABLE IF NOT EXISTS photo_albums (
            photo_id INTEGER NOT NULL,
            album_id INTEGER NOT NULL,
            PRIMARY KEY (photo_id, album_id)
        );

        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            name TEXT NOT NULL,
            cover_face_thumbnail TEXT,
            face_embedding TEXT
        );

        CREATE TABLE IF NOT EXISTS photo_people (
            photo_id INTEGER NOT NULL,
            person_id INTEGER NOT NULL,
            confidence REAL DEFAULT 1.0,
            face_box_json TEXT,
            PRIMARY KEY (photo_id, person_id)
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            event_type TEXT DEFAULT 'trip',
            start_date DATETIME,
            end_date DATETIME,
            location TEXT,
            cover_photo_id INTEGER,
            summary TEXT
        );

        CREATE TABLE IF NOT EXISTS video_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            name TEXT NOT NULL DEFAULT 'Untitled Edit',
            cover_photo_id INTEGER,
            width INTEGER DEFAULT 1920,
            height INTEGER DEFAULT 1080,
            fps INTEGER DEFAULT 30,
            project_json TEXT,
            created_at DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS agent_sessions (
            id TEXT PRIMARY KEY,
            uuid TEXT UNIQUE,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS agent_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            photos_json TEXT,
            plan_json TEXT,
            tools_json TEXT,
            total_candidates INTEGER,
            created_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS telemetry_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            event_type TEXT NOT NULL,
            component TEXT,
            action TEXT,
            metadata_json TEXT,
            status TEXT DEFAULT 'ok',
            duration_ms REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry_events(status);
        "#
    )
    .execute(pool)
    .await?;

    // Perform migrations for existing schemas
    sqlx::query("ALTER TABLE photos ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE albums ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE video_projects ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE people ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE agent_sessions ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE agent_messages ADD COLUMN uuid TEXT").execute(pool).await.ok();

    ensure_uuids(pool).await?;

    Ok(())
}

async fn ensure_uuids(pool: &DbPool) -> Result<(), Error> {
    let unassigned_photos: Vec<i64> = sqlx::query_scalar("SELECT id FROM photos WHERE uuid IS NULL OR uuid = ''")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for photo_id in unassigned_photos {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE photos SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(photo_id)
            .execute(pool)
            .await
            .ok();
    }

    let unassigned_albums: Vec<i64> = sqlx::query_scalar("SELECT id FROM albums WHERE uuid IS NULL OR uuid = ''")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for album_id in unassigned_albums {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE albums SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(album_id)
            .execute(pool)
            .await
            .ok();
    }

    let unassigned_projects: Vec<i64> = sqlx::query_scalar("SELECT id FROM video_projects WHERE uuid IS NULL OR uuid = ''")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for project_id in unassigned_projects {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE video_projects SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(project_id)
            .execute(pool)
            .await
            .ok();
    }

    let unassigned_people: Vec<i64> = sqlx::query_scalar("SELECT id FROM people WHERE uuid IS NULL OR uuid = ''")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for person_id in unassigned_people {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE people SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(person_id)
            .execute(pool)
            .await
            .ok();
    }

    sqlx::query("UPDATE agent_sessions SET uuid = id WHERE uuid IS NULL OR uuid = ''")
        .execute(pool)
        .await
        .ok();

    let unassigned_msgs: Vec<i64> = sqlx::query_scalar("SELECT id FROM agent_messages WHERE uuid IS NULL OR uuid = ''")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for msg_id in unassigned_msgs {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE agent_messages SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(msg_id)
            .execute(pool)
            .await
            .ok();
    }

    Ok(())
}
