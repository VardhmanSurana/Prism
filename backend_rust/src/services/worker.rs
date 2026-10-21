
/// AI Job Scheduler — decides *which* analyzers to run based on system state.
///
/// Instead of a dumb FIFO queue, the scheduler polls:
///   - CPU load (sysinfo)
///   - Battery status + charge level
///   - External drive connectivity
///   - GPU load (nvidia-smi, best-effort)
///   - User activity (recent file edits in uploads/)
///
/// Each analyzer has a cost profile. The scheduler picks the highest-priority
/// analyzer that the current system can handle, then runs it.
use async_trait::async_trait;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Notify;
use tokio::time::sleep;
use tracing::info;
use sqlx::Row;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::db::DbPool;
use crate::services::ml_client::MlClient;

// ─── Config ────────────────────────────────────────────────────────────────

const MAX_RETRIES: u32 = 5;
const BASE_RETRY_DELAY_SECS: u64 = 30;
const MAX_RETRY_DELAY_SECS: u64 = 600;

const CPU_THRESHOLD_HIGH: f32 = 85.0;
const CPU_THRESHOLD_MED: f32 = 65.0;
const BATTERY_LOW: u32 = 20;
const BATTERY_MEDIUM: u32 = 50;
const MONITOR_INTERVAL_SECS: u64 = 10;
const JOB_POLL_INTERVAL_SECS: u64 = 2;

// ─── Analyzer Trait ───────────────────────────────────────────────────────

/// Minimal photo data needed by analyzers for pre-flight checks.
pub struct PhotoRecord {
        pub id: i64,
        pub path: String,
        pub has_embedding: bool,
        pub has_faces: bool,
        pub has_summary: bool,
        pub has_ocr: bool,
        pub ocr_attempted: bool,
    }

/// Plugin trait for AI analysis stages.
#[async_trait]
pub trait Analyzer: Send + Sync {
    /// name - Performs name.
    fn name(&self) -> &'static str;
    /// resource_need - Performs resource need.
    fn resource_need(&self) -> ResourceNeed;
    /// priority - Performs priority.
    fn priority(&self) -> u32;
    /// should_run - Performs should run.
    fn should_run(&self, photo: &PhotoRecord) -> bool;
    /// execute - Performs execute.
    async fn execute(
        &self,
        ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool;
}

// ─── System Monitor ────────────────────────────────────────────────────────

/// Point-in-time snapshot of what the machine is doing.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SystemState {
    pub cpu_usage: f32,
    pub on_battery: bool,
    pub battery_percent: u32,
    pub external_disconnected: bool,
    pub gpu_busy: bool,
    pub user_active: bool,
    pub cpu_temp_c: f32,
    pub disk_free_bytes: u64,
    pub disk_free_gb: f32,
    pub disk_total_bytes: u64,
    pub disk_total_gb: f32,
}

/// Polls the OS for resource usage. Cheap — spawns no threads, just reads sysinfo on demand.
pub struct SystemMonitor {
    last_check: std::sync::atomic::AtomicU64,
    uploads_dir: std::path::PathBuf,
    sys: parking_lot::Mutex<sysinfo::System>,
    last_cpu_refresh: parking_lot::Mutex<std::time::Instant>,
    last_cpu_usage: parking_lot::Mutex<f32>,
}

impl SystemMonitor {
    /// new - Performs new.
    pub fn new(uploads_dir: std::path::PathBuf) -> Self {
        use sysinfo::{CpuRefreshKind, RefreshKind, System};
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
        );
        sys.refresh_cpu_usage();
        Self {
            last_check: std::sync::atomic::AtomicU64::new(0),
            uploads_dir,
            sys: parking_lot::Mutex::new(sys),
            last_cpu_refresh: parking_lot::Mutex::new(std::time::Instant::now()),
            last_cpu_usage: parking_lot::Mutex::new(0.0),
        }
    }

    /// Returns cached state if checked recently, otherwise re-polls the OS.
    pub fn snapshot(&self, cached: &SystemState) -> SystemState {
        let now = epoch_secs();
        let last = self.last_check.load(Ordering::Relaxed);
        if now.saturating_sub(last) < MONITOR_INTERVAL_SECS {
            return cached.clone();
        }
        self.last_check.store(now, Ordering::Relaxed);
        self.poll()
    }

    /// Always re-polls the OS.
    pub fn poll(&self) -> SystemState {
        let mut state = SystemState::default();

        // ── CPU ──
        {
            let mut sys = self.sys.lock();
            let mut last_refresh = self.last_cpu_refresh.lock();
            let mut last_usage = self.last_cpu_usage.lock();
            let now = std::time::Instant::now();
            if now.duration_since(*last_refresh) >= sysinfo::MINIMUM_CPU_UPDATE_INTERVAL {
                sys.refresh_cpu_usage();
                *last_usage = sys.global_cpu_usage();
                *last_refresh = now;
            }
            state.cpu_usage = *last_usage;
        }

        // ── CPU Temperature ──
        let mut max_temp = 0.0f32;
        if let Ok(entries) = std::fs::read_dir("/sys/class/thermal") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().starts_with("thermal_zone") {
                    if let Ok(temp_str) = std::fs::read_to_string(entry.path().join("temp")) {
                        if let Ok(temp_milli) = temp_str.trim().parse::<f32>() {
                            let deg = temp_milli / 1000.0;
                            if deg > max_temp {
                                max_temp = deg;
                            }
                        }
                    }
                }
            }
        }
        if max_temp == 0.0 {
            if let Ok(hwmons) = std::fs::read_dir("/sys/class/hwmon") {
                for hwmon in hwmons.flatten() {
                    if let Ok(files) = std::fs::read_dir(hwmon.path()) {
                        for f in files.flatten() {
                            let fname = f.file_name();
                            let fname_str = fname.to_string_lossy();
                            if fname_str.starts_with("temp") && fname_str.ends_with("_input") {
                                if let Ok(content) = std::fs::read_to_string(f.path()) {
                                    if let Ok(milli) = content.trim().parse::<f32>() {
                                        let deg = milli / 1000.0;
                                        if deg > max_temp {
                                            max_temp = deg;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        state.cpu_temp_c = max_temp;

        // ── Available Disk Space ──
        {
            use sysinfo::Disks;
            let disks = Disks::new_with_refreshed_list();
            let mut free_bytes = 0u64;
            let mut total_bytes = 0u64;
            for disk in disks.list() {
                let mnt = disk.mount_point();
                if self.uploads_dir.starts_with(mnt) || free_bytes == 0 {
                    free_bytes = disk.available_space();
                    total_bytes = disk.total_space();
                }
            }
            state.disk_free_bytes = free_bytes;
            state.disk_free_gb = free_bytes as f32 / (1024.0 * 1024.0 * 1024.0);
            state.disk_total_bytes = total_bytes;
            state.disk_total_gb = total_bytes as f32 / (1024.0 * 1024.0 * 1024.0);
        }

        // ── Battery ──
        if let Ok(path) = std::fs::read_dir("/sys/class/power_supply") {
            for entry in path.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("BAT") || name_str.starts_with("battery") {
                    let base = entry.path();
                    let status = std::fs::read_to_string(base.join("status"))
                        .unwrap_or_default()
                        .trim()
                        .to_string();
                    let capacity = std::fs::read_to_string(base.join("capacity"))
                        .ok()
                        .and_then(|s| s.trim().parse::<u32>().ok())
                        .unwrap_or(100);
                    state.on_battery = status == "Discharging";
                    state.battery_percent = capacity;
                    break;
                }
            }
        }

        // ── External drives: check if /media, /mnt, /run/media have mounted volumes ──
        // ponytail: O(1) check — just see if mount points exist, don't enumerate
        'mount_scan: for mount_base in &["/media", "/mnt", "/run/media"] {
            if let Ok(entries) = std::fs::read_dir(mount_base) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        // Check if it's a real mount (has files)
                        if let Ok(mut files) = std::fs::read_dir(entry.path()) {
                            if files.next().is_some() {
                                state.external_disconnected = false;
                                break 'mount_scan; // found a mounted drive; continue to GPU & activity checks
                            }
                        }
                    }
                }
            }
        }

        // ── GPU load (nvidia-smi, best-effort) ──
        if let Ok((stdout, _)) = run_cmd("nvidia-smi", &["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"]) {
            if let Some(first_line) = stdout.lines().next() {
                if let Ok(gpu_pct) = first_line.trim().parse::<f32>() {
                    state.gpu_busy = gpu_pct > 70.0;
                }
            }
        }

        // ── User activity: check if any file in uploads/ was modified in last 60s ──
        if let Ok(meta) = std::fs::metadata(&self.uploads_dir) {
            if meta.is_dir() {
                let cutoff = SystemTime::now()
                    .checked_sub(Duration::from_secs(60))
                    .unwrap_or(UNIX_EPOCH);
                if let Ok(entries) = std::fs::read_dir(&self.uploads_dir) {
                    for entry in entries.flatten() {
                        if let Ok(m) = entry.metadata() {
                            if let Ok(modified) = m.modified() {
                                if modified > cutoff {
                                    state.user_active = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        state
    }
}

/// run_cmd - Executes run cmd.
fn run_cmd(cmd: &str, args: &[&str]) -> Result<(String, String), std::io::Error> {
    let output = std::process::Command::new(cmd).args(args).output()?;
    Ok((
        String::from_utf8_lossy(&output.stdout).to_string(),
        String::from_utf8_lossy(&output.stderr).to_string(),
    ))
}

/// epoch_secs - Performs epoch secs.
fn epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ─── Analyzer Cost Model ──────────────────────────────────────────────────

/// Each analyzer declares what resources it needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceNeed {
    Gpu,
    CpuHeavy,
    CpuLight,
}

// ─── Analyzer Registry ────────────────────────────────────────────────────

/// Holds all registered analyzers and plans which to run.
pub struct AnalyzerRegistry {
    analyzers: Vec<Box<dyn Analyzer>>,
}

impl AnalyzerRegistry {
    /// Create registry with all built-in analyzers.
    pub fn new() -> Self {
        use crate::services::analyzers::{FaceAnalyzer, Florence2Analyzer, OcrBboxAnalyzer, SiglipAnalyzer, VisionAnalyzer};

        let mut analyzers: Vec<Box<dyn Analyzer>> = vec![
            Box::new(SiglipAnalyzer),
            Box::new(FaceAnalyzer),
            Box::new(VisionAnalyzer),
            Box::new(Florence2Analyzer),
            Box::new(OcrBboxAnalyzer),
        ];
        // Higher priority first — determines execution order
        analyzers.sort_by(|a, b| b.priority().cmp(&a.priority()));
        Self { analyzers }
    }

    /// Names of all registered analyzers, in priority order.
    pub fn names(&self) -> Vec<&'static str> {
        self.analyzers.iter().map(|a| a.name()).collect()
    }

    /// Plan which analyzers should run on this photo given current system state.
    /// Filters by each analyzer's `should_run(photo)` + `can_run()` resource check.
    pub fn plan<'a>(&'a self, photo: &PhotoRecord, state: &SystemState) -> Vec<&'a dyn Analyzer> {
        self.analyzers
            .iter()
            .filter(|a| a.should_run(photo))
            .filter(|a| can_run(a.resource_need(), state))
            .map(|a| a.as_ref())
            .collect()
    }
}

// ─── Scheduler ─────────────────────────────────────────────────────────────

/// The scheduler's verdict on what to do next.
#[derive(Debug, Clone)]
pub enum ScheduleDecision {
    /// Run these specific analyzers on the given photo.
    RunAnalyzers { photo_id: i64, analyzers: Vec<&'static str> },
    /// Throttle — system under pressure, sleep and retry later.
    Throttle { reason: &'static str, sleep_secs: u64 },
}

pub struct JobScheduler {
    monitor: SystemMonitor,
}

impl JobScheduler {
    /// new - Performs new.
    pub fn new(uploads_dir: std::path::PathBuf) -> Arc<Self> {
        Arc::new(Self {
            monitor: SystemMonitor::new(uploads_dir),
        })
    }

    /// Check system-level constraints (sync, cheap). Returns throttle reason or None.
    pub fn check_system(&self, state: &mut SystemState) -> Option<(&'static str, u64)> {
        *state = self.monitor.snapshot(state);

        if state.cpu_usage > CPU_THRESHOLD_HIGH {
            return Some(("cpu_overloaded", 10));
        }
        if state.on_battery && state.battery_percent < BATTERY_LOW {
            return Some(("battery_critical", 30));
        }
        if state.disk_free_bytes > 0 && state.disk_free_bytes < 2 * 1024 * 1024 * 1024 {
            return Some(("low_disk_space", 30));
        }
        None
    }

    /// Evaluates system metrics and returns a plain-language pause reason if throttled/paused.
    pub fn get_pause_reason(&self, worker_paused: bool, state: &SystemState) -> Option<String> {
        if worker_paused {
            return Some("Paused by user".to_string());
        }
        if state.on_battery && state.battery_percent < BATTERY_LOW {
            return Some(format!("Paused: Battery below {}% ({}%)", BATTERY_LOW, state.battery_percent));
        }
        if state.disk_free_bytes > 0 && state.disk_free_bytes < 2 * 1024 * 1024 * 1024 {
            return Some(format!("Paused: Low disk space (< 2 GB, {:.1} GB free)", state.disk_free_gb));
        }
        if state.cpu_usage > CPU_THRESHOLD_HIGH {
            return Some(format!("Paused: CPU overloaded ({:.0}%)", state.cpu_usage));
        }
        None
    }

    /// Given a pending job and current system state, decide which analyzers to run.
    pub(crate) fn plan_analyzers(
        job: &PendingJob,
        state: &SystemState,
        registry: &AnalyzerRegistry,
    ) -> ScheduleDecision {
        let photo = PhotoRecord {
            id: job.photo_id,
            path: job.photo_path.clone(),
            has_embedding: job.has_embedding,
            has_faces: job.has_faces,
            has_summary: job.has_summary,
            has_ocr: job.has_ocr,
            ocr_attempted: job.ocr_attempted,
        };

        let any_needed = registry.analyzers.iter().any(|a| a.should_run(&photo));
        if !any_needed {
            return ScheduleDecision::RunAnalyzers {
                photo_id: job.photo_id,
                analyzers: Vec::new(),
            };
        }

        let allowed: Vec<&str> = registry
            .plan(&photo, state)
            .iter()
            .map(|a| a.name())
            .collect();

        if allowed.is_empty() {
            return ScheduleDecision::Throttle { reason: "resources_unavailable", sleep_secs: 15 };
        }

        ScheduleDecision::RunAnalyzers {
            photo_id: job.photo_id,
            analyzers: allowed,
        }
    }

    /// get_system_state - Retrieves system state.
    pub fn get_system_state(&self) -> SystemState {
        self.monitor.poll()
    }
}

/// Checks if an analyzer can run given the current system state.
fn can_run(resource: ResourceNeed, state: &SystemState) -> bool {
    match resource {
        ResourceNeed::Gpu => !state.gpu_busy && state.cpu_usage < CPU_THRESHOLD_MED,
        ResourceNeed::CpuHeavy => state.cpu_usage < CPU_THRESHOLD_MED
            && !(state.on_battery && state.battery_percent < BATTERY_MEDIUM),
        ResourceNeed::CpuLight => state.cpu_usage < CPU_THRESHOLD_HIGH
            && !(state.on_battery && state.battery_percent < BATTERY_LOW),
    }
}

// ─── Shared Worker State (backward-compatible) ────────────────────────────

pub struct WorkerState {
    pub paused: AtomicBool,
    pub notify: Notify,
    pub total_enqueued: AtomicU64,
    pub completed: AtomicU64,
    pub failed: AtomicU64,
    pub currently_processing: AtomicBool,
    pub paused_stages: RwLock<HashSet<String>>,
    /// Per-analyzer completion counters, keyed by analyzer name.
    analyzer_counters: HashMap<String, Arc<AtomicU64>>,
}

impl WorkerState {
    /// new - Performs new.
    pub fn new(analyzer_names: &[&str]) -> Arc<Self> {
        let analyzer_counters = analyzer_names
            .iter()
            .map(|name| (name.to_string(), Arc::new(AtomicU64::new(0))))
            .collect();

        Arc::new(Self {
            paused: AtomicBool::new(false),
            notify: Notify::new(),
            total_enqueued: AtomicU64::new(0),
            completed: AtomicU64::new(0),
            failed: AtomicU64::new(0),
            currently_processing: AtomicBool::new(false),
            paused_stages: RwLock::new(HashSet::new()),
            analyzer_counters,
        })
    }

    /// pause_stage - Pause an individual analysis stage.
    pub fn pause_stage(&self, stage: &str) {
        self.paused_stages.write().insert(stage.trim().to_lowercase());
    }

    /// resume_stage - Resume an individual analysis stage.
    pub fn resume_stage(&self, stage: &str) {
        self.paused_stages.write().remove(&stage.trim().to_lowercase());
    }

    /// is_stage_paused - Checks if an analysis stage is paused.
    pub fn is_stage_paused(&self, stage: &str) -> bool {
        let paused = self.paused_stages.read();
        let s = stage.trim().to_lowercase();
        if paused.contains(&s) {
            return true;
        }
        match s.as_str() {
            "siglip" | "embedding" | "embeddings" => {
                paused.contains("siglip") || paused.contains("embedding") || paused.contains("embeddings")
            }
            "face" | "faces" | "face_detection" | "face_id" => {
                paused.contains("face") || paused.contains("faces") || paused.contains("face_detection") || paused.contains("face_id")
            }
            "vision" | "gemma" | "summary" => {
                paused.contains("vision") || paused.contains("gemma") || paused.contains("summary")
            }
            "ocr" | "rapid_ocr" | "ocr_bbox" => {
                paused.contains("ocr") || paused.contains("rapid_ocr") || paused.contains("ocr_bbox")
            }
            "thumbnail" | "thumbnails" => {
                paused.contains("thumbnail") || paused.contains("thumbnails")
            }
            _ => false,
        }
    }

    /// get_paused_stages - Returns active list of paused stages.
    pub fn get_paused_stages(&self) -> Vec<String> {
        self.paused_stages.read().iter().cloned().collect()
    }

    /// increment_counter - Performs increment counter.
    pub fn increment_counter(&self, name: &str) {
        if let Some(counter) = self.analyzer_counters.get(name) {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// get_counter - Retrieves counter.
    pub fn get_counter(&self, name: &str) -> u64 {
        self.analyzer_counters
            .get(name)
            .map(|c| c.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    /// reset - Performs reset.
    pub fn reset(&self) {
        self.total_enqueued.store(0, Ordering::Relaxed);
        self.completed.store(0, Ordering::Relaxed);
        self.failed.store(0, Ordering::Relaxed);
        self.currently_processing.store(false, Ordering::Relaxed);
        for counter in self.analyzer_counters.values() {
            counter.store(0, Ordering::Relaxed);
        }
    }

    /// status_snapshot_with_scheduler - Snapshot with live hardware telemetry.
    pub fn status_snapshot_with_scheduler(&self, scheduler: &JobScheduler) -> WorkerStatusSnapshot {
        let sys = scheduler.get_system_state();
        let is_paused = self.paused.load(Ordering::Relaxed);
        let pause_reason = scheduler.get_pause_reason(is_paused, &sys);
        let paused_stages = self.get_paused_stages();

        let analyzer_counts: HashMap<String, u64> = self
            .analyzer_counters
            .iter()
            .map(|(name, counter)| (name.clone(), counter.load(Ordering::Relaxed)))
            .collect();

        let is_throttled = pause_reason.is_some() && !is_paused;

        let hardware = HardwareMetricsSnapshot {
            cpu_usage: sys.cpu_usage,
            on_battery: sys.on_battery,
            battery_percent: sys.battery_percent,
            cpu_temp_c: sys.cpu_temp_c,
            disk_free_bytes: sys.disk_free_bytes,
            disk_free_gb: sys.disk_free_gb,
            disk_total_bytes: sys.disk_total_bytes,
            disk_total_gb: sys.disk_total_gb,
            gpu_busy: sys.gpu_busy,
            external_disconnected: sys.external_disconnected,
            user_active: sys.user_active,
            is_throttled,
        };

        WorkerStatusSnapshot {
            total_photos: self.total_enqueued.load(Ordering::Relaxed),
            paused: is_paused,
            is_processing: self.currently_processing.load(Ordering::Relaxed),
            completed: self.completed.load(Ordering::Relaxed),
            failed: self.failed.load(Ordering::Relaxed),
            analyzer_counts,
            pause_reason,
            paused_stages,
            hardware,
        }
    }

    /// status_snapshot - Performs status snapshot.
    pub fn status_snapshot(&self) -> WorkerStatusSnapshot {
        let analyzer_counts: HashMap<String, u64> = self
            .analyzer_counters
            .iter()
            .map(|(name, counter)| (name.clone(), counter.load(Ordering::Relaxed)))
            .collect();

        let is_paused = self.paused.load(Ordering::Relaxed);
        let pause_reason = if is_paused { Some("Paused by user".to_string()) } else { None };

        WorkerStatusSnapshot {
            total_photos: self.total_enqueued.load(Ordering::Relaxed),
            paused: is_paused,
            is_processing: self.currently_processing.load(Ordering::Relaxed),
            completed: self.completed.load(Ordering::Relaxed),
            failed: self.failed.load(Ordering::Relaxed),
            analyzer_counts,
            pause_reason,
            paused_stages: self.get_paused_stages(),
            hardware: HardwareMetricsSnapshot {
                cpu_usage: 0.0,
                on_battery: false,
                battery_percent: 100,
                cpu_temp_c: 0.0,
                disk_free_bytes: 0,
                disk_free_gb: 0.0,
                disk_total_bytes: 0,
                disk_total_gb: 0.0,
                gpu_busy: false,
                external_disconnected: false,
                user_active: false,
                is_throttled: false,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareMetricsSnapshot {
    pub cpu_usage: f32,
    pub on_battery: bool,
    pub battery_percent: u32,
    pub cpu_temp_c: f32,
    pub disk_free_bytes: u64,
    pub disk_free_gb: f32,
    #[serde(default)]
    pub disk_total_bytes: u64,
    #[serde(default)]
    pub disk_total_gb: f32,
    pub gpu_busy: bool,
    pub external_disconnected: bool,
    pub user_active: bool,
    pub is_throttled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStatusSnapshot {
    pub total_photos: u64,
    pub paused: bool,
    pub is_processing: bool,
    pub completed: u64,
    pub failed: u64,
    pub analyzer_counts: HashMap<String, u64>,
    pub pause_reason: Option<String>,
    pub paused_stages: Vec<String>,
    pub hardware: HardwareMetricsSnapshot,
}

#[allow(dead_code)]
pub type WorkerStatus = WorkerStatusSnapshot;

// ─── Worker Loop (scheduler-driven) ───────────────────────────────────────

/// spawn_worker_loop - Spawns worker loop worker/task.
pub fn spawn_worker_loop(
    worker: Arc<WorkerState>,
    ml_client: MlClient,
    db: DbPool,
    scheduler: Arc<JobScheduler>,
    registry: Arc<AnalyzerRegistry>,
) {
    tokio::spawn(async move {
        info!("[Scheduler] AI Job Scheduler started");

        reset_interrupted_jobs(&db).await;

        let mut system_state = SystemState::default();
        let mut poll_deadline = tokio::time::Instant::now();

        loop {
            // Sleep until next poll or until woken by enqueue
            let _ = tokio::time::timeout_at(poll_deadline, worker.notify.notified()).await;
            poll_deadline = tokio::time::Instant::now() + Duration::from_secs(JOB_POLL_INTERVAL_SECS);

            // Respect manual pause
            while worker.paused.load(Ordering::Relaxed) {
                sleep(Duration::from_millis(500)).await;
            }

            // Check system-level constraints (sync, cheap)
            if let Some((reason, secs)) = scheduler.check_system(&mut system_state) {
                info!("[Scheduler] Throttling ({}), sleeping {}s", reason, secs);
                sleep(Duration::from_secs(secs)).await;
                continue;
            }

            // Fetch next pending job from DB (without mutating status until scheduled)
            let job = match fetch_pending_job(&db).await {
                Some(j) => j,
                None => {
                    poll_deadline = tokio::time::Instant::now() + Duration::from_secs(5);
                    continue;
                }
            };

            // Decide which analyzers to run for this job
            let decision = JobScheduler::plan_analyzers(&job, &system_state, &registry);

            match decision {
                ScheduleDecision::RunAnalyzers { photo_id, analyzers } => {
                    let _ = sqlx::query(
                        "UPDATE background_jobs SET status = 'processing', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                    )
                    .bind(job.job_id)
                    .execute(&db)
                    .await;

                    worker.currently_processing.store(true, Ordering::Relaxed);
                    info!(
                        "[Scheduler] Running [{}] on photo_id={}",
                        analyzers.join(", "), photo_id
                    );

                    let (stage_names, results) = run_analyzers(
                        &ml_client, &db, &worker, &registry,
                        &job, &analyzers,
                    ).await;

                    update_job_status(&db, job.job_id, &stage_names, &results).await;

                    if results.iter().all(|s| *s) {
                        worker.completed.fetch_add(1, Ordering::Relaxed);
                    } else {
                        worker.failed.fetch_add(1, Ordering::Relaxed);
                    }
                    worker.currently_processing.store(false, Ordering::Relaxed);
                }
                ScheduleDecision::Throttle { reason, sleep_secs } => {
                    info!("[Scheduler] Throttling ({}), sleeping {}s", reason, sleep_secs);
                    sleep(Duration::from_secs(sleep_secs)).await;
                }
            }
        }
    });
}

// ─── Analyzer Execution ───────────────────────────────────────────────────

pub(crate) struct PendingJob {
    job_id: i64,
    photo_id: i64,
    photo_path: String,
    has_embedding: bool,
    has_faces: bool,
    has_summary: bool,
    has_ocr: bool,
    ocr_attempted: bool,
}

/// reset_interrupted_jobs - Updates reset interrupted jobs.
async fn reset_interrupted_jobs(db: &DbPool) {
    let _ = sqlx::query(
        "UPDATE background_jobs SET status = 'pending', current_stage = NULL, stage_progress = NULL, last_error = 'Interrupted by restart' WHERE status = 'processing'"
    )
    .execute(db)
    .await;
    info!("[Scheduler] Reset interrupted jobs to pending.");
}

/// fetch_pending_job - Retrieves pending job.
async fn fetch_pending_job(db: &DbPool) -> Option<PendingJob> {
    let row = sqlx::query(
        r#"
        SELECT
            j.id AS job_id,
            j.photo_id,
            j.attempt_count,
            p.path AS photo_path,
            CASE WHEN p.embedding IS NOT NULL AND p.embedding != '' THEN 1 ELSE 0 END AS has_embedding,
            CASE WHEN EXISTS (SELECT 1 FROM faces WHERE photo_id = p.id) THEN 1 ELSE 0 END AS has_faces,
            CASE WHEN p.ai_summary IS NOT NULL AND p.ai_summary != '' THEN 1 ELSE 0 END AS has_summary,
            CASE WHEN p.ocr_text IS NOT NULL AND p.ocr_text != '' THEN 1 ELSE 0 END AS has_ocr,
            CASE WHEN p.ocr_attempted_at IS NOT NULL THEN 1 ELSE 0 END AS ocr_attempted
        FROM background_jobs j
        JOIN photos p ON p.id = j.photo_id
        WHERE j.status = 'pending'
          AND j.job_type = 'sequential_analysis'
        ORDER BY COALESCE(j.priority, 0) DESC, j.created_at ASC
        LIMIT 1
        "#
    )
    .fetch_optional(db)
    .await
    .ok()??;

    Some(PendingJob {
        job_id: row.get("job_id"),
        photo_id: row.get("photo_id"),
        photo_path: row.get("photo_path"),
        has_embedding: row.get::<i64, _>("has_embedding") == 1,
        has_faces: row.get::<i64, _>("has_faces") == 1,
        has_summary: row.get::<i64, _>("has_summary") == 1,
        has_ocr: row.get::<i64, _>("has_ocr") == 1,
        ocr_attempted: row.get::<i64, _>("ocr_attempted") == 1,
    })
}

/// Run only the allowed analyzers. Each runs independently via the trait.
async fn run_analyzers(
    ml_client: &MlClient,
    db: &DbPool,
    worker: &Arc<WorkerState>,
    registry: &AnalyzerRegistry,
    job: &PendingJob,
    allowed: &[&str],
) -> (Vec<String>, Vec<bool>) {
    let photo = PhotoRecord {
        id: job.photo_id,
        path: job.photo_path.clone(),
        has_embedding: job.has_embedding,
        has_faces: job.has_faces,
        has_summary: job.has_summary,
        has_ocr: job.has_ocr,
        ocr_attempted: job.ocr_attempted,
    };

    let mut stage_names = Vec::with_capacity(allowed.len());
    let mut results = Vec::with_capacity(allowed.len());

    for &stage_name in allowed {
        if worker.is_stage_paused(stage_name) {
            info!("[Scheduler] Skipping stage '{}' on photo {} (stage paused)", stage_name, job.photo_id);
            continue;
        }

        update_stage(db, job.photo_id, stage_name).await;

        // Find the analyzer by name in the registry
        let analyzer = registry.analyzers.iter().find(|a| a.name() == stage_name);

        let ok = match analyzer {
            Some(a) if a.should_run(&photo) => {
                a.execute(ml_client, db, worker, job.photo_id, &job.photo_path).await
            }
            Some(_) => true, // should_run returned false, skip (success)
            None => true,    // unknown analyzer, skip
        };

        stage_names.push(stage_name.to_string());
        results.push(ok);
    }

    (stage_names, results)
}

/// update_stage - Updates update stage.
async fn update_stage(db: &DbPool, photo_id: i64, stage: &str) {
    let _ = sqlx::query(
        "UPDATE background_jobs SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE photo_id = ? AND status = 'processing'"
    )
    .bind(stage)
    .bind(photo_id)
    .execute(db)
    .await;
}

/// update_job_status - Updates update job status.
async fn update_job_status(
    db: &DbPool,
    job_id: i64,
    stage_names: &[String],
    stage_results: &[bool],
) {
    let all_ok = stage_results.iter().all(|s| *s);

    if all_ok {
        let _ = sqlx::query(
            "UPDATE background_jobs SET status = 'completed', current_stage = NULL, stage_progress = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(job_id)
        .execute(db)
        .await;
    } else {
        // Check attempt count for retry logic
        let attempt: i64 = sqlx::query_scalar("SELECT attempt_count FROM background_jobs WHERE id = ?")
            .bind(job_id)
            .fetch_one(db)
            .await
            .unwrap_or(0);

        if attempt >= MAX_RETRIES as i64 {
            let failed_stages: Vec<&str> = stage_results
                .iter()
                .zip(stage_names.iter())
                .filter(|(ok, _)| !**ok)
                .map(|(_, name)| name.as_str())
                .collect();
            let err_msg = format!("Failed: {}", failed_stages.join(", "));
            let _ = sqlx::query(
                "UPDATE background_jobs SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(&err_msg)
            .bind(job_id)
            .execute(db)
            .await;
        } else {
            let delay = std::cmp::min(
                BASE_RETRY_DELAY_SECS * 2u64.pow(attempt as u32),
                MAX_RETRY_DELAY_SECS,
            );
            let _ = sqlx::query(
                "UPDATE background_jobs SET status = 'pending', last_error = 'Partial failure', current_stage = NULL, stage_progress = NULL, created_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(format!("+{} seconds", delay))
            .bind(job_id)
            .execute(db)
            .await;
            info!(
                "[Scheduler] Job {} retry in {}s (attempt {}/{})",
                job_id, delay, attempt, MAX_RETRIES
            );
        }
    }
}

// ─── Public API ───────────────────────────────────────────────────────────

/// Enqueue a photo for background processing. Called from upload/import routes.
pub async fn enqueue_photo(db: &DbPool, photo_id: i64) {
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM background_jobs WHERE photo_id = ? AND job_type = 'sequential_analysis' AND status IN ('pending', 'processing')"
    )
    .bind(photo_id)
    .fetch_one(db)
    .await
    .unwrap_or(false);

    if exists {
        return;
    }

    let _ = sqlx::query(
        "INSERT INTO background_jobs (photo_id, job_type, status) VALUES (?, 'sequential_analysis', 'pending')"
    )
    .bind(photo_id)
    .execute(db)
    .await;
}

/// Enqueue a sequential_analysis job for every photo that has n't had OCR attempted yet.
/// Safe to call even before the OCR models are downloaded.
pub async fn enqueue_missing_ocr_jobs(db: &DbPool) {
    let missing: Vec<i64> = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT p.id
        FROM photos p
        LEFT JOIN background_jobs j
            ON j.photo_id = p.id
            AND j.job_type = 'sequential_analysis'
            AND j.status IN ('pending', 'processing')
        WHERE p.is_trash = 0
          AND p.is_locked = 0
          AND p.ocr_attempted_at IS NULL
          AND p.ocr_text IS NULL
          AND j.id IS NULL
        ORDER BY p.date_taken ASC
        LIMIT 500
        "#
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let count = missing.len();
    for id in missing {
        let _ = sqlx::query(
            "INSERT INTO background_jobs (photo_id, job_type, status) VALUES (?, 'sequential_analysis', 'pending')"
        )
        .bind(id)
        .execute(db)
        .await;
    }

    if count > 0 {
        info!("[Scheduler] Enqueued {} photos for OCR after rapid_ocr download", count);
    }
}

/// Boost background job priority for all photos in an album.
pub async fn prioritize_album(db: &DbPool, album_id: i64) -> Result<u64, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        UPDATE background_jobs
        SET priority = COALESCE(priority, 0) + 100, updated_at = CURRENT_TIMESTAMP
        WHERE photo_id IN (
            SELECT photo_id FROM photo_albums WHERE album_id = ?
        ) AND status IN ('pending', 'processing')
        "#
    )
    .bind(album_id)
    .execute(db)
    .await?
    .rows_affected();

    info!("[Scheduler] Boosted priority (+100) for {} jobs in album {}", rows, album_id);
    Ok(rows)
}

/// Automatically generates / enqueues a proxy video if video height > 1080 or fps > 30.
#[allow(dead_code)]
pub async fn enqueue_video_proxy_if_needed(db: &DbPool, photo_id: i64, height: Option<i64>, fps: Option<f64>) {
    let is_large = height.map(|h| h > 1080).unwrap_or(false) || fps.map(|f| f > 30.0).unwrap_or(false);
    if !is_large {
        return;
    }
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM background_jobs WHERE photo_id = ? AND job_type = 'video_proxy' AND status IN ('pending', 'processing', 'completed')"
    )
    .bind(photo_id)
    .fetch_one(db)
    .await
    .unwrap_or(false);

    if !exists {
        let _ = sqlx::query(
            "INSERT INTO background_jobs (photo_id, job_type, title, status, priority) VALUES (?, 'video_proxy', 'Generate Fast Editing Proxy', 'pending', 50)"
        )
        .bind(photo_id)
        .execute(db)
        .await;
        info!("[Scheduler] Enqueued proxy generation for photo_id={}", photo_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_cpu_and_metrics() {
        let monitor = SystemMonitor::new(std::path::PathBuf::from("/tmp"));
        std::thread::sleep(std::time::Duration::from_millis(300));
        let state = monitor.poll();
        println!("[test] Detected CPU usage: {:.2}%", state.cpu_usage);
        println!("[test] Detected CPU temp: {:.1}°C", state.cpu_temp_c);
        println!("[test] Detected Disk free: {:.1} GB", state.disk_free_gb);
        println!("[test] Detected Disk total: {:.1} GB", state.disk_total_gb);
        // CPU usage should be a realistic percentage [0.0, 100.0]
        assert!(state.cpu_usage >= 0.0 && state.cpu_usage <= 100.0);
        assert!(state.disk_total_gb >= 0.0);
    }
}
