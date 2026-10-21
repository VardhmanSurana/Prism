//! Watch-folder indexer.
//!
//! The settings UI lets users register "Watched Library Territories"
//! (`watched_folders`) with an exclusion list (`excluded_folders`) and an
//! "Automatic System File Watcher" toggle (`sync_enabled`). This module is the
//! engine those settings promise:
//!
//! 1. **Initial scan** at startup and a **periodic rescan** (every 60s) walk
//!    watched folders (recursively), importing new media in place.
//! 2. **Live FS events** via the `notify` crate: newly created files in
//!    watched folders are imported near-real-time (debounced), so saves from
//!    other apps appear without waiting for the next periodic tick.
//!
//! Respects:
//! - `sync_enabled` (`false` pauses both scanning and FS events)
//! - `excluded_folders` (paths inside an excluded root are never imported)
//! - vault privacy: never imports `*.prism_enc`, `*.prism_backup*`, lock
//!   files, or hidden entries
//!
//! All DB writes go through `services::importer::import_file` (dedupe by
//! absolute path), so rescans are cheap and safe to run alongside uploads.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecursiveMode, Watcher as _};
use serde::Serialize;
use tokio::sync::Notify;

use crate::AppState;
use crate::services::importer::{expand_tilde, import_batch, is_importable_media};

/// How often the periodic watched-folder rescan runs.
const RESCAN_INTERVAL: Duration = Duration::from_secs(60);
/// Quiet period after the last FS event before the debounced import runs.
const EVENT_DEBOUNCE: Duration = Duration::from_millis(2000);
/// Poll cadence of the FS-event debounce loop.
const EVENT_TICK: Duration = Duration::from_millis(500);
/// Maximum queued event paths before oldest entries are dropped.
const EVENT_QUEUE_CAP: usize = 10_000;

/// Outcome counters of the most recent completed scan.
#[derive(Debug, Default, Clone, Serialize)]
pub struct ScanSummary {
    pub imported: u64,
    pub skipped: u64,
    pub failed: u64,
    /// Whether the scan was triggered manually (Rescan Now) vs automatic.
    pub manual: bool,
    /// `sync_enabled` value observed when the scan ran.
    pub auto_enabled: bool,
}

/// Shared watcher state: counters, last-scan summary, manual-rescan signal.
///
/// Lives in a global `OnceLock` so the settings endpoints can read status and
/// request rescans without threading the handle through `AppState`.
#[derive(Debug, Default)]
pub struct WatcherStatus {
    pub last_scan_started_ms: AtomicU64,
    pub last_scan_finished_ms: AtomicU64,
    pub total_imported: AtomicU64,
    /// Set while a scan is walking/importing (guards against overlap).
    pub is_scanning: AtomicBool,
    /// Summary of the last completed scan.
    pub last_summary: Mutex<Option<ScanSummary>>,
    /// Manual rescan signal: waking this runs a scan immediately.
    pub rescan_notify: Notify,
}

impl WatcherStatus {
    fn note_scan_start(&self) {
        self.is_scanning.store(true, Ordering::Relaxed);
        self.last_scan_started_ms.store(now_ms(), Ordering::Relaxed);
    }

    fn note_scan_finish(&self, summary: ScanSummary) {
        self.total_imported.fetch_add(summary.imported, Ordering::Relaxed);
        *self.last_summary.lock().unwrap() = Some(summary);
        self.last_scan_finished_ms.store(now_ms(), Ordering::Relaxed);
        self.is_scanning.store(false, Ordering::Relaxed);
    }
}

fn now_ms() -> u64 {
    chrono::Utc::now().timestamp_millis().max(0) as u64
}

/// Global watcher handle, registered by `spawn_watcher`.
static WATCHER: OnceLock<Arc<WatcherStatus>> = OnceLock::new();

/// handle - The process-wide watcher status (initializes on first use).
fn handle() -> Arc<WatcherStatus> {
    WATCHER.get_or_init(|| Arc::new(WatcherStatus::default())).clone()
}

/// JSON snapshot of watcher state for the settings UI.
#[derive(Debug, Clone, Serialize, Default)]
pub struct WatcherSnapshot {
    pub is_scanning: bool,
    pub auto_enabled: bool,
    pub total_imported: u64,
    pub last_scan_imported: u64,
    pub last_scan_skipped: u64,
    pub last_scan_failed: u64,
    pub last_scan_manual: bool,
    pub last_scan_started_ms: u64,
    pub last_scan_finished_ms: u64,
}

/// snapshot_status - Current watcher status for diagnostics/UI polling.
pub fn snapshot_status() -> WatcherSnapshot {
    let h = handle();
    let summary = h.last_summary.lock().unwrap().clone().unwrap_or_default();
    WatcherSnapshot {
        is_scanning: h.is_scanning.load(Ordering::Relaxed),
        auto_enabled: summary.auto_enabled,
        total_imported: h.total_imported.load(Ordering::Relaxed),
        last_scan_imported: summary.imported,
        last_scan_skipped: summary.skipped,
        last_scan_failed: summary.failed,
        last_scan_manual: summary.manual,
        last_scan_started_ms: h.last_scan_started_ms.load(Ordering::Relaxed),
        last_scan_finished_ms: h.last_scan_finished_ms.load(Ordering::Relaxed),
    }
}

/// request_rescan - Queues an immediate manual rescan of watched folders.
/// Coalesces concurrent requests; the scan runs on the watcher loop.
pub fn request_rescan() {
    handle().rescan_notify.notify_one();
}

/// Snapshot of watch-folder settings read from the `settings` table.
#[derive(Debug, Clone, PartialEq)]
struct WatchConfig {
    sync_enabled: bool,
    watched: Vec<PathBuf>,
    excluded: Vec<PathBuf>,
}

/// Reads watched/excluded folders + the sync toggle from the settings table.
async fn read_watch_config(db: &crate::db::DbPool) -> WatchConfig {
    async fn read_list(db: &crate::db::DbPool, key: &str) -> Vec<PathBuf> {
        let stored: Option<String> =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
                .bind(key)
                .fetch_optional(db)
                .await
                .ok()
                .flatten();

        stored
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.as_str())
                        .map(expand_tilde)
                        .collect::<Vec<_>>()
                })
            })
            .unwrap_or_default()
    }

    let watched = read_list(db, "watched_folders").await;
    let excluded = read_list(db, "excluded_folders").await;
    let sync_enabled: bool = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'sync_enabled'",
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .map(|v| v == "true")
    .unwrap_or(true);

    WatchConfig {
        sync_enabled,
        watched,
        excluded,
    }
}

/// is_path_excluded - True when `path` equals or is inside any excluded root.
pub fn is_path_excluded(path: &Path, excluded: &[PathBuf]) -> bool {
    excluded.iter().any(|root| path.starts_with(root))
}

/// is_vault_artifact - True for vault/backup/lock artifacts that must never be
/// indexed as media.
fn is_vault_artifact(name: &str) -> bool {
    name.starts_with('.')
        || name.ends_with(".prism_enc")
        || name.ends_with(".prism_backup")
        || name.ends_with(".prism_backup.lock")
}

/// collect_media_files - Recursively collects importable media files under
/// `dir`, skipping excluded roots, hidden entries, and vault artifacts.
pub fn collect_media_files(dir: &Path, excluded: &[PathBuf], out: &mut Vec<PathBuf>) {
    if is_path_excluded(dir, excluded) {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if is_vault_artifact(name) {
            continue;
        }
        match entry.file_type() {
            Ok(t) if t.is_dir() => collect_media_files(&path, excluded, out),
            Ok(t) if t.is_file() => {
                if is_importable_media(&path) {
                    out.push(path);
                }
            }
            _ => {}
        }
    }
}

/// Drops paths that are already indexed. Returns the remaining new files.
async fn filter_unindexed(db: &crate::db::DbPool, files: Vec<PathBuf>) -> Vec<PathBuf> {
    let existing: HashSet<String> =
        sqlx::query_as::<_, (String,)>("SELECT path FROM photos")
            .fetch_all(db)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|(p,)| p)
            .collect();
    files
        .into_iter()
        .filter(|p| !existing.contains(&p.to_string_lossy().to_string()))
        .collect()
}

/// run_scan - One full scan of all watched folders, importing new media.
///
/// `manual = true` (Rescan Now) bypasses the `sync_enabled` toggle — the user
/// explicitly asked — while automatic scans respect it. Overlapping scans are
/// skipped (the in-progress one covers both). Every completed scan records a
/// [`ScanSummary`] in the global status for the settings UI.
pub async fn run_scan(state: &AppState, manual: bool) {
    let status = handle();

    // Skip if a scan is already running (coalesce periodic + manual overlap).
    if status
        .is_scanning
        .compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed)
        .is_err()
    {
        return;
    }

    let cfg = read_watch_config(&state.db).await;
    if !manual && (!cfg.sync_enabled || cfg.watched.is_empty()) {
        // Automatic scans quietly no-op when disabled; release the flag.
        status.is_scanning.store(false, Ordering::Relaxed);
        return;
    }
    status.note_scan_start();

    let mut files = Vec::new();
    for dir in &cfg.watched {
        if dir.is_dir() {
            collect_media_files(dir, &cfg.excluded, &mut files);
        } else if dir.is_file() && is_importable_media(dir) {
            // Tolerate a file path accidentally saved as a watched "folder".
            files.push(dir.clone());
        }
    }

    let files = filter_unindexed(&state.db, files).await;
    let total = files.len();
    let mut summary = ScanSummary {
        manual,
        auto_enabled: cfg.sync_enabled,
        ..ScanSummary::default()
    };
    if total > 0 {
        tracing::info!(
            "watcher: scanning {} new media file(s) in watched folders{}",
            total,
            if manual { " (manual)" } else { "" }
        );
        let stats = import_batch(state, &files).await;
        summary.imported = stats.imported as u64;
        summary.skipped = stats.skipped as u64;
        summary.failed = stats.failed as u64;
        tracing::info!(
            "watcher: scan finished: {} imported, {} skipped, {} failed",
            stats.imported,
            stats.skipped,
            stats.failed
        );
    }
    status.note_scan_finish(summary);
}

/// event_path_is_watched - Re-validates an FS-event path against the *current*
/// config (watched roots may have changed while events were queued).
fn event_path_is_watched(path: &Path, cfg: &WatchConfig) -> bool {
    if is_path_excluded(path, &cfg.excluded) || is_vault_artifact(&path.to_string_lossy()) {
        return false;
    }
    cfg.watched
        .iter()
        .any(|root| path.starts_with(root) && is_importable_media(path))
}

/// spawn_watcher - Spawns the watch-folder indexer for the running server:
/// an initial startup scan, a periodic rescan loop (which also services manual
/// "Rescan Now" requests), and a debounced FS-event import loop. Errors are
/// logged, never fatal.
pub fn spawn_watcher(state: Arc<AppState>) {
    // Register the global handle so endpoints can read status / request
    // rescans before/while the loops are running.
    let _ = handle();

    // Initial startup scan (short delay so the DB is warm).
    {
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(3)).await;
            run_scan(&state, false).await;
        });
    }

    // Periodic rescan loop; also services manual rescan requests.
    {
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(RESCAN_INTERVAL);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            interval.tick().await; // first tick fires immediately; skip it
            loop {
                let watcher_status = handle();
                let manual = tokio::select! {
                    _ = interval.tick() => false,
                    _ = watcher_status.rescan_notify.notified() => true,
                };
                run_scan(&state, manual).await;
            }
        });
    }

    // FS-event loop: watch current roots recursively, debounce creates,
    // re-validate against the live config, then import.
    {
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            // Builds a fresh (watcher, receiver) pair. Recreating the watcher
            // on resubscribe drops the old subscription set atomically; the
            // sender lives inside the notify callback closure.
            fn make_watcher() -> Result<
                (
                    notify::RecommendedWatcher,
                    tokio::sync::mpsc::UnboundedReceiver<PathBuf>,
                ),
                notify::Error,
            > {
                let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<PathBuf>();
                let watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
                    if let Ok(event) = res {
                        if matches!(event.kind, EventKind::Create(_)) {
                            for path in event.paths {
                                let _ = tx.send(path);
                            }
                        }
                    }
                })?;
                Ok((watcher, rx))
            }

            // No subscription until the first config read provides roots.
            let mut watcher: Option<notify::RecommendedWatcher> = None;
            let mut rx: Option<tokio::sync::mpsc::UnboundedReceiver<PathBuf>> = None;

            // Roots currently subscribed to (empty = nothing subscribed).
            let mut subscribed: HashSet<PathBuf> = HashSet::new();
            let mut pending: Vec<PathBuf> = Vec::new();
            let mut last_event: Option<Instant> = None;
            let mut tick = tokio::time::interval(EVENT_TICK);
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

            loop {
                // (Re)subscribe when the watched set changes at runtime.
                let cfg = read_watch_config(&state.db).await;
                let roots: HashSet<PathBuf> = cfg
                    .watched
                    .iter()
                    .filter(|d| d.is_dir() && !is_path_excluded(d, &cfg.excluded))
                    .cloned()
                    .collect();
                if roots != subscribed {
                    if roots.is_empty() {
                        // Nothing to watch (or sync disabled): drop subscription.
                        drop(watcher.take());
                        rx = None;
                        subscribed.clear();
                    } else {
                        let (mut watcher_new, rx_new) = match make_watcher() {
                            Ok(pair) => pair,
                            Err(e) => {
                                tracing::warn!(
                                    "watcher: subscribe failed ({}); periodic scan still active",
                                    e
                                );
                                drop(watcher.take());
                                rx = None;
                                subscribed = roots;
                                continue;
                            }
                        };
                        for root in &roots {
                            if let Err(e) = watcher_new.watch(root, RecursiveMode::Recursive) {
                                tracing::warn!("watcher: cannot watch {:?}: {}", root, e);
                            }
                        }
                        watcher = Some(watcher_new);
                        rx = Some(rx_new);
                        subscribed = roots;
                    }
                }

                tokio::select! {
                    maybe_path = async {
                        match rx.as_mut() {
                            Some(r) => r.recv().await,
                            None => std::future::pending().await,
                        }
                    } => {
                        match maybe_path {
                            Some(path) => {
                                pending.push(path);
                                if pending.len() > EVENT_QUEUE_CAP {
                                    pending.drain(..pending.len() - EVENT_QUEUE_CAP);
                                }
                                last_event = Some(Instant::now());
                            }
                            None => {
                                // Sender dropped (watcher replaced): clear the
                                // stale receiver; a fresh one arrives on resubscribe.
                                rx = None;
                            }
                        }
                    }
                    _ = tick.tick() => {
                        let quiet_long_enough = last_event
                            .map(|t| t.elapsed() >= EVENT_DEBOUNCE)
                            .unwrap_or(false);
                        if pending.is_empty() || !quiet_long_enough {
                            continue;
                        }

                        // Drain and validate against the live config.
                        let mut batch = std::mem::take(&mut pending);
                        batch.sort();
                        batch.dedup();
                        let cfg = read_watch_config(&state.db).await;
                        batch.retain(|p| event_path_is_watched(p, &cfg));
                        last_event = None;

                        if batch.is_empty() || !cfg.sync_enabled {
                            continue;
                        }
                        let batch = filter_unindexed(&state.db, batch).await;
                        if batch.is_empty() {
                            continue;
                        }
                        let stats = import_batch(&state, &batch).await;
                        if stats.imported > 0 {
                            handle()
                                .total_imported
                                .fetch_add(stats.imported as u64, Ordering::Relaxed);
                            tracing::info!(
                                "watcher: imported {} file(s) from FS events",
                                stats.imported
                            );
                        }
                    }
                }
            }
        });
    }
}
