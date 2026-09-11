# Prism Product Coherence Roadmap

> **Guiding Principle**:  
> *“Prism makes the first decision for the user, explains it when asked, and allows a safe override.”*

Prism’s underlying architecture is comprehensive—encompassing high-performance Rust services, local ONNX deep learning models, non-destructive image/video editors, and peer-to-peer LAN meshes. This roadmap defines the transition from a collection of powerful technical capabilities into **one coherent, frictionless product** centered around the ethos: **install and use immediately, customize deeply later**.

---

## 1. Zero-Configuration Desktop Startup & Server Pairing

### The Problem
Users currently encounter architectural distinctions between Tauri desktop mode, web browser mode, and server backends. Entering hostnames, ports, database URLs, or API keys creates unnecessary friction during onboarding.

### The Solution
Implement a unified startup flow presenting two distinct, self-evident paths:

```
┌─────────────────────────────────────────────────────────────┐
│                    Welcome to Prism                         │
├──────────────────────────────┬──────────────────────────────┤
│    [1] Use This Device       │   [2] Connect to My Prism    │
│  (Default · Recommended)     │   (Self-Hosted / Home NAS)   │
│                              │                              │
│  • Auto-starts local backend │  • Discovers LAN Prism nodes │
│  • Manages SQLite database   │  • One-click PIN pairing     │
│  • Zero technical questions  │  • Remote streaming library  │
└──────────────────────────────┴──────────────────────────────┘
```

#### Key Requirements:
1. **Zero Prompts for Desktop**: Desktop shell automatically boots the bundled Axum backend on an ephemeral or standard port (`8269`), binds local storage to standard OS user directories (`~/.local/share/prism` or `%APPDATA%/Prism`), and transitions directly to the gallery.
2. **Automatic LAN Discovery for Connected Clients**: Web and mobile clients scan the local subnet via UDP beacon discovery (`GET /api/v1/lan/nearby`) and present detected instances with hostnames and IP addresses.
3. **Explicit Storage Boundary Model**:
   - **Local Mode**: Native file picker opens local directories directly.
   - **Remote Mode**: Browser displays explicit server-side folder browser (`POST /api/v1/photos/expand-directory`) alongside drag-and-drop local uploads, eliminating confusion over where files reside.

---

## 2. Shared Capability & Model State Registry

### The Problem
Currently, buttons (e.g., AI Inpainting, Face Recognition, Semantic Search) may appear active but fail if models are not downloaded or if local hardware is insufficient.

### The Solution
A unified, authoritative capability registry exposed by the backend and queried by all clients (Desktop, Web, CLI, Agent, Plugins):

```http
GET /api/v1/capabilities
```

```json
{
  "semantic_search": {
    "available": true,
    "state": "ready",
    "execution": "in_process",
    "provider": "onnx_siglip2"
  },
  "object_removal": {
    "available": false,
    "state": "model_not_installed",
    "model_name": "lama_fp32",
    "download_size_bytes": 208666624,
    "hardware_requirement": "CPU or CUDA (≥2GB RAM)"
  },
  "video_export": {
    "available": true,
    "state": "ready",
    "execution": "client_webcodecs"
  },
  "face_recognition": {
    "available": true,
    "state": "disabled_by_user",
    "opt_in_required": true
  }
}
```

#### Lifecycle State Separation:
Every feature and neural model tracks three distinct lifecycle phases:
- **`installed`**: Model binary exists on disk in `models/`.
- **`enabled`**: User has opted in to the capability in Settings.
- **`resident_in_ram`**: ONNX session or weights are actively loaded in memory.

#### UX Impact:
Clicking an unavailable capability never throws a raw error. Instead, it displays a concise **Capability Sheet**:
- Download size and estimated time.
- VRAM / RAM requirements and device compatibility.
- One-click **"Download & Enable"** action with live progress.

---

## 3. Durable Jobs & Unified Activity Center

### The Problem
Long-running processes (directory imports, 4-stage AI batch DAGs, video proxy rendering, P2P EasyShare transfers) currently report progress primarily via transient Server-Sent Events. If a user refreshes their browser or restarts the app, perceived progress is lost.

### The Solution
Upgrade the `background_jobs` engine into a persistent, durable job scheduler with a unified Activity Center UI.

```
┌─────────────────────────────────────────────────────────────┐
│                       Activity Center                       │
├─────────────────────────────────────────────────────────────┤
│ ⟳ Importing Family Vacation (142/250 photos)         [Pause]│
│   ████████████████░░░░░░░░░░ 56% · 12 MB/s · 45s left       │
├─────────────────────────────────────────────────────────────┤
│ ⟳ Generating Face Embeddings (1,024 photos)         [Cancel]│
│   ██████████████████████░░░░ 84% · Batch 4 of 5             │
├─────────────────────────────────────────────────────────────┤
│ ✓ EasyShare to MacBook-Pro (18 photos transferred)  [Clear] │
└─────────────────────────────────────────────────────────────┘
```

#### Engine Specifications:
1. **Durable Persistence**: Every job record in `background_jobs` retains:
   - `id`: Unique UUID.
   - `job_type`: `import`, `ai_analysis`, `video_proxy`, `p2p_transfer`, `export`.
   - `status`: `pending`, `running`, `paused`, `completed`, `failed`, `cancelled`.
   - `progress`: Current count, total count, phase, throughput rate.
   - `last_error`: Human-readable error message with retry recommendations.
2. **State Recovery**: Upon client reconnect or app launch, `GET /api/v1/jobs` instantly restores all active and recently completed tasks.
3. **Safe Interruption & Checkpoints**: Interrupted jobs resume from their last atomic batch rather than restarting from zero.

---

## 4. Managed Default Bundle & Resource-Aware Lazy Loading

### Recommended Out-of-the-Box Defaults:

| Subsystem | Shipped Default | User Friction |
|---|---|---|
| **Core Gallery & Albums** | Active immediately | Zero |
| **Thumbnails & EXIF Indexing** | Automatic, resource-aware | Zero |
| **Basic Image Adjustments** | Built-in canvas pipeline | Zero |
| **SigLIP2 Semantic Search** | Default recommended local model | Download prompt on first search |
| **Face Recognition** | Disabled until explicit opt-in | 1-click privacy prompt |
| **LaMa Inpainting & Neural Bokeh** | Lazy-loaded on tool selection | Download on demand |
| **Local LLM Search Agent** | Lazy-loaded when Agent tab opened | Download on demand |
| **LAN EasyShare & Discovery** | Enabled when user opens Share | 1-click network consent |

#### Memory Eviction Policy:
To safeguard system responsiveness on modest machines (e.g., 8GB RAM laptops), heavy ONNX models automatically unload from RAM after **10 minutes of inactivity**, remaining instantly reloadable from disk.

---

## 5. Explicit Synchronization Rules

Before expanding library synchronization beyond EasyShare device-to-device transfers, Prism adheres to explicit consistency boundaries:

1. **Topology Model**:
   - **Primary Server & Connected Clients** (Standard Model): One central Prism instance acts as the source of truth; connected clients stream, view, and upload directly.
   - **Peer-to-Peer Imports (EasyShare)**: Independent libraries push and pull discrete photos as explicit import actions.
2. **Conflict Resolution Matrix**:
   - **Original Files**: Content-addressed by SHA-256; duplicates are deduplicated on ingest.
   - **Metadata & Edits**: Non-destructive edits follow *Last-Write-Wins* with timestamped revision histories.
   - **Deletions**: Soft-deletion (Trash) is local; deleting on client moves to server Trash rather than performing an immediate hard purge.
3. **Explicit Labeling**: Synchronization is never labeled as a backup. Backups require immutable, versioned snapshots.

---

## 6. Hardened Plugin & Extensibility Contract

### Requirements:
1. **Declared Permission Sandboxing**: Plugins declare specific resource requirements in `plugin.json`:
   - `permissions: ["storage:read", "models:inference", "ui:editor_panel"]`
2. **Automatic Settings UI Generation**: Plugins declare settings via JSON Schema, allowing Prism to render configuration inputs automatically.
3. **Safe Mode Recovery**: If a plugin panics or fails to initialize, Prism boots in **Safe Mode** (`prism --safe-mode`), disabling non-core extensions while preserving user media.
4. **Clean Uninstall**: Removing a plugin purges its config, assets, and cache files completely.

---

## 7. Security & Privacy Precision Standards

All public documentation and interface copy adheres to exact technical definitions:

- **Locked Vault**: Accurately described as *database query isolation and UI session gating authenticated via memory-hard Argon2id KDF*. Media encryption at rest (AES-256-GCM) is explicitly scheduled for file-level protection.
- **Zero Cloud**: Defined as: *“Media processing, indexing, and storage require zero cloud services and run completely offline. Optional neural models and software packages contact external registries only upon explicit user request.”*
- **LAN Scope**: Clarified that LAN QR links and UDP discovery operate strictly within the bounds of the local Wi-Fi or Ethernet subnet and are not reachable over the public internet.

---

## 8. Portable Customization: The Prism Profile

Users can export, share, and restore their setup via a portable `.prismprofile` archive:

- **Included**: Theme tokens, workspace layouts, keyboard shortcut overrides, custom export presets, and non-destructive filter recipes.
- **Excluded by Default**: Authentication credentials, absolute filesystem paths, and machine-specific database URLs.
- **Reversibility**: Every settings section provides **"Reset Section"**, **"View Changed Values"**, and **"Export Profile"**.

---

## Implementation Sequence

| Phase | Milestone | Primary Deliverables |
|---|---|---|
| **Phase 1** | **Capability Registry & Smart Defaulting** | `GET /api/v1/capabilities` backend endpoint + frontend `useCapabilities()` hook and lazy model download cards |
| **Phase 2** | **Zero-Config Startup & Server Switcher** | "Use this device" zero-prompt boot + "Connect to Prism" LAN discovery modal |
| **Phase 3** | **Durable Activity Center** | Universal `background_jobs` status tracker + UI Activity popover with pause/resume/retry |
| **Phase 4** | **Hardened Plugin Lifecycle & Safe Mode** | Manifest permission checks + schema-driven plugin settings + CLI `--safe-mode` |
| **Phase 5** | **Portable Profiles & Vault Encryption** | `.prismprofile` import/export + file-level AES-256-GCM encryption at rest |
