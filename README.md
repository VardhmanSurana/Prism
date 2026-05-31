<p align="center">
  <img src="https://img.shields.io/badge/PRISM-000000?style=for-the-badge&logo=photo&logoColor=white" alt="Prism Logo" width="300" />
</p>

<p align="center">
  <strong>A high-performance, privacy-first, local-only desktop library organizer.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/badge/Security-KEK%2FDEK%20Hardened-success?style=flat-square" alt="Security Hardened" />
</p>

---

## 🔮 Introduction

**Prism** is a state-of-the-art, local-first desktop application designed for privacy-conscious photographers. It manages and indexes local photo catalogs with native processing speed. By combining face clustering, offline geographic metadata extraction, and local AI agent search into a highly optimized client interface, Prism delivers professional-grade organization tools while ensuring **100% of your data remains on your host machine**.

---

## 📋 Table of Contents

1. [🛠 Technology Stack](#-technology-stack)
2. [🚀 Core Architectural Highlights](#-core-architectural-highlights)
3. [🏁 Getting Started](#-getting-started)
   - [Prerequisites](#prerequisites)
   - [One-Click Startup](#one-click-startup)
   - [Manual Setup](#manual-setup)
4. [🔐 Security Boundary Enforcements](#-security-boundary-enforcements)
5. [🧑‍💻 Contribution & Community](#-contribution--community)
6. [🙏 Acknowledgements & Credits](#-acknowledgements--credits)
7. [📜 License](#-license)

---

## 🛠 Technology Stack

<p align="left">
  <img src="https://img.shields.io/badge/Tauri-v2-24C6C1?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
</p>

- **Frontend Core:** React + TypeScript + Vite.
- **Backend Service:** FastAPI, Python, SQLAlchemy (SQLite via asynchronous `aiosqlite`).
- **Desktop Shell:** Tauri v2 desktop integration.
- **Local AI Engines:** InspireFace C++ SDK (face clustering) and local Ollama Vision models.

---

## 🚀 Core Architectural Highlights

<details>
  <summary>🔑 **1. Decoupled KEK/DEK Envelope Encryption (Locked Folder)** <em>(Click to Expand)</em></summary>

  To guarantee industry-grade local security, the **Locked Folder** isolates and encrypts private photos:
  - **The Design:** Decouples user passwords from file keys. Setup generates a cryptographically random 32-byte **Data Encryption Key (DEK)**. The user password derives a **Key Encryption Key (KEK)** using PBKDF2 with 100,000 rounds. The KEK encrypts the DEK, saving only the `encrypted_dek` to disk.
  - **The Benefit:** Safe password updates are handled entirely by re-wrapping the DEK; **no file-system decryption/re-encryption loops on disk are required**.
  - **Thread-Offloaded Execution:** All KDF and file encryption operations are offloaded to asynchronous worker threads, keeping the event loop responsive.
</details>

<details>
  <summary>⚡ **2. Performance Caching & Sub-Millisecond Search** <em>(Click to Expand)</em></summary>

  - **Background Multiprocess Pipeline:** Image sharpness (OpenCV Laplacian variance) and file sizes are extracted on ingestion inside the background process pool, completely avoiding FastAPI main thread blocking.
  - **Sub-Millisecond Querying:** Metrics are cached in the database. Endpoints like `/blurry` and `/metadata` resolve instantly via rapid SQL queries rather than dynamically reading heavy image files from disk inside the API lifecycle.
  - **Active SQLite Connection Pragmas:** bound directly to connection event listeners, keeping WAL operations, caches (`cache_size=-64000`), and temp stores locked at maximum concurrency.
</details>

<details>
  <summary>🎨 **3. High-Performance Virtual Grid Memoization** <em>(Click to Expand)</em></summary>

  - **Grid Cascade Elimination:** The virtualized photo rows (`PhotoGridRow`) implement custom `React.memo` comparison gates. A row only re-renders if the selection states of its specific child cells toggle—**preventing whole-page re-render loops**.
  - **Framer Motion Layout Optimization:** Dynamic layout sweeps are removed from individual scrolling cells, guaranteeing a solid 60/120 FPS scrolling experience on massive catalogs.
</details>

---

## 🏁 Getting Started

### Prerequisites

- **Project Launcher:** [Bun](https://bun.sh) v1.0+
- **Python Engine:** [Python 3.11+](https://www.python.org/)
- **Backend Manager:** [uv](https://github.com/astral-sh/uv) (for isolated fast dependency environment setups)

### One-Click Startup

To install dependencies and start both the frontend Vite client and the backend server concurrently under the Tauri environment shell:

```bash
bun install
bun run desktop
```

### Manual Setup

If you prefer running development components in separate terminals:

**Terminal 1: Python API Backend**
```bash
cd backend
uv venv
source .venv/bin/activate
uv sync
uv run python -m app.main
```

**Terminal 2: Frontend Client**
```bash
cd frontend
bun install
bun run dev
```

---

## 🔐 Security Boundary Enforcements

Prism Photos operates on a strict zero-trust sandbox architecture for local APIs:
1. **CORS Boundary Enforcement:** The API blocks all cross-origin requests by default. `allow_origins` is restricted strictly to local Tauri app scopes (`tauri://localhost`, `http://tauri.localhost`, `http://localhost:3005`). 
2. **Directory Isolation:** File retrieval endpoints absolutely prevent path traversal. Access is bounded to standard application uploads, thumbnails, home `Pictures` directories, and Unix external mounts (`/media`, `/Volumes`, `/mnt`). Any out-of-boundary access immediately triggers a `403 Access Denied`.

---

## 🧑‍💻 Contribution & Community

We warmly welcome contributions to Prism Photos! 
- Head over to `CONTRIBUTING.md` to read our coding style standards and workflow guidelines.
- To report bugs, please open an Issue. For security concerns, contact the maintainers directly.

---

## 🙏 Acknowledgements & Credits

Prism Photos stands on the shoulders of these incredible open-source libraries:
- **InspireFace:** Native C++ face detection and feature recognition.
- **reversing_geocoder:** Lightning-fast offline reverse-geocoding via GeoNames K-D tree.
- **Pillow & Pillow-Heif:** High-fidelity image parsing and EXIF metadata extraction.
- **TanStack Virtual:** High-performance list and grid virtualization.

---

## 📜 License

This project is licensed under the **MIT License**. Check out [LICENSE](LICENSE) for details.
