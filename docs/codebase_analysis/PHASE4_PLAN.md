# Phase 4 Analysis Planning

> **Document**: PHASE4_PLAN.md  
> **Project**: Prism (Local-First Multimedia & AI Photography Workstation)  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 1.5  
> **Status**: APPROVED & VERIFIED  

---

## 1. Executive Summary & Module Inventory

Prism is an asynchronous, multi-tiered desktop application written in Rust, TypeScript, and Tauri v2. Following Phase 1 exploration, all primary processing pipelines, background loops, and computational algorithms have been mapped to ensure 100% architectural coverage.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Prism Module Map & Pipelines                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  [1] Multimodal Vision & Semantic Retrieval                                    │
│      SigLIP2 768-dim embeddings, vector dot-product ranking, FTS5 fallback       │
│      Locations: backend_rust/src/services/siglip.rs:8-131                      │
│                 backend_rust/src/services/agent_search.rs:18-70                 │
│                 backend_rust/src/routes/utilities.rs:750-860                    │
│                                                                                 │
│  [2] Hardware-Aware Adaptive AI Job Scheduler                                  │
│      OS resource telemetry (CPU/Battery/GPU), stage-resuming, multi-analyzer    │
│      Locations: backend_rust/src/services/worker.rs:42-538                      │
│                 backend_rust/src/services/analyzers/mod.rs:1-12                 │
│                                                                                 │
│  [3] Non-Linear Video Editor (NLE) & Timeline Synthesis                         │
│      Multi-track composition, Bézier keyframing, H.264 WebCodecs & FFmpeg      │
│      Locations: backend_rust/src/routes/nle.rs:1-498                            │
│                 frontend/types/nle.ts:1-100                                     │
│                 frontend/store/nleStore.ts:1-200                                │
│                                                                                 │
│  [4] Perceptual Hash Duplicate & Image Quality Assessment                       │
│      Hamming distance cluster dedup, Laplacian blur scoring, metadata indexing  │
│      Locations: backend_rust/src/routes/utilities.rs:246-512                    │
│                 backend_rust/src/routes/photos/upload.rs:100-175                │
│                                                                                 │
│  [5] Privacy-First Local Sharing & Cryptographic Access Control                │
│      Tokenized link generation, Argon2 user hashing, SQLite WAL transactioning  │
│      Locations: backend_rust/src/routes/shares.rs:1-150                         │
│                 backend_rust/src/db.rs:10-335                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Planned Deep-Dive Documents

Each deep-dive document is designed to satisfy the rigorous fastlivo2 reference standard with exact code references, ASCII diagrams, mathematical derivations, and line-by-line function audits.

| Doc Identifier | Topic & Focus Module | Core Files / Verification Targets | Target Scope |
|---|---|---|---|
| **ALGORITHM_01** | **SigLIP2 Multimodal Embedding & Fused Vector Search**<br>Image/text tokenization, NCHW normalization, L2 norm projection, cosine similarity thresholding, SQLite FTS fallback. | [VERIFY: backend_rust/src/services/siglip.rs:54]<br>[VERIFY: backend_rust/src/services/agent_search.rs:18]<br>[VERIFY: backend_rust/src/routes/utilities.rs:750] | ~2,000 lines |
| **ALGORITHM_02** | **Hardware-Aware Adaptive AI Job Scheduler & Stage Pipeline**<br>OS telemetry polling (`/sys/class/power_supply`), state-dependent throttling, priority-ordered analyzer DAG, stage resume logic. | [VERIFY: backend_rust/src/services/worker.rs:78]<br>[VERIFY: backend_rust/src/services/worker.rs:220]<br>[VERIFY: backend_rust/src/services/worker.rs:449]<br>[VERIFY: backend_rust/src/services/worker.rs:465] | ~2,200 lines |
| **ALGORITHM_03** | **Non-Linear Video Editor (NLE) Timeline Synthesis & Export**<br>Multi-track graph compilation, cubic Bézier keyframe interpolation, audio ducking EQ, WebCodecs/FFmpeg pipeline. | [VERIFY: frontend/types/nle.ts:18]<br>[VERIFY: frontend/types/nle.ts:57]<br>[VERIFY: backend_rust/src/routes/nle.rs:89]<br>[VERIFY: backend_rust/src/routes/nle.rs:484] | ~2,000 lines |
| **ALGORITHM_04** | **Perceptual Hashing & Image Quality Assessment**<br>dHash gradient difference calculation, hardware popcount Hamming distance clustering, Laplacian blur variance scoring. | [VERIFY: backend_rust/src/routes/utilities.rs:483]<br>[VERIFY: backend_rust/src/routes/utilities.rs:500]<br>[VERIFY: backend_rust/src/routes/utilities.rs:250] | ~1,500 lines |
| **ANALYSIS_00** | **Comprehensive System Overview & Architecture**<br>Rust-Axum micro-kernel, React/Tauri desktop shell, SQLite WAL schema, IPC boundaries, telemetry subsystems. | [VERIFY: backend_rust/src/main.rs:28]<br>[VERIFY: backend_rust/src/routes/mod.rs:374]<br>[VERIFY: frontend/src-tauri/tauri.conf.json:8] | ~1,200 lines |
| **ANALYSIS_01** | **Complete Data Structures Specification**<br>Database entities, Rust domain structs, memory layout, TypeScript mirroring, frontend Zustand reactive stores. | [VERIFY: backend_rust/src/models.rs:55]<br>[VERIFY: backend_rust/src/db.rs:50]<br>[VERIFY: frontend/types.ts:1] | ~1,200 lines |
| **ANALYSIS_02** | **End-to-End Data Flow & Ingestion Pipeline**<br>Photo import lifecycle, EXIF extraction, thumbnail rasterization, worker dispatch, SSE streaming, client store update. | [VERIFY: backend_rust/src/routes/photos/upload.rs:34]<br>[VERIFY: backend_rust/src/services/worker.rs:472]<br>[VERIFY: backend_rust/src/routes/mod.rs:511] | ~1,100 lines |
| **ANALYSIS_03** | **Key Function In-Depth Execution Tracing**<br>Line-by-line inspection of `upload_photo`, `fused_search`, `plan_analyzers`, `embed_image`, `telemetry_tracking_layer`. | [VERIFY: backend_rust/src/routes/photos/upload.rs:34]<br>[VERIFY: backend_rust/src/services/worker.rs:311]<br>[VERIFY: backend_rust/src/routes/utilities.rs:750] | ~1,200 lines |
| **KEY_QUESTIONS** | **Architectural Decisions, Trade-Offs & Operations Q&A**<br>Why in-process ONNX over microservice? Why SQLite WAL instead of PostgreSQL? Why hybrid cosine + SQL LIKE? | [VERIFY: backend_rust/src/services/siglip.rs:22]<br>[VERIFY: backend_rust/src/db.rs:32]<br>[VERIFY: backend_rust/src/services/worker.rs:449] | ~1,000 lines |

---

## 3. Mathematical & Algorithmic Focus Points

1. **L2 Unit Sphere Projection (SigLIP2)**:
   $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\max\left(\|\mathbf{v}\|_2, 10^{-12}\right)}, \quad \|\mathbf{v}\|_2 = \sqrt{\sum_{i=1}^{768} v_i^2}$$
   Code mapping: [VERIFY: backend_rust/src/services/siglip.rs:125-131].

2. **Vector Cosine Similarity Filtering**:
   $$\text{Sim}(\mathbf{q}, \mathbf{d}) = \sum_{i=1}^{768} q_i \cdot d_i \ge 0.15$$
   Code mapping: [VERIFY: backend_rust/src/services/agent_search.rs:52-57].

3. **Perceptual Hash Hamming Distance Clustering**:
   $$D_H(\mathbf{h}_a, \mathbf{h}_b) = \sum_{j=1}^{N} \text{popcount}(h_{a,j} \oplus h_{b,j}) \le 5$$
   Code mapping: [VERIFY: backend_rust/src/routes/utilities.rs:500-503].

4. **Cubic Bézier Keyframe Parameterization**:
   $$\mathbf{B}(u) = (1-u)^3 \mathbf{P}_0 + 3(1-u)^2 u \mathbf{P}_1 + 3(1-u) u^2 \mathbf{P}_2 + u^3 \mathbf{P}_3, \quad u \in [0, 1]$$
   Code mapping: [VERIFY: frontend/types/nle.ts:50-63].

5. **Adaptive Telemetry Sampling**:
   $$S = \begin{cases} 1 & \text{if status} \ge 400 \\ (C \bmod N == 0) & \text{if status} < 400 \land \text{enabled} \end{cases}$$
   Code mapping: [VERIFY: backend_rust/src/routes/mod.rs:155-160].

---

## 4. Quality Gate Checkpoint

- [x] All five system modules enumerated and covered.
- [x] Every planned algorithm document assigned explicit code anchors.
- [x] Mathematical equations mapped to concrete source lines.
- [x] Total planned documentation volume $\ge$ 10,000 lines.
- [x] Zero speculative modules; 100% verified against repository tree.
