# Prism — Domain Glossary

> Architecture decisions recorded in `docs/adr/`. See [ADR-0001](docs/adr/0001-unify-into-single-adaptive-app.md) for the unification decision.

## Core Concepts

- **Platform** — The runtime environment an instance of Prism runs in. Three platforms today: Desktop (Tauri + local backend), Server (Docker + remote backend), Mobile (browser + remote backend). Unifying into one adaptive app.
- **Adaptive Layout** — A single UI that changes layout based on viewport and runtime context (sidebar on desktop, bottom nav on mobile). This is the chosen architecture for unification.
- **Backend** — The Rust Axum server (port 8269). Manages SQLite, ML inference, file storage. Unchanged by unification.
- **Frontend** — The React 18 + Zustand + Tailwind UI. Currently split into `prism-desktop/frontend/` and `prism-mobile/src/`. Being merged.
- **Runtime Context** — The combination of viewport size, Tauri availability, and network origin that determines which layout and features to show.

## Layout Rules

- **Desktop (≥1024px)**: Sidebar + header + full feature set.
- **Tablet (768–1023px)**: Collapsible sidebar, adapted layouts.
- **Mobile (<768px)**: Bottom nav, adapted editor bar at bottom, cloud-only AI agent, full map.

## AI Agent

- **Desktop**: Local llama.cpp server (in-process). No cloud dependency.
- **Mobile**: Cloud models only. Two modes:
  - **Server-proxied**: API key on the Docker server, backend forwards requests. Default for shared deployments.
  - **Direct**: API key in mobile settings, app talks to cloud API directly. For personal use.
  - Mode selected in Settings > AI. Falls back to server-proxied if no direct key configured.

## Mobile-Specific Features

- **Offline Cache**: Merged into unified app. IndexedDB caching of photos for offline browsing. Available on all platforms.
- **Server Pairing**: Mobile-only. LAN peer discovery + PIN pairing. Desktop uses direct localhost connection.
- **Auto-Backup**: Mobile-only. Automatically uploads new phone photos to server.

## State Management

- Desktop keeps its 8 Zustand stores (`editStore`, `settingsStore`, `galleryLayoutStore`, `nleStore`, `videoPlayerStore`, `syncStore`, `uiStore`).
- A new `mobileStore` is added for phone-only state (pairing, auto-backup, upload queue, offline cache).
- Mobile views import from existing desktop stores. No reorganization.

## Platform Detection (`usePlatform`)

Detection priority (highest to lowest):
1. **User preference** — toggle in Settings ("Desktop mode" / "Mobile mode"), stored in localStorage.
2. **Device detection** — `navigator.maxTouchPoints` and userAgent hints.
3. **Viewport width** — `< 768px` = mobile, `≥ 768px` = desktop.

```
pref === 'mobile'  → mobile
pref === 'desktop' → desktop
no pref + touch + small screen → mobile
no pref + large screen → desktop
```

## Build System

- **Single universal build**: one `vite build` → one `dist/`.
- Tauri APIs guarded by `window.__TAURI__` runtime checks. Tree-shaken cleanly.
- Docker serves the same `dist/`. Tauri wraps the same `dist/`.
- One artifact, three deployment targets.

## Platform Abstraction (`platform.ts`)

- All Tauri-specific APIs (file dialogs, drag-drop, window management) go through a `platform.ts` abstraction layer.
- Call sites never import Tauri directly. They call `openFileDialog()`, `onDragDrop()`, etc.
- `platform.ts` checks `window.__TAURI__` internally and falls back to browser APIs (`<input type="file">`, etc.).

## Routing

- **URL-based routing** via `react-router-dom` for all views.
- Routes: `/photos`, `/albums/:id?`, `/editor/:photoId?`, `/nle/:projectId?`, `/map`, `/people`, `/settings`, `/trash`, `/agent`.
- Deep linking works everywhere (share a link to an album).
- Android back button works natively.
- Replaces the current state-driven `currentView` approach.

## Mobile Bottom Nav (4 tabs)

| Tab | Route | Description |
|-----|-------|-------------|
| Photos | `/photos` | Main grid |
| Albums | `/albums` | Album list |
| Map | `/map` | Location view |
| Settings | `/settings` | Settings + AI config |

## Mobile Editor Layout

```
┌─────────────────────────┐
│  ← Editor    Undo  Redo │  ← top bar
├─────────────────────────┤
│                         │
│     Photo canvas        │  ← full width, pinch to zoom
│                         │
├─────────────────────────┤
│ ━━━━━━━━●━━━━━━━━━━━━━━ │  ← active tool slider (thumb zone)
├─────────────────────────┤
│ Exposure  Brightness  … │  ← tool categories (horizontal scroll)
└─────────────────────────┘
```
- Tool categories at the very bottom (horizontal scroll).
- Slider for active tool sits above categories (closer to thumb).
- Canvas gets maximum space.

## Migration Strategy

- **Fork and merge** via `unified` branch.
- Desktop app (`prism-desktop/frontend/`) is the base.
- Incrementally add: `usePlatform`, `platform.ts`, mobile layouts, URL routing.
- `prism-mobile/` stays on `main`, untouched, until unified app is verified.
- Merge back to main, then delete `prism-mobile/`.

## Implementation Phases

**Phase 1 — Foundation** (no visible changes)
- `usePlatform` hook
- `platform.ts` abstraction
- URL routing (replace `currentView` state)
- Verify desktop unchanged

**Phase 2 — Mobile Layout** (phones get new UI)
- Bottom nav component
- Mobile header + contextual search
- `isMobile` conditional in `App.tsx`
- Mobile editor layout (slider above categories)
- Responsive NLE, Map, Agent

**Phase 3 — Mobile-Specific Features**
- `mobileStore` (pairing, auto-backup, upload queue)
- Port offline cache from `prism-mobile/`
- Cloud AI agent mode (direct + server-proxied)

**Phase 4 — Docker + Cleanup**
- Update Dockerfile for unified `dist/`
- Delete `prism-mobile/`
- Update `prism-server/docker-compose.yml`

## File Structure (Post-Unification)

```
/
├── CONTEXT.md                          ← this glossary
├── docs/adr/
│   └── 0001-unify-into-single-adaptive-app.md
├── prism-desktop/
│   ├── frontend/                       ← THE unified app
│   │   ├── App.tsx                     ← adaptive layout
│   │   ├── platform.ts                 ← Tauri/browser abstraction
│   │   ├── hooks/usePlatform.ts        ← platform detection
│   │   ├── components/layout/          ← sidebar (desktop) + bottomNav (mobile)
│   │   ├── components/mobile/          ← mobile-specific components
│   │   ├── store/mobileStore.ts        ← phone-only state
│   │   └── ...                         ← existing desktop code
│   ├── backend_rust/                   ← unchanged
│   └── cli/                            ← unchanged
├── prism-server/                       ← Docker (nginx + backend)
└── (prism-mobile/)                     ← deleted after Phase 4
```

## Mobile Search

- Search bar is in the **header**, not bottom nav.
- **Contextual**: search behavior changes per page.
  - Photos page: searches all photos (FTS5).
  - Albums page: filters album names.
  - Map page: searches by location name.
  - Editor/NLE: searches media within current project/scope.

## Pending Terms

*(Added as decisions are made)*
