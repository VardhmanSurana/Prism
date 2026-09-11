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
}

