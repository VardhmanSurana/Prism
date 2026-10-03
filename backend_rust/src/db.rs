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
            embedding_blob BLOB,
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
            photo_id INTEGER,
            job_type TEXT NOT NULL DEFAULT 'sequential_analysis',
            title TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            current_stage TEXT,
            stage_progress TEXT,
            progress_pct REAL DEFAULT 0.0,
            total_items INTEGER DEFAULT 1,
            processed_items INTEGER DEFAULT 0,
            metadata_json TEXT,
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

        CREATE TABLE IF NOT EXISTS library_backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            integrity_status TEXT DEFAULT 'ok',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
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
    sqlx::query("ALTER TABLE photos ADD COLUMN ocr_bboxes TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN ocr_attempted_at TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN embedding_blob BLOB").execute(pool).await.ok();
    // Reliability & culling schema (Library Health, Culling Workspace, search scoring)
    sqlx::query("ALTER TABLE photos ADD COLUMN cull_status TEXT DEFAULT 'unflagged'").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN rating INTEGER DEFAULT 0").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN burst_group_id TEXT").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN missing_since DATETIME").execute(pool).await.ok();
    sqlx::query("ALTER TABLE photos ADD COLUMN last_verified DATETIME").execute(pool).await.ok();
    // Culling indexes — created after the columns exist (fresh DBs and legacy alike)
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photos_cull_status ON photos(cull_status)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photos_burst_group ON photos(burst_group_id)").execute(pool).await.ok();

    // Core query performance indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photos_listing ON photos(is_trash, is_locked, date_taken DESC, id DESC)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photos_phash ON photos(phash)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photo_albums_album ON photo_albums(album_id, photo_id)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_photo_people_person ON photo_people(person_id, photo_id)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_id)").execute(pool).await.ok();

    // Create session indexes after column migrations
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id)").execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id)").execute(pool).await.ok();


    ensure_uuids(pool).await?;
    ensure_file_sizes(pool).await.ok();
    migrate_background_jobs_if_needed(pool).await?;

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

/// ensure_file_sizes - Backfills file_size for existing photos if missing.
async fn ensure_file_sizes(pool: &DbPool) -> Result<(), Error> {
    #[derive(sqlx::FromRow)]
    struct PhotoPath {
        id: i64,
        path: String,
    }

    let unmeasured: Vec<PhotoPath> = sqlx::query_as::<_, PhotoPath>("SELECT id, path FROM photos WHERE file_size IS NULL OR file_size = 0")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for p in unmeasured {
        if let Some(real_path) = crate::routes::photos::resolve_photo_path(&p.path) {
            if let Ok(meta) = std::fs::metadata(&real_path) {
                let size = meta.len() as i64;
                let _ = sqlx::query("UPDATE photos SET file_size = ? WHERE id = ?")
                    .bind(size)
                    .bind(p.id)
                    .execute(pool)
                    .await;
            }
        }
    }

    Ok(())
}

/// migrate_background_jobs_if_needed - Ensures background_jobs supports nullable photo_id and generic metadata.
async fn migrate_background_jobs_if_needed(pool: &DbPool) -> Result<(), Error> {
    #[derive(sqlx::FromRow)]
    struct ColInfo {
        name: String,
        notnull: i64,
    }

    let cols: Vec<ColInfo> = sqlx::query_as::<_, ColInfo>("PRAGMA table_info(background_jobs)")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let photo_id_not_null = cols.iter().any(|c| c.name == "photo_id" && c.notnull == 1);
    let missing_title = !cols.iter().any(|c| c.name == "title");

    if photo_id_not_null || missing_title {
        info!("Migrating background_jobs table to support generic job tracking...");
        let mut tx = pool.begin().await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS background_jobs_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id INTEGER,
                job_type TEXT NOT NULL DEFAULT 'sequential_analysis',
                title TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                current_stage TEXT,
                stage_progress TEXT,
                progress_pct REAL DEFAULT 0.0,
                total_items INTEGER DEFAULT 1,
                processed_items INTEGER DEFAULT 0,
                metadata_json TEXT,
                attempt_count INTEGER DEFAULT 0,
                last_error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
            );
            "#
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO background_jobs_v2 (id, photo_id, job_type, status, current_stage, stage_progress, attempt_count, last_error, created_at, updated_at)
            SELECT id, photo_id, job_type, status, current_stage, stage_progress, attempt_count, last_error, created_at, updated_at
            FROM background_jobs;
            "#
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query("DROP TABLE background_jobs;").execute(&mut *tx).await?;
        sqlx::query("ALTER TABLE background_jobs_v2 RENAME TO background_jobs;").execute(&mut *tx).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);").execute(&mut *tx).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_background_jobs_photo ON background_jobs(photo_id);").execute(&mut *tx).await?;

        tx.commit().await?;
        info!("Migrated background_jobs table successfully.");
    }

    Ok(())
}
