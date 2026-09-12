#[cfg(test)]
mod server_enhancement_tests {
    use crate::db::init_db;
    use crate::services::webhooks::{Webhook, WebhookPayload, WebhookService};

    #[tokio::test]
    /// test_webhook_schema_and_payload - Tests webhook schema and payload.
    async fn test_webhook_schema_and_payload() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Verify webhooks table exists and inserts cleanly
        let res = sqlx::query(
            "INSERT INTO webhooks (url, events, secret, enabled) VALUES (?, ?, ?, ?)"
        )
        .bind("http://localhost:9999/webhook")
        .bind("photo.imported,album.created")
        .bind("secret123")
        .bind(true)
        .execute(&pool)
        .await
        .unwrap();

        let id = res.last_insert_rowid();
        assert!(id > 0);

        let list: Vec<Webhook> = sqlx::query_as::<_, Webhook>(
            "SELECT id, url, events, secret, enabled, created_at FROM webhooks"
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].url, "http://localhost:9999/webhook");
        assert_eq!(list[0].events, "photo.imported,album.created");

        // Verify payload serialization
        let payload = WebhookPayload {
            event: "photo.imported".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            data: serde_json::json!({ "id": 1, "filename": "test.jpg" }),
        };

        let json_str = serde_json::to_string(&payload).unwrap();
        assert!(json_str.contains("photo.imported"));
        assert!(json_str.contains("test.jpg"));

        // Dispatch test event
        WebhookService::dispatch_event(&pool, "photo.imported", serde_json::json!({"id": 1})).await;
    }

    #[tokio::test]
    /// test_api_key_security_settings - Tests api key security settings.
    async fn test_api_key_security_settings() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Initially no settings key set
        let enabled: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_enabled'")
            .fetch_optional(&pool)
            .await
            .unwrap();
        assert!(enabled.is_none());

        // Set api key and enable
        sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_enabled', 'true')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_value', 'my_secret_key_123')")
            .execute(&pool)
            .await
            .unwrap();

        let key: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_value'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(key, "my_secret_key_123");
    }

    #[tokio::test]
    async fn test_capability_packs_lifecycle() {
        use crate::services::packs::PackManager;
        use tempfile::tempdir;

        let temp = tempdir().unwrap();
        let packs_dir = temp.path().join("packs");
        let models_dir = temp.path().join("models");

        let manager = PackManager::new(packs_dir.clone(), models_dir.clone());
        manager.refresh().await;

        let packs_info = manager.get_packs_info().await;
        assert_eq!(packs_info.len(), 1);
        assert_eq!(packs_info[0].id, "background-removal");
        assert_eq!(packs_info[0].models.len(), 3);

        // Verify model definitions conversion
        let defs = manager.to_model_definitions().await;
        assert_eq!(defs.len(), 3);
        assert!(defs.iter().any(|d| d.id == "isnet-general-use"));
        assert!(defs.iter().any(|d| d.id == "birefnet"));
        assert!(defs.iter().any(|d| d.id == "rmbg-1.4"));

        // Test license acknowledgment
        let isnet_status = packs_info[0].models.iter().find(|m| m.id == "isnet-general-use").unwrap();
        assert_eq!(isnet_status.license_acknowledged, true);

        let rmbg_status = packs_info[0].models.iter().find(|m| m.id == "rmbg-1.4").unwrap();
        assert_eq!(rmbg_status.gated, true);
        assert_eq!(rmbg_status.license_acknowledged, false);

        manager.acknowledge_license("rmbg-1.4");
        let updated_packs = manager.get_packs_info().await;
        let updated_rmbg = updated_packs[0].models.iter().find(|m| m.id == "rmbg-1.4").unwrap();
        assert_eq!(updated_rmbg.license_acknowledged, true);
    }

    #[tokio::test]
    async fn test_plugins_directory_lifecycle() {
        use crate::services::plugins::PluginManager;
        use tempfile::tempdir;

        let temp = tempdir().unwrap();
        let plugins_dir = temp.path().join("plugins");
        let packs_dir = temp.path().join("packs");
        let models_dir = temp.path().join("models");

        let manager = PluginManager::new(plugins_dir.clone(), packs_dir.clone(), models_dir.clone());

        // 1. Initial scan is empty
        let initial_installed = manager.scan_installed();
        assert_eq!(initial_installed.len(), 0);

        // 2. Catalog listing has plugins with is_installed = false
        let catalog = manager.get_catalog();
        assert!(catalog.len() >= 3);
        assert!(catalog.iter().all(|p| !p.is_installed));

        // 3. Install "ai-vision-studio.json" manifest name
        let installed = manager.install_plugin("ai-vision-studio.json").await.unwrap();
        assert_eq!(installed.id, "ai-vision-studio");
        assert!(installed.is_active);

        // Verify folder and files exist on disk
        let plugin_folder = plugins_dir.join("ai-vision-studio");
        assert!(plugin_folder.is_dir());
        assert!(plugin_folder.join("plugin.json").is_file());
        assert!(plugin_folder.join("config.json").is_file());
        assert!(plugin_folder.join("index.js").is_file());

        // Install "creative-color-studio" from catalog
        let color_studio = manager.install_plugin("creative-color-studio.json").await.unwrap();
        assert_eq!(color_studio.id, "creative-color-studio");
        assert!(plugins_dir.join("creative-color-studio").join("plugin.json").is_file());

        // 4. Scanning finds installed plugins
        let scanned = manager.scan_installed();
        assert_eq!(scanned.len(), 2);
        assert!(scanned.iter().any(|p| p.id == "ai-vision-studio"));
        assert!(scanned.iter().any(|p| p.id == "creative-color-studio"));

        // 5. Toggle plugin active state
        let toggled = manager.toggle_plugin("ai-vision-studio", false).unwrap();
        assert_eq!(toggled.is_active, false);
        let scanned_after_toggle = manager.scan_installed();
        let bg_p = scanned_after_toggle.iter().find(|p| p.id == "ai-vision-studio").unwrap();
        assert_eq!(bg_p.is_active, false);

        // 6. Update plugin settings
        let updated = manager
            .update_config(
                "ai-vision-studio",
                serde_json::json!({ "default_matting_model": "isnet-general-use", "auto_feather": 4 }),
            )
            .unwrap();
        assert_eq!(updated.config.settings["default_matting_model"], "isnet-general-use");

        // 7. Uninstall plugins
        manager.uninstall_plugin("ai-vision-studio").unwrap();
        manager.uninstall_plugin("creative-color-studio").unwrap();
        assert!(!plugin_folder.exists());
        assert_eq!(manager.scan_installed().len(), 0);

        // 8. Test installing from a custom local manifest file on disk
        let custom_manifest_path = temp.path().join("my-custom-plugin.json");
        std::fs::write(
            &custom_manifest_path,
            r#"{
                "id": "my-custom-plugin",
                "name": "My Custom Plugin",
                "version": "1.0.0",
                "author": "Tester",
                "description": "A test custom plugin",
                "category": "Custom",
                "capabilities": ["test"]
            }"#,
        ).unwrap();

        let custom_installed = manager.install_plugin(custom_manifest_path.to_str().unwrap()).await.unwrap();
        assert_eq!(custom_installed.id, "my-custom-plugin");
        assert!(plugins_dir.join("my-custom-plugin").join("plugin.json").exists());
        assert!(plugins_dir.join("my-custom-plugin").join("index.js").exists());

        // 9. Test installing from a custom local directory with plugin.json
        let custom_dir = temp.path().join("local-pack-dir");
        std::fs::create_dir_all(&custom_dir).unwrap();
        std::fs::write(
            custom_dir.join("plugin.json"),
            r#"{
                "id": "dir-plugin",
                "name": "Directory Plugin",
                "version": "2.0.0",
                "author": "Tester",
                "description": "Loaded from directory",
                "category": "Custom",
                "capabilities": ["dir"]
            }"#,
        ).unwrap();
        std::fs::write(custom_dir.join("index.js"), "console.log('dir plugin');").unwrap();

        let dir_installed = manager.install_plugin(custom_dir.to_str().unwrap()).await.unwrap();
        assert_eq!(dir_installed.id, "dir-plugin");
        assert!(plugins_dir.join("dir-plugin").join("plugin.json").exists());
        assert!(plugins_dir.join("dir-plugin").join("index.js").exists());
    }

    #[test]
    fn test_map_coordinate_to_tile() {
        use crate::routes::maps::lat_lon_to_tile;

        // Zoom 0: entire world is 1 tile (0, 0)
        assert_eq!(lat_lon_to_tile(0.0, 0.0, 0), (0, 0));
        assert_eq!(lat_lon_to_tile(51.5074, -0.1278, 0), (0, 0));

        // Zoom 1: 2x2 tiles
        let (x, y) = lat_lon_to_tile(0.0, 0.0, 1);
        assert_eq!((x, y), (1, 1));

        // London at zoom 10: ~ (511, 340)
        let (x, y) = lat_lon_to_tile(51.5074, -0.1278, 10);
        assert_eq!(x, 511);
        assert_eq!(y, 340);

        // San Francisco at zoom 10: ~ (163, 395)
        let (x, y) = lat_lon_to_tile(37.7749, -122.4194, 10);
        assert_eq!(x, 163);
        assert_eq!(y, 395);
    }

    #[test]
    fn test_constant_time_comparison() {
        use crate::routes::{constant_time_eq_bytes, constant_time_eq_str};

        // Matching secret strings
        assert!(constant_time_eq_str("my-super-secret-api-key-12345", "my-super-secret-api-key-12345"));
        assert!(constant_time_eq_str("", ""));

        // Mismatched secret strings (same length)
        assert!(!constant_time_eq_str("my-super-secret-api-key-12345", "my-super-secret-api-key-12346"));

        // Mismatched secret strings (different length)
        assert!(!constant_time_eq_str("my-super-secret", "my-super-secret-extended"));
        assert!(!constant_time_eq_str("short", "much-longer-secret-string"));
        assert!(!constant_time_eq_str("", "non-empty"));

        // Matching & mismatched bytes
        assert!(constant_time_eq_bytes(b"symmetric_key_payload", b"symmetric_key_payload"));
        assert!(!constant_time_eq_bytes(b"symmetric_key_payload_a", b"symmetric_key_payload_b"));
        assert!(!constant_time_eq_bytes(b"key", b"longer_key"));
    }

    fn create_test_state(pool: crate::db::DbPool) -> std::sync::Arc<crate::AppState> {
        use crate::config::Config;
        use crate::services::llm_client::LlmClient;
        use crate::services::llm_server::LlmServer;
        use crate::services::ml_client::MlClient;
        use crate::services::model_manager::ModelManager;
        use crate::services::packs::PackManager;
        use crate::services::plugins::PluginManager;
        use crate::services::telemetry::TelemetryService;
        use crate::services::worker::{AnalyzerRegistry, JobScheduler, WorkerState};
        use std::path::PathBuf;
        use std::sync::Arc;

        let config = Config {
            port: 8269,
            host: "127.0.0.1".to_string(),
            database_url: "sqlite::memory:".to_string(),
            upload_dir: PathBuf::from("uploads"),
            thumbnails_dir: PathBuf::from("thumbnails"),
            api_key: None,
            gpu_mode: "cpu".to_string(),
            models_dir: PathBuf::from("models"),
            packs_dir: PathBuf::from("packs"),
            plugins_dir: PathBuf::from("plugins"),
            map_cache_dir: PathBuf::from("map_cache"),
        };

        let llm_server = LlmServer::new(config.models_dir.clone(), config.gpu_mode.clone());
        let ml_client = MlClient::new(LlmClient::new(llm_server));
        let telemetry = TelemetryService::new(pool.clone());
        let registry = Arc::new(AnalyzerRegistry::new());
        let worker = WorkerState::new(&registry.names());
        let scheduler = JobScheduler::new(config.upload_dir.clone());
        let model_manager = Arc::new(ModelManager::new(config.models_dir.clone()));
        let pack_manager = Arc::new(PackManager::new(config.packs_dir.clone(), config.models_dir.clone()));
        let plugin_manager = Arc::new(PluginManager::new(
            config.plugins_dir.clone(),
            config.packs_dir.clone(),
            config.models_dir.clone(),
        ));

        let lan_beacon = Arc::new(crate::services::lan_beacon::LanBeaconService::new(
            "test_peer".to_string(),
            config.port,
        ));

        Arc::new(crate::AppState {
            config,
            db: pool,
            ml_client,
            telemetry,
            worker,
            scheduler,
            registry,
            model_manager,
            pack_manager,
            plugin_manager,
            lan_beacon,
        })
    }

    static VAULT_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    #[tokio::test]
    async fn test_argon2id_vault_passcode_lifecycle() {
        let _lock = VAULT_TEST_LOCK.lock().await;
        use axum::extract::{Json, State};
        use crate::routes::settings::{
            setup_locked_folder, verify_locked_folder, reset_vault_rate_limiter,
            LockedFolderSetupRequest, LockedFolderVerifyRequest,
        };

        reset_vault_rate_limiter();
        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        // 1. Setup passcode
        let setup_res = setup_locked_folder(
            State(state.clone()),
            Json(LockedFolderSetupRequest { passcode: "vaultSecret99".to_string() }),
        ).await;
        assert!(setup_res.is_ok());

        // 2. Verify DB stored hash is an Argon2id PHC string
        let stored_hash: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'locked_folder_passcode_hash'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(stored_hash.starts_with("$argon2id$"));

        // 3. Verify with correct passcode
        let v_ok = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: "vaultSecret99".to_string() }),
        ).await.unwrap();
        assert_eq!(v_ok.0.get("verified").and_then(|v| v.as_bool()), Some(true));

        // 4. Verify with incorrect passcode
        let v_bad = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: "wrongSecret".to_string() }),
        ).await.unwrap();
        assert_eq!(v_bad.0.get("verified").and_then(|v| v.as_bool()), Some(false));
    }

    #[tokio::test]
    async fn test_argon2id_transparent_migration_from_sha256() {
        let _lock = VAULT_TEST_LOCK.lock().await;
        use axum::extract::{Json, State};
        use sha2::{Sha256, Digest};
        use crate::routes::settings::{
            verify_locked_folder, reset_vault_rate_limiter, LockedFolderVerifyRequest,
        };

        reset_vault_rate_limiter();
        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        // Simulate legacy unmigrated state with raw SHA-256 hash
        let legacy_pass = "legacyVaultCode123";
        let mut hasher = Sha256::new();
        hasher.update(legacy_pass.as_bytes());
        let legacy_hash = format!("{:x}", hasher.finalize());

        sqlx::query("INSERT INTO settings (key, value) VALUES ('locked_folder_passcode_hash', ?)")
            .bind(&legacy_hash)
            .execute(&pool)
            .await
            .unwrap();

        // 1. Verify with legacy passcode
        let v_mig = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: legacy_pass.to_string() }),
        ).await.unwrap();
        assert_eq!(v_mig.0.get("verified").and_then(|v| v.as_bool()), Some(true));

        // 2. Check that the stored hash was transparently upgraded to Argon2id in SQLite
        let upgraded_hash: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'locked_folder_passcode_hash'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(upgraded_hash.starts_with("$argon2id$"));
        assert_ne!(upgraded_hash, legacy_hash);

        // 3. Subsequent verification verifies smoothly against the upgraded Argon2id hash
        let v_second = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: legacy_pass.to_string() }),
        ).await.unwrap();
        assert_eq!(v_second.0.get("verified").and_then(|v| v.as_bool()), Some(true));
    }

    #[tokio::test]
    async fn test_vault_passcode_rate_limiting_lockout() {
        let _lock = VAULT_TEST_LOCK.lock().await;
        use axum::extract::{Json, State};
        use axum::http::StatusCode;
        use crate::routes::settings::{
            setup_locked_folder, verify_locked_folder, reset_vault_rate_limiter,
            LockedFolderSetupRequest, LockedFolderVerifyRequest,
        };

        reset_vault_rate_limiter();
        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());


        let _ = setup_locked_folder(
            State(state.clone()),
            Json(LockedFolderSetupRequest { passcode: "mySecureVault".to_string() }),
        ).await.unwrap();


        // 5 consecutive failed attempts
        for i in 1..=5 {
            let res = verify_locked_folder(
                State(state.clone()),
                Json(LockedFolderVerifyRequest { passcode: format!("invalid-{}", i) }),
            ).await.unwrap();
            assert_eq!(res.0.get("verified").and_then(|v| v.as_bool()), Some(false));
        }

        // 6th attempt: should trigger rate-limiting lockout (HTTP 429)
        let lockout_res = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: "mySecureVault".to_string() }),
        ).await;

        assert!(lockout_res.is_err());
        let (status, err_msg) = lockout_res.unwrap_err();
        assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
        assert!(err_msg.contains("Too many failed attempts"));

        // Reset and verify unlock
        reset_vault_rate_limiter();
        let ok_res = verify_locked_folder(
            State(state.clone()),
            Json(LockedFolderVerifyRequest { passcode: "mySecureVault".to_string() }),
        ).await.unwrap();
        assert_eq!(ok_res.0.get("verified").and_then(|v| v.as_bool()), Some(true));
    }

    #[test]
    fn test_binary_embedding_simd_and_encoding() {
        use crate::services::agent_search::{
            encode_f32_slice_to_blob, decode_blob_to_f32_vec, dot_product_blob, dot_product_simd,
        };

        let sample_vector = vec![0.35f32, -0.25, 0.85, 0.12, -0.99, 0.44];
        let blob = encode_f32_slice_to_blob(&sample_vector);

        // 6 floats * 4 bytes = 24 bytes
        assert_eq!(blob.len(), 24);

        // Decode back and check exact equality
        let decoded = decode_blob_to_f32_vec(&blob);
        assert_eq!(decoded, sample_vector);

        // SIMD dot product with identical vector
        let dot_simd = dot_product_simd(&sample_vector, &decoded);
        let dot_blob = dot_product_blob(&sample_vector, &blob).unwrap();
        assert!((dot_simd - dot_blob).abs() < 1e-6);

        // Mismatched length returns None
        let short_blob = encode_f32_slice_to_blob(&sample_vector[..4]);
        assert!(dot_product_blob(&sample_vector, &short_blob).is_none());
    }

    #[tokio::test]
    async fn test_binary_vector_search_and_json_fallback() {
        use crate::services::agent_search::{encode_f32_slice_to_blob, SearchTools};

        let pool = init_db("sqlite::memory:").await.unwrap();

        // Target vector 1 (Stored as binary BLOB): [1.0, 0.0, 0.0]
        let v1 = vec![1.0f32, 0.0, 0.0];
        let b1 = encode_f32_slice_to_blob(&v1);
        sqlx::query(
            "INSERT INTO photos (filename, path, width, height, aspect_ratio, embedding_blob)
             VALUES ('photo1.jpg', 'uploads/photo1.jpg', 100, 100, 1.0, ?)"
        )
        .bind(&b1)
        .execute(&pool)
        .await
        .unwrap();

        // Target vector 2 (Stored as legacy JSON string): [0.95, 0.05, 0.0]
        let v2 = vec![0.95f32, 0.05, 0.0];
        let j2 = serde_json::to_string(&v2).unwrap();
        sqlx::query(
            "INSERT INTO photos (filename, path, width, height, aspect_ratio, embedding)
             VALUES ('photo2.jpg', 'uploads/photo2.jpg', 100, 100, 1.0, ?)"
        )
        .bind(&j2)
        .execute(&pool)
        .await
        .unwrap();

        // Target vector 3 (Dissimilar, below 0.15 threshold): [-0.8, 0.0, 0.0]
        let v3 = vec![-0.8f32, 0.0, 0.0];
        let b3 = encode_f32_slice_to_blob(&v3);
        sqlx::query(
            "INSERT INTO photos (filename, path, width, height, aspect_ratio, embedding_blob)
             VALUES ('photo3.jpg', 'uploads/photo3.jpg', 100, 100, 1.0, ?)"
        )
        .bind(&b3)
        .execute(&pool)
        .await
        .unwrap();

        let search_tools = SearchTools::new(pool.clone(), None, None);

        // Search similar images using Photo 1 (id=1) as the query embedding
        let results = search_tools.similar_image(1, 10, false, false).await;

        // Photo 2 has high similarity (0.95 >= 0.15) and should be returned
        // Photo 3 has negative similarity and should be filtered out
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], 2);
    }

    #[tokio::test]
    async fn test_path_traversal_validation() {
        use crate::routes::photos::safe_resolve_library_path;

        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        // Sensitive paths outside library
        let forbidden_paths = ["/etc/passwd", "/etc/shadow", "/var/log/syslog"];
        for path in forbidden_paths {
            if std::path::Path::new(path).exists() {
                let res = safe_resolve_library_path(path, &state).await;
                assert!(res.is_err());
                let (status, _) = res.unwrap_err();
                assert_eq!(status, axum::http::StatusCode::FORBIDDEN);
            }
        }
    }

    #[tokio::test]
    async fn test_lan_beacon_ip_and_nearby() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        let local_ip = state.lan_beacon.get_local_ip();
        assert!(!local_ip.is_empty());

        let nearby = state.lan_beacon.get_nearby_peers().await;
        // Initially empty
        assert!(nearby.is_empty());

        let net_info = crate::routes::lan_sync::get_network_info(axum::extract::State(state.clone())).await.unwrap();
        assert_eq!(net_info.0["port"], state.config.port);
        assert_eq!(net_info.0["local_ip"], local_ip);
    }

    #[tokio::test]
    async fn test_capabilities_registry_and_unload() {
        use axum::extract::{Path, State, Json};
        use crate::routes::capabilities::{get_capabilities, toggle_capability, unload_all_capabilities, TogglePayload};

        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        let res = get_capabilities(State(state.clone())).await.unwrap();
        let caps = &res.0["capabilities"];
        assert_eq!(caps["core_media"]["state"], "ready");
        assert_eq!(caps["video_editor"]["state"], "ready");
        assert_eq!(caps["easy_share"]["state"], "ready");
        assert!(caps.get("semantic_search").is_some());
        assert!(caps.get("face_recognition").is_some());
        assert!(caps.get("magic_eraser").is_some());
        assert!(caps.get("ocr").is_some());

        assert!(res.0.get("hardware").is_some());
        assert_eq!(res.0["server_mode"], "local_bundled");

        // Toggle feature off
        let toggle_res = toggle_capability(
            State(state.clone()),
            Path("semantic_search".to_string()),
            Json(TogglePayload { enabled: false }),
        ).await.unwrap();
        assert_eq!(toggle_res.0["enabled"], false);

        // Verify state is now "disabled"
        let res2 = get_capabilities(State(state.clone())).await.unwrap();
        assert_eq!(res2.0["capabilities"]["semantic_search"]["state"], "disabled");

        // Unload all
        let unload_res = unload_all_capabilities().await.unwrap();
        assert_eq!(unload_res.0["success"], true);
    }

    #[tokio::test]
    async fn test_durable_jobs_lifecycle() {
        use axum::extract::{Path, Query, State};
        use crate::routes::jobs::{list_jobs, cancel_job, retry_job, prune_jobs, JobQueryParams};

        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());

        // Insert a generic system task (photo_id = NULL)
        let row_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO background_jobs (job_type, title, status, current_stage, progress_pct, total_items, processed_items)
            VALUES ('model_download', 'Download SigLIP2 Model', 'processing', 'downloading_weights', 45.0, 100, 45)
            RETURNING id;
            "#
        )
        .fetch_one(&state.db)
        .await
        .unwrap();

        // 1. List jobs
        let list_res = list_jobs(State(state.clone()), Query(JobQueryParams { status: None, limit: None, offset: None })).await.unwrap();
        let jobs = list_res.0["jobs"].as_array().unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0]["title"], "Download SigLIP2 Model");
        assert_eq!(jobs[0]["status"], "processing");
        assert_eq!(jobs[0]["progress_pct"], 45.0);
        assert_eq!(list_res.0["counts"]["processing"], 1);

        // 2. Cancel job
        let cancel_res = cancel_job(State(state.clone()), Path(row_id)).await.unwrap();
        assert_eq!(cancel_res.0["status"], "cancelled");

        let list_res2 = list_jobs(State(state.clone()), Query(JobQueryParams { status: None, limit: None, offset: None })).await.unwrap();
        assert_eq!(list_res2.0["counts"]["cancelled"], 1);

        // 3. Retry job
        let retry_res = retry_job(State(state.clone()), Path(row_id)).await.unwrap();
        assert_eq!(retry_res.0["status"], "pending");

        // 4. Mark completed and test prune
        sqlx::query("UPDATE background_jobs SET status = 'completed' WHERE id = ?")
            .bind(row_id)
            .execute(&state.db)
            .await
            .unwrap();

        let prune_res = prune_jobs(State(state.clone())).await.unwrap();
        assert_eq!(prune_res.0["pruned_count"], 1);

        let list_res3 = list_jobs(State(state.clone()), Query(JobQueryParams { status: None, limit: None, offset: None })).await.unwrap();
        assert_eq!(list_res3.0["jobs"].as_array().unwrap().len(), 0);
    }

    // ─── Vault encryption-at-rest & reliability schema regression tests ─────

    use tempfile::TempDir;
    use std::path::PathBuf;

    fn make_jpeg_bytes(width: u32, height: u32, color: [u8; 3]) -> Vec<u8> {
        let _ = color;
        let img = image::DynamicImage::new_rgb8(width, height);
        let mut buf = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
            .unwrap();
        buf
    }

    async fn insert_test_photo(pool: &crate::db::DbPool, path: &str, locked: bool) -> i64 {
        sqlx::query(
            "INSERT INTO photos (uuid, filename, path, width, height, aspect_ratio, is_locked) \
             VALUES (?, ?, ?, 100, 100, 1.0, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind("test.jpg")
        .bind(path)
        .bind(locked)
        .execute(pool)
        .await
        .unwrap()
        .last_insert_rowid()
    }

    /// GAP 1: the reliability schema must exist — cull/health routes query
    /// these tables/columns unconditionally, so a missing one breaks boot-time
    /// parity for every fresh install.
    #[tokio::test]
    async fn test_reliability_schema_tables_and_columns_exist() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // library_backups table is writable with the exact columns used by routes
        let res = sqlx::query(
            "INSERT INTO library_backups (filename, path, size_bytes, integrity_status) VALUES (?, ?, ?, ?)",
        )
        .bind("prism_backup_test.db")
        .bind("backups/prism_backup_test.db")
        .bind(1234i64)
        .bind("ok")
        .execute(&pool)
        .await
        .unwrap();
        assert!(res.last_insert_rowid() > 0);

        let row: (i64, String, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
            "SELECT id, filename, created_at FROM library_backups WHERE id = ?",
        )
        .bind(res.last_insert_rowid())
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row.1, "prism_backup_test.db");
        let _ = row.0;
        let _ = row.2;

        // Culling columns accept the tri-state values and ratings used by /cull
        let photo_id = insert_test_photo(&pool, "/tmp/nonexistent.jpg", false).await;
        sqlx::query("UPDATE photos SET cull_status = 'picked', rating = 4, burst_group_id = 'burst_1' WHERE id = ?")
            .bind(photo_id)
            .execute(&pool)
            .await
            .unwrap();
        let (status, rating, burst): (String, i64, String) = sqlx::query_as(
            "SELECT cull_status, rating, burst_group_id FROM photos WHERE id = ?",
        )
        .bind(photo_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(status, "picked");
        assert_eq!(rating, 4);
        assert_eq!(burst, "burst_1");

        // Health scanner columns update cleanly
        sqlx::query("UPDATE photos SET missing_since = CURRENT_TIMESTAMP, last_verified = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(photo_id)
            .execute(&pool)
            .await
            .unwrap();
        let missing: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
            "SELECT missing_since FROM photos WHERE id = ?",
        )
        .bind(photo_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(missing.is_some());

        // Culling indexes exist (used by burst clustering ORDER BY / WHERE paths)
        let indexes: Vec<String> = sqlx::query_as::<_, (String,)>(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_photos_cull_status', 'idx_photos_burst_group')",
        )
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|r| r.0)
        .collect();
        assert_eq!(indexes.len(), 2, "culling indexes missing: {:?}", indexes);
    }

    /// GAP 2 + 3: lock → encrypt-at-rest → decrypt-on-serve → unlock round trip.
    #[tokio::test]
    async fn test_vault_lock_unlock_round_trip_and_decrypt_on_serve() {
        let _lock = VAULT_TEST_LOCK.lock().await;
        use axum::extract::{Json, State};
        use crate::routes::photos_ai::{toggle_lock, LockRequest};
        use crate::routes::photos_ai::unlock_photo;

        let pool = init_db("sqlite::memory:").await.unwrap();
        let state = create_test_state(pool.clone());
        let temp = TempDir::new().unwrap();
        let photo_path = temp.path().join("secret.jpg");
        let original_bytes = make_jpeg_bytes(64, 64, [200, 30, 30]);
        std::fs::write(&photo_path, &original_bytes).unwrap();
        let path_str = photo_path.to_string_lossy().to_string();

        let photo_id = insert_test_photo(&pool, &path_str, false).await;
        let photo_uuid: String =
            sqlx::query_scalar("SELECT uuid FROM photos WHERE id = ?")
                .bind(photo_id)
                .fetch_one(&pool)
                .await
                .unwrap();

        // Initialize the vault (derives Argon2id key, sets master key) so
        // locking performs real encryption instead of legacy flag-only mode.
        let setup = crate::routes::vault::setup_vault(
            State(state.clone()),
            Json(crate::routes::vault::VaultSetupRequest {
                password: "roundTrip1".to_string(),
                enable_os_escrow: false,
            }),
        )
        .await
        .unwrap();
        assert_eq!(setup.0["status"], "success");

        // The vault manager must hold the unlocked master key after setup.
        assert!(crate::services::vault_crypto::get_vault().is_unlocked());

        // 1. Lock the photo via the handler.
        let lock_res = toggle_lock(
            State(state.clone()),
            axum::extract::Path(photo_uuid.clone()),
            Json(LockRequest { lock: true, passcode: None }),
        )
        .await
        .unwrap();
        assert_eq!(lock_res.0["is_locked"], true);

        // 2. Plaintext must be shredded; ciphertext must exist and differ.
        assert!(!photo_path.exists(), "plaintext original was not shredded");
        let enc_path = PathBuf::from(format!("{}.prism_enc", path_str));
        assert!(enc_path.exists(), ".prism_enc ciphertext missing after lock");
        let ciphertext = std::fs::read(&enc_path).unwrap();
        assert_ne!(ciphertext, original_bytes);
        assert!(ciphertext.len() > 12, "ciphertext missing nonce prefix");

        // 3. Serving path resolves the ciphertext even though plaintext is gone.
        let resolved = crate::routes::photos::resolve_photo_content_paths(&path_str);
        assert!(resolved.plaintext.is_none());
        assert!(resolved.encrypted.is_some());

        // 4. Unlock restores the exact original bytes and removes ciphertext.
        let unlock_res = unlock_photo(
            State(state.clone()),
            axum::extract::Path(photo_uuid),
        )
        .await
        .unwrap();
        assert_eq!(unlock_res.0["is_locked"], false);
        assert!(photo_path.exists(), "plaintext not restored on unlock");
        let restored = std::fs::read(&photo_path).unwrap();
        assert_eq!(restored, original_bytes, "restored bytes differ from original");
        assert!(!enc_path.exists(), "ciphertext not removed after unlock");
    }

    /// GAP 3: decrypt-on-serve — a locked photo's bytes decrypt in memory via
    /// the vault key and match the original; a wrong key fails closed.
    #[tokio::test]
    async fn test_vaulted_photo_decrypt_matches_original_and_wrong_key_fails() {
        let temp = TempDir::new().unwrap();
        let photo_path = temp.path().join("enc_served.jpg");
        let original = make_jpeg_bytes(32, 32, [10, 120, 250]);
        std::fs::write(&photo_path, &original).unwrap();
        let path_str = photo_path.to_string_lossy().to_string();

        let key = [7u8; 32];
        let wrong_key = [8u8; 32];
        let enc_path = PathBuf::from(format!("{}.prism_enc", path_str));
        crate::services::vault_crypto::VaultManager::encrypt_file(
            &photo_path,
            &enc_path,
            &key,
        )
        .unwrap();
        std::fs::remove_file(&photo_path).unwrap(); // simulate shredded plaintext

        // Resolution must find the ciphertext without the plaintext present.
        let resolved = crate::routes::photos::resolve_photo_content_paths(&path_str);
        assert!(resolved.encrypted.is_some(), "ciphertext not resolved without plaintext");

        // Decrypt with the right key → exact original bytes.
        let decrypted = crate::services::vault_crypto::VaultManager::decrypt_file(
            resolved.encrypted.as_ref().unwrap(),
            &key,
        )
        .unwrap();
        assert_eq!(decrypted, original);

        // Decrypt with the wrong key → hard failure, never garbage.
        assert!(crate::services::vault_crypto::VaultManager::decrypt_file(
            resolved.encrypted.as_ref().unwrap(),
            &wrong_key,
        )
        .is_err());
    }

    /// Vaulted thumbnails are stored encrypted (.thumb_enc), never as plaintext JPEGs.
    #[tokio::test]
    async fn test_vault_thumbnail_is_encrypted_at_rest() {
        let temp = TempDir::new().unwrap();
        let thumbs = temp.path().join("thumbs");
        let decrypted = make_jpeg_bytes(200, 200, [1, 2, 3]);
        let key = [42u8; 32];

        let enc_thumb = crate::services::thumbnail::generate_vault_thumbnail(
            &decrypted,
            &thumbs,
            999,
            400,
            &key,
        )
        .unwrap();

        assert!(enc_thumb.to_string_lossy().ends_with(".thumb_enc"));
        let on_disk = std::fs::read(&enc_thumb).unwrap();
        assert_ne!(on_disk, decrypted, "thumbnail plaintext leaked to disk");
        assert!(on_disk.len() > 12);

        // Second call is a cache hit (same path, no regeneration error).
        let again = crate::services::thumbnail::generate_vault_thumbnail(
            &decrypted,
            &thumbs,
            999,
            400,
            &key,
        )
        .unwrap();
        assert_eq!(enc_thumb, again);

        // Serving decrypts back to a valid JPEG at the thumbnail size.
        let plain = crate::services::vault_crypto::VaultManager::decrypt_file(&enc_thumb, &key).unwrap();
        let decoded = image::load_from_memory(&plain).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (400u32, 400u32));
    }

    // ── Watch folder & purge folder ───────────────────────────────────────

    use crate::services::importer::{expand_tilde, import_file};
    use crate::services::watcher::{collect_media_files, is_path_excluded};

    /// Like `create_test_state`, but with `thumbnails_dir` pointed at a test
    /// temp dir so nothing is written to the repo-relative ./thumbnails.
    fn create_test_state_with_thumbs(
        pool: crate::db::DbPool,
        thumbnails_dir: PathBuf,
    ) -> std::sync::Arc<crate::AppState> {
        use crate::config::Config;
        use crate::services::llm_client::LlmClient;
        use crate::services::llm_server::LlmServer;
        use crate::services::ml_client::MlClient;
        use crate::services::model_manager::ModelManager;
        use crate::services::packs::PackManager;
        use crate::services::plugins::PluginManager;
        use crate::services::telemetry::TelemetryService;
        use crate::services::worker::{AnalyzerRegistry, JobScheduler, WorkerState};
        use std::sync::Arc;

        let config = Config {
            port: 8269,
            host: "127.0.0.1".to_string(),
            database_url: "sqlite::memory:".to_string(),
            upload_dir: PathBuf::from("uploads"),
            thumbnails_dir,
            api_key: None,
            gpu_mode: "cpu".to_string(),
            models_dir: PathBuf::from("models"),
            packs_dir: PathBuf::from("packs"),
            plugins_dir: PathBuf::from("plugins"),
            map_cache_dir: PathBuf::from("map_cache"),
        };

        let llm_server = LlmServer::new(config.models_dir.clone(), config.gpu_mode.clone());
        let ml_client = MlClient::new(LlmClient::new(llm_server));
        let telemetry = TelemetryService::new(pool.clone());
        let registry = Arc::new(AnalyzerRegistry::new());
        let worker = WorkerState::new(&registry.names());
        let scheduler = JobScheduler::new(config.upload_dir.clone());
        let model_manager = Arc::new(ModelManager::new(config.models_dir.clone()));
        let pack_manager = Arc::new(PackManager::new(config.packs_dir.clone(), config.models_dir.clone()));
        let plugin_manager = Arc::new(PluginManager::new(
            config.plugins_dir.clone(),
            config.packs_dir.clone(),
            config.models_dir.clone(),
        ));
        let lan_beacon = Arc::new(crate::services::lan_beacon::LanBeaconService::new(
            "test_peer".to_string(),
            config.port,
        ));

        Arc::new(crate::AppState {
            config,
            db: pool,
            ml_client,
            telemetry,
            worker,
            scheduler,
            registry,
            model_manager,
            pack_manager,
            plugin_manager,
            lan_beacon,
        })
    }

    /// Helper: writes fake media files into a temp tree and indexes one via
    /// the shared importer.
    async fn seed_watched_tree(dir: &std::path::Path) -> (Vec<PathBuf>, PathBuf) {
        let sub = dir.join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        let files = vec![
            dir.join("a.jpg"),
            dir.join("b.png"),
            sub.join("c.jpg"),
            dir.join("notes.txt"), // non-media: must never be imported
            dir.join(".hidden.jpg"),
            dir.join("x.prism_enc"),
        ];
        for (i, f) in files.iter().enumerate() {
            let bytes = if f.extension().and_then(|e| e.to_str()) == Some("png") {
                make_png_bytes(20 + i as u32, 20)
            } else {
                make_jpeg_bytes(30 + i as u32, 30, [i as u8, 40, 90])
            };
            std::fs::write(f, bytes).unwrap();
        }
        (files, sub)
    }

    fn make_png_bytes(width: u32, height: u32) -> Vec<u8> {
        let img = image::DynamicImage::new_rgb8(width, height);
        let mut buf = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    #[tokio::test]
    async fn test_importer_imports_in_place_and_dedupes() {
        let temp = TempDir::new().unwrap();
        let pool = init_db("sqlite::memory:").await.unwrap();
        // Point thumbnails at a temp dir so the test never writes to ./thumbnails.
        let thumbs = temp.path().join("thumbs");
        std::fs::create_dir_all(&thumbs).unwrap();
        let state = create_test_state_with_thumbs(pool.clone(), thumbs);

        let media = temp.path().join("media");
        std::fs::create_dir_all(&media).unwrap();
        let photo_path = media.join("pic.jpg");
        std::fs::write(&photo_path, make_jpeg_bytes(80, 60, [10, 20, 30])).unwrap();

        // First import: new row, in place (original file still at its path).
        let (photo, newly) = import_file(&state, &photo_path).await.unwrap();
        assert!(newly);
        assert_eq!(photo.path, photo_path.to_string_lossy().to_string());
        assert!(photo_path.exists(), "import must not move or copy the file");
        assert_eq!(photo.file_type, "image");

        // Second import of the same path: dedupe, not a duplicate row.
        let (again, newly2) = import_file(&state, &photo_path).await.unwrap();
        assert!(!newly2);
        assert_eq!(again.id, photo.id);
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "path-dedupe must prevent duplicate rows");

        // Video extension is classified as a video row.
        let vid = media.join("clip.mp4");
        std::fs::write(&vid, b"fake video bytes").unwrap();
        let (vphoto, vnewly) = import_file(&state, &vid).await.unwrap();
        assert!(vnewly);
        assert_eq!(vphoto.file_type, "video");

        // expand_tilde resolves $HOME paths.
        std::env::set_var("HOME", "/home/testuser");
        assert_eq!(expand_tilde("~/Pictures"), PathBuf::from("/home/testuser/Pictures"));
        assert_eq!(expand_tilde("/abs/path"), PathBuf::from("/abs/path"));
    }

    #[tokio::test]
    async fn test_watcher_scan_respects_exclusions_toggle_and_artifacts() {
        let temp = TempDir::new().unwrap();
        let pool = init_db("sqlite::memory:").await.unwrap();
        let thumbs = temp.path().join("thumbs");
        std::fs::create_dir_all(&thumbs).unwrap();
        let state = create_test_state_with_thumbs(pool.clone(), thumbs);

        let watched = temp.path().join("watched");
        let excluded_sub = watched.join("private");
        std::fs::create_dir_all(&excluded_sub).unwrap();
        let (_files, _sub) = seed_watched_tree(&watched).await;
        let secret = excluded_sub.join("secret.jpg");
        std::fs::write(&secret, make_jpeg_bytes(50, 50, [9, 9, 9])).unwrap();

        // Simulate a pre-exclusion library state: index everything the
        // collector finds with no exclusion list (a.jpg, b.png, secret.jpg,
        // sub/c.jpg) — exactly 4 media files in the tree.
        let mut discovered = Vec::new();
        collect_media_files(&watched, &[], &mut discovered);
        discovered.sort();
        for f in &discovered {
            import_file(&state, f).await.unwrap();
        }
        let indexed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(indexed, 4, "importer must index exactly the 4 media files");

        // Collect with exclusion of watched/private → only top-level media.
        let excluded = vec![excluded_sub.clone()];
        let mut found = Vec::new();
        collect_media_files(&watched, &excluded, &mut found);
        found.sort();
        let names: Vec<String> = found
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"a.jpg".to_string()), "got {:?}", names);
        assert!(names.contains(&"b.png".to_string()), "got {:?}", names);
        assert!(names.contains(&"c.jpg".to_string()), "got {:?}", names);
        assert!(!names.contains(&"notes.txt".to_string()), "non-media must be skipped");
        assert!(!names.contains(&"secret.jpg".to_string()), "excluded root leaked");
        assert!(!names.contains(&".hidden.jpg".to_string()), "hidden file leaked");
        assert!(!names.contains(&"x.prism_enc".to_string()), "vault artifact leaked");
        assert!(is_path_excluded(&secret, &excluded));
        assert!(!is_path_excluded(&watched.join("a.jpg"), &excluded));

        // Exclusions come from the excluded_folders setting, tilde-expanded.
        sqlx::query("INSERT INTO settings (key, value) VALUES ('watched_folders', ?)")
            .bind(serde_json::json!([watched.to_string_lossy()]).to_string())
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO settings (key, value) VALUES ('excluded_folders', ?)")
            .bind(serde_json::json!([excluded_sub.to_string_lossy()]).to_string())
            .execute(&pool)
            .await
            .unwrap();

        // Purge-folder honors the exact-prefix scope: /watched does NOT match
        // a sibling /watched_other, and purging cleans relational data.
        let sibling = watched.parent().unwrap().join("watched_other");
        std::fs::create_dir_all(&sibling).unwrap();
        let sib_photo = sibling.join("sib.jpg");
        std::fs::write(&sib_photo, make_jpeg_bytes(40, 40, [1, 1, 1])).unwrap();
        let (sib, _) = import_file(&state, &sib_photo).await.unwrap();

        use axum::extract::{Json, State};
        use crate::routes::settings::{purge_folder, PurgeFolderRequest};
        let res = purge_folder(
            State(state.clone()),
            Json(PurgeFolderRequest { folder_path: watched.to_string_lossy().to_string() }),
        )
        .await
        .unwrap();
        assert_eq!(res.0.get("status").and_then(|v| v.as_str()), Some("success"));
        let deleted = res.0.get("deleted_count").and_then(|v| v.as_i64()).unwrap();
        assert_eq!(deleted, 4, "a.jpg, b.png, c.jpg, private/secret.jpg — got {:?}", res.0);

        // Sibling folder sharing a string prefix must survive.
        let sib_left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE id = ?")
            .bind(sib.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(sib_left, 1, "sibling prefix over-match");

        // Relational cleanup happened for the purged photos.
        let orphan_jobs: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM background_jobs WHERE photo_id NOT IN (SELECT id FROM photos)")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(orphan_jobs, 0, "background_jobs orphans after purge");
    }
}


