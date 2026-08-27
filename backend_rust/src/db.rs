use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Error, Pool, Sqlite};
use std::str::FromStr;
use tracing::info;
use uuid::Uuid;

pub type DbPool = Pool<Sqlite>;

/// init_db - Initializes SQLite pool and runs migrations.
pub async fn init_db(database_url: &str) -> Result<DbPool, Error> {
    // Extract the filesystem path from the connection URL and ensure its parent
    // directory exists. SQLite's `create_if_missing` will create the *file* when
    // absent, but it will NOT create missing parent directories — which causes
    // `SQLITE_CANTOPEN` (code 14, "unable to open database file") on a fresh
    // checkout. Creating the directory first lets the backend auto-create the
    // database file from scratch.
    let db_file_path = database_url.trim_start_matches("sqlite://");
    if let Some(parent) = std::path::Path::new(db_file_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).ok();
        }
    }

    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await?;

    sqlx::query("PRAGMA journal_mode = WAL;").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous = NORMAL;").execute(&pool).await?;
    sqlx::query("PRAGMA foreign_keys = ON;").execute(&pool).await?;

    let health_status: String = sqlx::query_scalar("PRAGMA quick_check;").fetch_one(&pool).await?;
    info!("Database health status (PRAGMA quick_check): {}", health_status);

    // Execute schema migrations / setup tables if not already existing
    create_tables(&pool).await?;

    info!("Database pool initialized successfully.");
    Ok(pool)
}

/// create_tables - Creates tables.
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

        CREATE TABLE IF NOT EXISTS faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_id INTEGER NOT NULL,
            confidence REAL DEFAULT 1.0,
            box_json TEXT,
            embedding_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS background_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_id INTEGER NOT NULL,
            job_type TEXT NOT NULL DEFAULT 'sequential_analysis',
            status TEXT NOT NULL DEFAULT 'pending',
            current_stage TEXT,
            stage_progress TEXT,
            attempt_count INTEGER DEFAULT 0,
            last_error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_background_jobs_photo ON background_jobs(photo_id);

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


        CREATE TABLE IF NOT EXISTS telemetry_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            session_id TEXT,
            event_type TEXT NOT NULL,
            component TEXT,
            action TEXT,
            metadata_json TEXT,
            status TEXT DEFAULT 'ok',
            duration_ms REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agent_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agent_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            photos_json TEXT,
            plan_json TEXT,
            tools_json TEXT,
            attached_image_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry_events(status);

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS external_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT 'local_path',
            mount_path TEXT,
            enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sync_peers (
            peer_id TEXT PRIMARY KEY,
            hostname TEXT,
            device_type TEXT,
            paired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'paired'
        );

        CREATE TABLE IF NOT EXISTS shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            share_token TEXT UNIQUE NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            password_hash TEXT,
            expires_at DATETIME,
            max_downloads INTEGER,
            download_count INTEGER DEFAULT 0,
            hide_exif BOOLEAN DEFAULT 0,
            hide_gps BOOLEAN DEFAULT 0,
            download_original BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            events TEXT NOT NULL DEFAULT '*',
            secret TEXT,
            enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        "#
    )
    .execute(pool)
    .await?;

    // Perform migrations for existing schemas (adds columns if missing)
    sqlx::query("ALTER TABLE photos ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE albums ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE video_projects ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE people ADD COLUMN uuid TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE telemetry_events ADD COLUMN session_id TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE agent_messages ADD COLUMN session_id TEXT").execute(pool).await.ok();

    // Create session indexes after column migrations
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id)").execute(pool).await.ok();

    ensure_uuids(pool).await?;

    // Create default admin user if no users exist
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count == 0 {
        use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
        use argon2::Argon2;
        use uuid::Uuid;

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(b"admin123", &salt)
            .map_err(|e| Error::Configuration(e.to_string().into()))?
            .to_string();

        let uuid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO users (uuid, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&uuid)
        .bind("admin")
        .bind("admin@prism.local")
        .bind(&password_hash)
        .bind("admin")
        .execute(pool)
        .await?;

        info!("Created default admin user (username: admin, password: admin123)");
    }

    Ok(())
}

/// ensure_uuids - Ensures uuids.
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


    Ok(())
}
