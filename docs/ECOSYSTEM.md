# Prism Ecosystem Guide

The **Prism Ecosystem** is a privacy-first, local-only media management, creative editing, and intelligence platform. It seamlessly unifies desktop applications, local web surfaces, peer-to-peer local network sharing, headless automation, and in-process deep learning into a coherent, zero-cloud architecture.

This document serves as the overarching guide to how the distinct components of the Prism ecosystem operate, communicate, and scale together.

---

## 1. Ecosystem Vision & Philosophy

```
                          ┌───────────────────────────┐
                          │   Zero Cloud Dependencies │
                          │   100% Local-First Engine │
                          └─────────────┬─────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────┐               ┌───────────────┐               ┌───────────────┐
│ User Privacy  │               │ Performance   │               │ Extensibility │
│ & Ownership   │               │ & Native Code │               │ & Open APIs   │
│ Argon2 Vault  │               │ Rust + Mimalloc│              │ Modular Plugins│
│ Local ONNX ML │               │ WebCodecs NLE │               │ REST + CLI    │
└───────────────┘               └───────────────┘               └───────────────┘
```

1. **Local-First & Sovereign**: Every byte of photo and video data, thumbnail cache, metadata index, face vector, and semantic embedding resides exclusively on the user's hardware. No external analytics, telemetry phoning home, or third-party cloud synchronization.
2. **Poly-Surface Experience**: One unified Rust backend powers native desktop shells (Tauri v2), desktop and mobile browser clients (React 18 + Vite), headless command-line automation (Rust CLI), and standalone mobile-scannable web portals (`/share/:token`).
3. **Decentralized LAN Collaboration**: Devices discover each other over local Wi-Fi/Ethernet using UDP beacons (port `8272`), enabling instant AirDrop-style media transfers (EasyShare) and PIN-authenticated differential library synchronization without internet access.
4. **In-Process Deep Learning**: Machine learning is treated as a first-class local capability. Neural networks (SigLIP2, ArcFace, SCRFD, LaMa, SegFormer, PP-OCRv4) execute directly in-process via ONNX Runtime without remote API latency or cost.

---

## 2. High-Level Ecosystem Topology

The diagram below illustrates how all entities within the Prism ecosystem interconnect:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     PRISM ECOSYSTEM TOPOLOGY                                      │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘

                       ┌──────────────────────────────────────────────┐
                       │           Desktop Shell (Tauri v2)           │
                       │   - Window Lifecycle & Native OS Menus       │
                       │   - Hardware Acceleration & Native Dialogs   │
                       └──────────────────────┬───────────────────────┘
                                              │ Embedded WebView
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                Frontend Client Surface (React 18 + Vite)                          │
│                                                                                                   │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │   Gallery & Explore   │  │   Creative Workspaces   │  │        Sharing & Collaboration      │  │
│  │   - Virtualized Grid  │  │   - 19-Tool Image Editor│  │   - EasyShare Radar (AirDrop Mode)  │  │
│  │   - Face Recognition  │  │   - Multi-Track NLE     │  │   - Canvas QR & Ephemeral Shares    │  │
│  │   - Leaflet Map & GIS │  │   - AI Agent Assistant  │  │   - Standalone SharePortalView      │  │
│  └───────────────────────┘  └─────────────────────────┘  └─────────────────────────────────────┘  │
│                                              │                                                    │
└──────────────────────────────────────────────┼────────────────────────────────────────────────────┘
                                               │
                                               │ HTTP / SSE / Multipart Streams (Port 8269)
                                               │
┌──────────────────────────────────────────────▼────────────────────────────────────────────────────┐
│                                   Backend Core Engine (Rust / Axum)                               │
│                                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ HTTP Router & Middleware Stack (CORS, Rate Limiting, API Key, Tracing, Telemetry)           │  │
│  └───────────────────────────────────────────┬─────────────────────────────────────────────────┘  │
│                                              │                                                    │
│  ┌───────────────────────────┐  ┌────────────┴──────────────┐  ┌───────────────────────────────┐  │
│  │   Storage & Data Engine   │  │    In-Process AI Engine   │  │   Background Job Scheduler    │  │
│  │   - SQLite WAL + FTS5     │  │    - ONNX Runtime (ort)   │  │   - 4-Stage Media Pipeline    │  │
│  │   - Kamadak EXIF Parser   │  │    - SigLIP2, SCRFD, LaMa │  │   - Thumbnail Generator       │  │
│  │   - Argon2id Vault Store  │  │    - SegFormer, PP-OCRv4  │  │   - Video Proxy Transcoder    │  │
│  └───────────────────────────┘  └───────────────────────────┘  └───────────────────────────────┘  │
│                                              │                                                    │
│  ┌───────────────────────────────────────────┴─────────────────────────────────────────────────┐  │
│  │ Local Network Services (LAN Mesh)                                                           │  │
│  │ - UDP Presence Beacon (Port 8272 Broadcast: 255.255.255.255:8272)                          │  │
│  │ - LanBeaconService Peer Liveness Registry (10s rolling auto-expiry)                         │  │
│  │ - P2P Multipart Push Engine (/api/v1/lan/push-to-peer)                                      │  │
│  │ - PIN-Secured Differential Manifest Sync                                                    │  │
│  └───────────────────────────────────────────┬─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┼────────────────────────────────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────────┐
              │                                │                                │
              ▼                                ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
│   Headless Rust CLI       │    │     Nearby LAN Peers      │    │    External Recipients    │
│   (cli/src/main.rs)       │    │   (Prism Instances on LAN)│    │   (Mobile/Desktop Web)    │
│   - Batch Import/Export   │    │   - Discovered via UDP    │    │   - Scans Canvas QR Code  │
│   - Automation & Cron     │    │   - Receive EasyShare Push│    │   - Access /share/:token  │
│   - Server Monitoring     │    │   - Differential Sync     │    │   - Optional Passcode Gate│
└───────────────────────────┘    └───────────────────────────┘    └───────────────────────────┘
```

---

## 3. The Eight Core Pillars of the Ecosystem

### Pillar 1: The Tauri v2 Desktop Shell
- **Directory**: `frontend/src-tauri/`
- **Role**: Native application wrapper for Linux (deb, rpm, AppImage), macOS (.dmg, .app), and Windows (.msi, .exe).
- **Capabilities**:
  - Direct native OS window chrome and frameless acrylic glass styling.
  - Native file picker and directory folder selection dialogues.
  - Process supervisor managing local backend lifecycles and background helpers.
  - Strict Content Security Policy (CSP) isolating the frontend WebView.

### Pillar 2: The Modern React Frontend Surface
- **Directory**: `frontend/src/`, `frontend/components/`
- **Tech Stack**: React 18.3, TypeScript 5.8, Vite 6, Tailwind CSS 3, Zustand 5, TanStack Virtual 3, Framer Motion 12.
- **Key Modules**:
  - **Virtualized Gallery**: Infinite-scrolling photogrid rendering collections with 100,000+ items smoothly at 60fps.
  - **Shared Portal View (`SharePortalView.tsx`)**: Standalone recipient interface loaded at `/share/:token` that unlocks password-protected media for guests.
  - **Centralized Share Modal (`ShareModal.tsx`)**: Multi-tab dialog switching between peer-to-peer EasyShare and QR code links.

### Pillar 3: The High-Performance Rust Backend Core
- **Directory**: `backend_rust/`
- **Tech Stack**: Rust 2021, Axum 0.7, Tokio 1.38 (multi-threaded async reactor), Mimalloc global memory allocator.
- **Key Capabilities**:
  - Sub-millisecond JSON REST API handling photo CRUD, searches, facial tagging, and metadata extraction.
  - SQLite WAL database engine with FTS5 lexical indexing and SIMD vector embeddings.
  - Argon2id cryptographic vault storing locked photos with hardware key derivation.

### Pillar 4: In-Process AI & Vision Intelligence
- **Directory**: `backend_rust/src/services/`
- **Engine**: In-process ONNX Runtime (`ort` 2.0) with CPU, CUDA, and Metal execution providers.
- **Integrated Models**:
  - **SigLIP2 (`siglip.rs`)**: 768-dimensional multimodal vision embeddings enabling natural-language text search against images without any labels.
  - **Face Recognition (`face_engine.rs`)**: SCRFD ultra-fast face detection coupled with ArcFace 512-dim face recognition embeddings and cosine-distance clustering.
  - **PP-OCRv4 (`ocr_engine.rs`)**: On-device optical character recognition detecting and indexing text embedded within screenshots, receipts, and signs.
  - **Subject Segmentation (`segmentation.rs`)**: BiSeNet and SegFormer neural background extraction and portrait bokeh depth simulation.
  - **Object Inpainting (`inpaint.rs`)**: LaMa neural diffusion model for non-destructive object erasure and defect correction.
  - **Local LLM Agent (`agent_planner.rs`)**: Conversational photo assistant coordinating tool execution via local `llama-server`.

### Pillar 5: Local Network & Peer-to-Peer Mesh (EasyShare)
- **Directory**: `backend_rust/src/services/lan_beacon.rs`, `backend_rust/src/routes/lan_sync.rs`
- **Protocol Details**:
  - **Discovery**: UDP broadcast on port `8272` emitting periodic heartbeats (`255.255.255.255:8272`).
  - **Liveness Cache**: Thread-safe peer cache pruning nodes absent for over 10 seconds.
  - **EasyShare Push**: One-click direct multipart HTTP transmission sending media binaries to `/api/v1/photos/upload` on target peers.
  - **Ephemeral QR Links**: In-browser QR code generation pointing to the server's detected LAN IP address (`http://<LAN_IP>:8269/share/<token>`) with automatic EXIF and GPS redaction.

### Pillar 6: Creative Suite & Non-Destructive Editing
- **Directory**: `frontend/components/Editor/`, `frontend/components/video-editor/`
- **Image Editor (19 Tools)**:
  - Non-destructive 32-bit floating point adjustment pipeline (Light, Color, RGB Curves, HSL, Presets, Selective Masking).
  - RAW camera format development engine (DNG, ARW, CR2, NEF) with Planckian Kelvin white balance and highlight recovery.
  - C2PA provenance and cryptographic edit history tracking.
- **Non-Linear Video Editor (NLE)**:
  - Multi-track audio, video, and title timeline with keyframe velocity easing.
  - Background proxy video transcoding for 4K/60fps playback.
  - In-browser WebCodecs hardware rendering with MP4-Muxer output.

### Pillar 7: Extensibility, Plugins & Model Packs
- **Directory**: `plugins/`, `backend_rust/src/services/plugins.rs`, `backend_rust/src/services/packs.rs`
- **Plugin Architecture**:
  - Self-contained packages with `plugin.json` manifests declaring capabilities, UI components, static assets, and custom ONNX weights.
  - Dynamic UI injection into the Image Editor and Gallery without requiring application recompilation.
  - Granular sub-feature toggles enabling users to activate individual features while preserving system RAM.

### Pillar 8: Automation CLI & Headless Deployment
- **Directory**: `cli/`, `docker-compose.yml`
- **Native Rust CLI (`cli/src/main.rs`)**:
  - Direct terminal client for querying libraries, checking server health, managing plugins, and running batch imports.
  - Formatted terminal table outputs and machine-readable `--json` flags for pipeline scripting.
- **Dockerized Server (`prism-server`)**:
  - Headless container image bundling the Rust backend and static frontend build for deployment on home servers, Unraid, and NAS hardware.

---

## 4. Ecosystem Communication Protocols

The Prism ecosystem relies on four explicit communication protocols:

| Protocol | Transport | Endpoints / Ports | Purpose |
|---|---|---|---|
| **REST API** | HTTP/1.1 (JSON) | `127.0.0.1:8269/api/v1/*` | Photo CRUD, search, album grouping, share generation, settings |
| **Server-Sent Events** | HTTP Streaming | `/api/v1/agent/chat`, `/events` | Real-time AI agent chat tokens and background batch processing progress |
| **UDP LAN Beacon** | UDP Broadcast | Port `8272` (`255.255.255.255`) | Decentralized zero-config peer discovery and heartbeat presence |
| **P2P Push Streaming** | HTTP/1.1 Multipart | `http://<peer_ip>:8269/api/v1/lan/push-to-peer` | High-speed direct media transfer between devices (EasyShare) |
| **Native Shell IPC** | Tauri IPC Bridge | `window.__TAURI__.invoke` | File system operations, native dialogs, window controls |

---

## 5. End-to-End Data Lifecycle in the Ecosystem

### A. Media Ingestion Flow
```
User Local Directory / Mobile Camera / Google Takeout ZIP
                       │
                       ▼
          Smart Ingestion Service (backend_rust)
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
Original Binary Saved           EXIF Metadata Extracted
(e.g., uploads/2026/09/IMG.jpg) (Kamadak: GPS, Camera, Date)
       │                               │
       └───────────────┬───────────────┘
                       ▼
              SQLite Record Created
                       │
                       ▼
       4-Stage Background Worker DAG
  ├── 1. WebP Thumbnail Generation (256px, 1024px)
  ├── 2. PP-OCRv4 Text Detection & FTS5 Indexing
  ├── 3. SCRFD Face Detection & ArcFace Clustering
  └── 4. SigLIP2 768-dim Semantic Embedding Vector
```

### B. Dual-Mode Sharing Flow
```
                     User Selects Photos in Gallery
                                    │
                                    ▼
                         Opens ShareModal UI
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
[EasyShare Mode]                                        [Web Link & QR Mode]
Discovers Peers via UDP 8272                            Calls POST /api/v1/shares
Selects "Living-Room-PC"                                Renders In-App Canvas QR Code
Streams files to Peer's /upload                         Mobile scans QR -> opens /share/:token
Photos imported to remote library instantly             Downloads originals (EXIF/GPS redacted)
```

---

## 6. Repository & Workspace Map

```
Prism/
├── backend_rust/              # Core Axum backend service
│   ├── Cargo.toml             # Rust dependencies (Axum, SQLx, ORT, Tokio)
│   └── src/
│       ├── main.rs            # Axum server factory & AppState assembly
│       ├── routes/            # REST API route handlers
│       │   ├── photos.rs      # Photo CRUD & metadata
│       │   ├── shares.rs      # Ephemeral share tokens & redaction
│       │   ├── lan_sync.rs    # EasyShare push & peer discovery routes
│       │   └── agent.rs       # Conversational AI agent endpoints
│       └── services/          # Business logic & machine learning engines
│           ├── lan_beacon.rs  # UDP beacon broadcaster & peer cache
│           ├── siglip.rs      # SigLIP2 semantic embeddings
│           ├── face_engine.rs # SCRFD + ArcFace face clustering
│           ├── ocr_engine.rs  # PP-OCRv4 optical character recognition
│           └── inpaint.rs     # LaMa neural object removal
├── frontend/                  # React 18 + TypeScript client surface
│   ├── src-tauri/             # Tauri v2 desktop shell configuration
│   ├── components/            # UI components
│   │   ├── sharing/           # Dual-mode ShareModal & SharePortalView
│   │   ├── Editor/            # 19-tool Image Editor
│   │   ├── video-editor/      # Multi-track NLE Video Editor
│   │   └── viewers/           # Lightbox & viewer toolbar
│   └── store/                 # Zustand state stores (uiStore, syncStore, etc.)
├── cli/                       # Native Rust command-line automation client
│   ├── Cargo.toml
│   └── src/main.rs            # Clap CLI interface for headless operation
├── plugins/                   # Extensibility plugin directory
│   ├── ai-vision-studio/      # Background removal & depth neural studio
│   ├── creative-color-studio/ # Color LUT presets & film simulations
│   └── retouch-metadata-studio/# IPTC & copyright batch processing
└── docs/                      # Ecosystem documentation suite
    ├── ECOSYSTEM.md           # This document (overarching ecosystem guide)
    ├── PRISM_MASTER_SPECIFICATION.md # Exhaustive code-verified master spec
    ├── ARCHITECTURE.md        # Technical architecture & subsystem flow
    ├── API.md                 # Complete REST API reference
    ├── CLI.md                 # Command-line interface guide
    ├── PLUGINS.md             # Plugin development handbook
    ├── AI_FEATURES.md         # Machine learning model guide
    ├── IMAGE_EDITOR.md        # Image editing suite reference
    ├── VIDEO_EDITOR.md        # Video editor & timeline specification
    ├── DATABASE.md            # SQLite schema, tables & indexes
    ├── SECURITY.md            # Privacy, encryption & vault model
    └── SETUP.md               # Environment setup & build instructions
```

---

## 7. Documentation Ecosystem Navigation Map

| If you need information about... | Consult this document |
|---|---|
| **The complete high-level ecosystem overview** | **[ECOSYSTEM.md](ECOSYSTEM.md)** *(You are here)* |
| **The exhaustive, 100% verified technical specification** | **[PRISM_MASTER_SPECIFICATION.md](PRISM_MASTER_SPECIFICATION.md)** |
| **Backend services, middleware, and architectural design** | **[ARCHITECTURE.md](ARCHITECTURE.md)** |
| **HTTP endpoints, request/response bodies, and status codes** | **[API.md](API.md)** |
| **Headless terminal usage, automation, and batch commands** | **[CLI.md](CLI.md)** |
| **Creating, testing, and publishing custom plugins** | **[PLUGINS.md](PLUGINS.md)** |
| **In-process ONNX models, face clustering, and local LLMs** | **[AI_FEATURES.md](AI_FEATURES.md)** |
| **The 19 image editing tools, RAW development, and curves** | **[IMAGE_EDITOR.md](IMAGE_EDITOR.md)** |
| **Non-linear multi-track video timeline and WebCodecs export** | **[VIDEO_EDITOR.md](VIDEO_EDITOR.md)** |
| **Database schemas, SQLite WAL, FTS5, and migrations** | **[DATABASE.md](DATABASE.md)** |
| **Argon2id locked vault, API auth, and privacy redaction** | **[SECURITY.md](SECURITY.md)** |
| **Installing dependencies, building, and running tests** | **[SETUP.md](SETUP.md)** |
