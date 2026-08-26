#[cfg(test)]
mod server_enhancement_tests {
    use crate::db::init_db;
    use crate::services::webhooks::{Webhook, WebhookPayload, WebhookService};

    #[tokio::test]
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
        assert_eq!(packs_info[0].models.len(), 1);

        // Verify model definitions conversion
        let defs = manager.to_model_definitions().await;
        assert_eq!(defs.len(), 1);
        assert!(defs.iter().any(|d| d.id == "isnet-general-use"));

        // Test license acknowledgment
        let isnet_status = packs_info[0].models.iter().find(|m| m.id == "isnet-general-use").unwrap();
        assert_eq!(isnet_status.license_acknowledged, true);
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
}
