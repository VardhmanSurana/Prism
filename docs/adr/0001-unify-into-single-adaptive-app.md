# Unify Prism into a Single Adaptive App

Prism currently ships three separate React apps: a full-featured desktop UI (Tauri + local backend), a simplified mobile UI (browser + remote backend), and a Docker server that serves only the backend. We decided to merge all three into one React codebase that adapts its layout and features at runtime based on platform detection.

## Status

Accepted

## Context

The desktop app (`prism-desktop/frontend/`) and mobile app (`prism-mobile/src/`) share the same React 18 + Zustand + Tailwind stack, the same REST API endpoints, and the same data models. The mobile app is roughly 10% of the desktop app's code — a subset with a bottom nav instead of a sidebar. Maintaining two codebases for the same product creates drift: bug fixes must be applied twice, new features must be built twice, and the mobile app consistently lags behind.

The Docker server (`prism-server/`) currently runs only the Rust backend with no frontend. Users must run a separate desktop or mobile client to view photos. There is no way to access the library from a browser on another device.

## Decision

Build one React app that runs everywhere:

- **Desktop (Tauri)**: Full UI with sidebar, editor, NLE, map, AI agent. Local backend on port 8269.
- **Desktop (browser)**: Same UI connecting to a local or remote backend.
- **Docker server**: nginx serves the same `dist/` on port 80, proxies `/api/*` to the internal backend. No backend port exposed.
- **Phone (browser)**: Responsive layout with bottom nav, adapted editor, cloud AI agent. Connects to the Docker server.

Platform detection uses three signals with priority: user preference (Settings toggle) > device detection (`navigator.maxTouchPoints`) > viewport width (`< 768px`).

## Considered Options

**Option A: One codebase, multiple build targets.** Separate Vite configs for Tauri, web, and mobile. Each produces its own `dist/`. Rejected because it reintroduces the maintenance burden — three builds to keep in sync, three places to fix bugs.

**Option B: One running instance, adaptive UI (chosen).** Single `vite build` → single `dist/`. Runtime guards (`window.__TAURI__`) handle platform differences. One artifact, three deployment targets.

**Option C: Keep three apps, share a component library.** Extract shared components into a package, consume from all three apps. Rejected as over-engineered — the apps are 90% identical already. A shared library adds build complexity without proportional benefit.

## Consequences

- The `prism-mobile/` directory is deleted. Its unique features (offline cache, server pairing, auto-backup) are ported into the desktop frontend, with pairing and auto-backup gated to mobile-only views.
- Tauri-specific APIs (file dialogs, drag-drop) are abstracted behind a `platform.ts` layer. Call sites never import Tauri directly.
- URL routing (`react-router-dom`) replaces the state-driven `currentView` navigation. Every view gets a route (`/photos`, `/albums/:id`, `/editor/:photoId`). Deep linking and browser back/forward work everywhere.
- The mobile editor moves the tool categories to the bottom (horizontal scroll) with the active slider above it (thumb zone). Canvas gets maximum space.
- The AI agent on mobile uses cloud models only (OpenAI/Anthropic/etc.) via two modes: server-proxied (API key on Docker server) or direct (API key in mobile settings). Desktop retains the local llama.cpp backend.
- Offline photo caching (IndexedDB) is available on all platforms. Server pairing and auto-backup are mobile-only.
- The Docker Dockerfile is rewritten to build both frontend and backend in a multi-stage build, producing an nginx-based image that serves the frontend and proxies the API.
