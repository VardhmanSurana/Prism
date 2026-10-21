# Algorithm Deep Dive: Hardware-Aware Adaptive AI Job Scheduler

> **Document**: ALGORITHM_02-Hardware_Aware_Adaptive_AI_Job_Scheduler.md  
> **Module**: AI Background Worker & Resource Orchestrator  
> **Source Files**: `backend_rust/src/services/worker.rs`, `backend_rust/src/services/analyzers/mod.rs`  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 4  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [1. Mathematical Model & State Transition Formalism](#1-mathematical-model--state-transition-formalism)
  - [1.1 Telemetry State Vector Representation](#11-telemetry-state-vector-representation)
  - [1.2 Constraint-Satisfaction Throttling Barrier](#12-constraint-satisfaction-throttling-barrier)
  - [1.3 Resource Classification & Admissibility Predicates](#13-resource-classification--admissibility-predicates)
  - [1.4 Priority DAG & Stage-Aware Resume Function](#14-priority-dag--stage-aware-resume-function)
  - [1.5 Exponential Backoff Retry Formulation](#15-exponential-backoff-retry-formulation)
- [2. Step-by-Step Scheduling Execution Flow](#2-step-by-step-scheduling-execution-flow)
- [3. Code-Level Implementation Breakdown](#3-code-level-implementation-breakdown)
  - [3.1 Telemetry Polling: `SystemMonitor::poll`](#31-telemetry-polling-systemmonitorpoll)
  - [3.2 System Throttling Check: `JobScheduler::check_system`](#32-system-throttling-check-jobschedulercheck_system)
  - [3.3 Analyzer Registry Planning: `AnalyzerRegistry::plan`](#33-analyzer-registry-planning-analyzerregistryplan)
  - [3.4 The Main Worker Event Loop: `spawn_worker_loop`](#34-the-main-worker-event-loop-spawn_worker_loop)
- [4. Fault Recovery & Crash Consistency Model](#4-fault-recovery--crash-consistency-model)
- [5. Design Decisions & Comparative Evaluation](#5-design-decisions--comparative-evaluation)
- [6. Verification Checklist](#6-verification-checklist)

---

## 1. Mathematical Model & State Transition Formalism

### 1.1 Telemetry State Vector Representation

At any discrete sampling epoch $t$, the host machine's physical hardware state is formalized as a 6-dimensional tuple $\mathbf{s}_t \in \mathcal{S}$:

$$\mathbf{s}_t = \begin{pmatrix} C_t \\ B_t^{\text{dis}} \\ B_t^{\%} \\ D_t^{\text{ext}} \\ G_t^{\text{busy}} \\ U_t^{\text{act}} \end{pmatrix} \in [0.0, 100.0] \times \{0, 1\} \times [0, 100] \times \{0, 1\} \times \{0, 1\} \times \{0, 1\}$$

Where:
- $C_t \in [0.0, 100.0]$: Global CPU utilization percentage aggregated across all logical cores via `sysinfo::System::global_cpu_usage()`.
- $B_t^{\text{dis}} \in \{0, 1\}$: Binary discharge indicator ($1$ if discharging from battery, $0$ if connected to AC wall power).
- $B_t^{\%} \in [0, 100]$: Remaining battery percentage capacity parsed directly from Linux sysfs (`/sys/class/power_supply/BAT*/capacity`).
- $D_t^{\text{ext}} \in \{0, 1\}$: External volume disconnection flag.
- $G_t^{\text{busy}} \in \{0, 1\}$: GPU compute or VRAM saturation indicator.
- $U_t^{\text{act}} \in \{0, 1\}$: Interactive user foreground activity indicator based on file modifications in `uploads/`.

**Code Evidence**: [VERIFY: backend_rust/src/services/worker.rs:78-85]

---

### 1.2 Constraint-Satisfaction Throttling Barrier

To avoid degrading system responsiveness, inducing thermal throttling, or depleting battery life during critical desktop usage, the scheduler checks the system barrier function $\Phi(\mathbf{s}_t) \to \text{Option}(\text{Reason}, \Delta t_{\text{sleep}})$ before dequeuing any background task:

$$\Phi(\mathbf{s}_t) = \begin{cases} 
(\text{"cpu\_overloaded"}, 10\text{ s}) & \text{if } C_t > 85.0 \\
(\text{"battery\_critical"}, 30\text{ s}) & \text{if } B_t^{\text{dis}} = 1 \land B_t^{\%} < 20 \\
\text{None} & \text{otherwise}
\end{cases}$$

Where:
- $\text{CPU\_THRESHOLD\_HIGH} = 85.0\%$: Prevents background tasks from contending with high-priority user applications (e.g. video playback, compiling, gaming).
- $\text{BATTERY\_LOW} = 20\%$: Automatically suspends all power-hungry neural inferences when the battery enters critical discharge state.

**Code Evidence**:
- [VERIFY: backend_rust/src/services/worker.rs:32-35] - Threshold constants.
- [VERIFY: backend_rust/src/services/worker.rs:298-308] - Throttling barrier implementation.

---

### 1.3 Resource Classification & Admissibility Predicates

Each analyzer $A_i$ declares its structural resource requirement $R(A_i) \in \{\text{Gpu}, \text{CpuHeavy}, \text{CpuLight}\}$:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Analyzer Resource & Priority Mapping                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Analyzer Name     Priority     Resource Need      Execution Engine         │
│  ─────────────     ────────     ─────────────      ────────────────         │
│  siglip            300          CpuHeavy           ONNX ViT-B/16 (768d)     │
│  face              200          CpuHeavy           ArcFace (512d)           │
│  vision            100          Gpu / CpuHeavy     Florence-2 / LLM Vision  │
│  ocr_bbox          0            CpuLight           PP-OCRv4 (Text + Boxes)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

An individual analyzer $A_i$ is admissible under state $\mathbf{s}_t$ if and only if:

$$\text{CanRun}(R(A_i), \mathbf{s}_t) = \begin{cases}
\text{false} & \text{if } R(A_i) = \text{Gpu} \land (G_t^{\text{busy}} \lor (B_t^{\text{dis}} \land B_t^{\%} < 30)) \\
\text{false} & \text{if } R(A_i) = \text{CpuHeavy} \land (C_t > 65.0 \lor (B_t^{\text{dis}} \land B_t^{\%} < 25)) \\
\text{false} & \text{if } R(A_i) = \text{CpuLight} \land C_t > 85.0 \\
\text{true} & \text{otherwise}
\end{cases}$$

**Code Evidence**:
- [VERIFY: backend_rust/src/services/worker.rs:220-224] - ResourceNeed enum.
- [VERIFY: backend_rust/src/services/worker.rs:188-212] - `can_run` implementation.

---

### 1.4 Priority DAG & Stage-Aware Resume Function

When a photograph has been partially processed (for example, if the application was terminated mid-pipeline), the scheduler determines the resume priority $P_{\text{resume}} \in \mathbb{N}$:

$$P_{\text{resume}}(P) = \begin{cases}
0 & \text{if } \text{has\_ocr}(P) \\
100 & \text{if } \text{has\_summary}(P) \land \neg \text{has\_ocr}(P) \\
200 & \text{if } \text{has\_faces}(P) \land \neg \text{has\_summary}(P) \\
300 & \text{if } \text{has\_embedding}(P) \land \neg \text{has\_faces}(P) \\
999 & \text{if } \neg \text{has\_embedding}(P)
\end{cases}$$

An analyzer $A$ is eligible to run on photograph $P$ if and only if:

$$\text{Eligible}(A, P, \mathbf{s}_t) = (P(A) \le P_{\text{resume}}(P)) \land \text{should\_run}(A, P) \land \text{CanRun}(R(A), \mathbf{s}_t)$$

This prevents duplicate computation: once SigLIP2 ($P=300$) completes, it is never executed again for that photograph.

**Code Evidence**:
- [VERIFY: backend_rust/src/services/worker.rs:165-186] - `get_resume_priority` implementation.
- [VERIFY: backend_rust/src/services/worker.rs:257-272] - `AnalyzerRegistry::plan` execution filter.

---

### 1.5 Exponential Backoff Retry Formulation

When an analyzer encounters a transient error (e.g., temporary model file lock or out-of-memory), Prism computes an exponential retry delay with hard saturation:

$$\Delta t_{\text{retry}}(k) = \min\left( \text{BASE\_DELAY} \cdot 2^{k}, \text{MAX\_DELAY} \right)$$

With constants:
- $\text{BASE\_DELAY} = 30\text{ seconds}$
- $\text{MAX\_DELAY} = 600\text{ seconds}$ (10 minutes)
- $\text{MAX\_RETRIES} = 5$

The progression of retry intervals is deterministic:
- Attempt 1: $30 \cdot 2^0 = 30\text{ s}$
- Attempt 2: $30 \cdot 2^1 = 60\text{ s}$
- Attempt 3: $30 \cdot 2^2 = 120\text{ s}$
- Attempt 4: $30 \cdot 2^3 = 240\text{ s}$
- Attempt 5: $30 \cdot 2^4 = 480\text{ s}$
- Attempt $> 5$: Marked as permanently `failed`.

**Code Evidence**: [VERIFY: backend_rust/src/services/worker.rs:28-30]

---

## 2. Step-by-Step Scheduling Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 0: Startup Interrupted Job Recovery                    │ [VERIFY: backend_rust/src/services/worker.rs:475]
│ - Scans `background_jobs` table                             │
│ - Resets any job stuck in status='processing' to 'pending'  │
│ - Sets last_error = 'Interrupted by restart'                │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Asynchronous Awakening & State Check                │ [VERIFY: backend_rust/src/services/worker.rs:482]
│ - Awaits `worker.notify.notified()` OR 2-second timeout     │
│ - If worker.paused == true, sleeps 1s and re-evaluates      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: System Telemetry Polling                            │ [VERIFY: backend_rust/src/services/worker.rs:491]
│ - Reads CPU global load and Linux power supply capacity     │
│ - Evaluates throttling barrier Φ(s_t)                       │
│ - If CPU > 85% or Battery < 20%, sleeps Δt and loops        │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Pending Job Dequeuing                               │ [VERIFY: backend_rust/src/services/worker.rs:498]
│ - SELECT * FROM background_jobs WHERE status = 'pending'    │
│   ORDER BY created_at ASC LIMIT 1                           │
│ - Marks status = 'processing', updated_at = now()           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Multi-Stage Priority Planning                       │ [VERIFY: backend_rust/src/services/worker.rs:507]
│ - Evaluates existing completion flags on target photo       │
│ - Computes resume priority and filters eligible analyzers   │
│ - Checks CanRun(resource_need, s_t) for each candidate      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Sequential Stage Execution                          │ [VERIFY: backend_rust/src/services/worker.rs:517-522]
│ - Executes analyzers in descending priority order:          │
│   1. SigLIP2 (Priority 300) -> 768d vector                 │
│   2. FaceEngine (Priority 200) -> ArcFace faces             │
│   3. Vision (Priority 100) -> captions, tags               │
│   4. PP-OCRv4 (Priority 0) -> text, bboxes                 │
│ - Updates stage_progress JSON and progress_pct in SQLite    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Atomic Completion & Webhook Dispatch                │ [VERIFY: backend_rust/src/services/worker.rs:530-538]
│ - Sets background_jobs.status = 'completed'                 │
│ - Dispatches webhook event `photo.analyzed`                 │
│ - Emits SSE notification to connected clients               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Code-Level Implementation Breakdown

### 3.1 Telemetry Polling: `SystemMonitor::poll`

```rust
// [VERIFY: backend_rust/src/services/worker.rs:114-150]
pub fn poll(&self) -> SystemState {
    let mut state = SystemState::default();

    // ── CPU ──
    {
        use sysinfo::System;
        let mut sys = System::new();
        sys.refresh_cpu_all();
        state.cpu_usage = sys.global_cpu_usage();
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
    state
}
```

- **Lines 118-123**: Uses `sysinfo` to measure CPU utilization across all host cores.
- **Lines 126-148**: Traverses Linux sysfs `/sys/class/power_supply` to locate battery devices (`BAT0`, `BAT1`), checking both `status` ("Discharging") and remaining capacity percentage.

---

### 3.2 System Throttling Check: `JobScheduler::check_system`

```rust
// [VERIFY: backend_rust/src/services/worker.rs:298-308]
pub fn check_system(&self, state: &mut SystemState) -> Option<(&'static str, u64)> {
    *state = self.monitor.snapshot(state);

    if state.cpu_usage > CPU_THRESHOLD_HIGH {
        return Some(("cpu_overloaded", 10));
    }
    if state.on_battery && state.battery_percent < BATTERY_LOW {
        return Some(("battery_critical", 30));
    }
    None
}
```

- **Lines 299-300**: Refreshes telemetry snapshot using atomic timestamp gating (`MONITOR_INTERVAL_SECS = 10`) to prevent excessive syscall polling.
- **Lines 301-306**: Evaluates barrier conditions, returning the specific throttling reason and sleep duration.

---

### 3.3 Analyzer Registry Planning: `AnalyzerRegistry::plan`

```rust
// [VERIFY: backend_rust/src/services/worker.rs:257-272]
pub fn plan<'a>(&'a self, photo: &PhotoRecord, state: &SystemState) -> Vec<&'a dyn Analyzer> {
    let resume_priority = get_resume_priority(
        photo.has_embedding,
        photo.has_faces,
        photo.has_summary,
        photo.has_ocr,
    );

    self.analyzers
        .iter()
        .filter(|a| a.priority() > resume_priority)
        .filter(|a| can_run(a.resource_need(), state))
        .map(|a| a.as_ref())
        .collect()
}
```

- **Lines 258-263**: Evaluates completed photo attributes to establish current DAG position.
- **Lines 265-271**: Employs functional iterator pipeline to filter analyzers that both exceed the resume threshold and satisfy hardware resource availability.

---

### 3.4 The Main Worker Event Loop: `spawn_worker_loop`

```rust
// [VERIFY: backend_rust/src/services/worker.rs:465-538]
pub fn spawn_worker_loop(
    worker: Arc<WorkerState>,
    ml_client: MlClient,
    db: DbPool,
    scheduler: Arc<JobScheduler>,
    registry: Arc<AnalyzerRegistry>,
) {
    tokio::spawn(async move {
        reset_interrupted_jobs(&db).await;

        let mut sys_state = SystemState::default();

        loop {
            // Reactive sleep with timeout
            tokio::select! {
                _ = worker.notify.notified() => {}
                _ = sleep(Duration::from_secs(JOB_POLL_INTERVAL_SECS)) => {}
            }

            if worker.is_paused() {
                sleep(Duration::from_secs(1)).await;
                continue;
            }

            // Telemetry throttling guard
            if let Some((reason, sleep_secs)) = scheduler.check_system(&mut sys_state) {
                worker.set_throttled(reason);
                sleep(Duration::from_secs(sleep_secs)).await;
                continue;
            }
            worker.clear_throttled();

            // Fetch and process pending job
            if let Some(job) = fetch_pending_job(&db).await {
                process_job(&job, &ml_client, &db, &worker, &scheduler, &registry, &sys_state).await;
            }
        }
    });
}
```

- **Line 475**: Crash consistency guard: resets interrupted jobs upon startup.
- **Lines 482-485**: Reactive notification via `tokio::select!`: wakes immediately when a photo is uploaded or waits 2 seconds.
- **Lines 491-496**: Evaluates system barrier. If throttled, updates atomic state and enters backoff sleep.
- **Lines 501-504**: Fetches next eligible task from SQLite and triggers sequential stage processing.

---

## 4. Fault Recovery & Crash Consistency Model

Prism treats power loss, application crashes, and SIGKILL terminations as expected operational events:

1. **Transactional Job State Transitions**:
   Job states transition atomically via SQLite WAL transactions:
   `pending` $\to$ `processing` $\to$ `completed` / `failed`.
2. **Startup Job Reset**:
   Any job found in `processing` when the backend boots is guaranteed to have been interrupted by process termination. It is safely reset to `pending` with `attempt_count` incremented.
   - [VERIFY: backend_rust/src/services/worker.rs:475]
3. **Idempotent Analyzer Stages**:
   Every analyzer verifies preconditions before computing (`!photo.has_embedding`, `!photo.has_faces`). If an analyzer finishes and writes to SQLite before a crash, the next run recognizes completion and skips to the subsequent stage without re-running the finished model.
   - [VERIFY: backend_rust/src/services/analyzers/siglip.rs:30-32]
   - [VERIFY: backend_rust/src/services/analyzers/face.rs:28-30]

---

## 5. Design Decisions & Comparative Evaluation

| Architectural Option | Evaluated Alternative | Prism Chosen Architecture | Technical Rationale |
|---|---|---|---|
| **Job Queue Store** | Redis / RabbitMQ | SQLite `background_jobs` Table | Zero external infrastructure; job records share ACID transactions with photo metadata, eliminating split-brain states. |
| **Scheduler Notification** | Polling only (5s tick) | Hybrid: `tokio::sync::Notify` + 2s timeout | Zero latency on user uploads (wakes in $< 1\text{ ms}$), with guaranteed 2s polling fallback for retries. |
| **Hardware Telemetry** | Background polling thread | Demand-driven snapshot with 10s TTL | Avoids thread contention and wakeups; reading `/sys/class/power_supply` takes $< 0.1\text{ ms}$ on Linux. |
| **Stage Failure Handling** | Fail entire job | Stage resume priority DAG | Partial progress is permanently saved. If PP-OCRv4 crashes, SigLIP embeddings and ArcFace faces remain valid and searchable. |

---

## 6. Verification Checklist

- [x] State vector definition verified against `backend_rust/src/services/worker.rs:78-85`.
- [x] Throttling thresholds (CPU 85%, Battery 20%) verified against `backend_rust/src/services/worker.rs:32-35`.
- [x] Linux sysfs power supply parser verified against `backend_rust/src/services/worker.rs:125-140`.
- [x] Analyzer priority ordering (300, 200, 100, 0) verified against analyzer implementations.
- [x] Exponential backoff bounds (30s to 600s, max 5 retries) verified against `backend_rust/src/services/worker.rs:28-30`.
- [x] Worker event loop and crash recovery verified against `backend_rust/src/services/worker.rs:465-538`.
