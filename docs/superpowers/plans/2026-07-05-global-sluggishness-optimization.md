# Global Sluggishness Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve overall UI sluggishness (such as during sidebar/tab navigation and page switches) by optimizing heavy CSS backdrop blurs and avoiding redundant date parsing in the image sorting loop.

**Architecture:** 
1. Precompute `dateTimestamp` and `uploadDateTimestamp` on the `Photo` model during normalization so that sorting is a simple integer subtraction instead of repeatedly invoking `new Date()`.
2. Downgrade backdrop-filter blurs in the `GlassMaterial` component to reduce GPU rendering/compositing overhead in WebViews while preserving aesthetics.

**Tech Stack:** React 18, TypeScript, TailwindCSS/Vanilla CSS, Vitest.

## Global Constraints
- Do not introduce external date libraries.
- Run typecheck and tests on every task.

---

### Task 1: Precompute Timestamps on the `Photo` Interface and Normalizer

**Files:**
- Modify: [types.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/types.ts)

**Interfaces:**
- Consumes: Raw photo objects from the API.
- Produces: Normalized `Photo` objects containing precomputed `dateTimestamp` and `uploadDateTimestamp` numeric values.

- [ ] **Step 1: Update the `Photo` interface definition**
  Locate lines 1 to 39 in `frontend/types.ts` and add properties `dateTimestamp` and `uploadDateTimestamp` to `interface Photo`:
  ```typescript
  export interface Photo {
    id: string | number;
    url: string;
    path: string;           // absolute filesystem path (used for local:// fallback)
    width: number;
    height: number;
    aspect_ratio?: number;
    date: string;           // ISO string (Creation Date / date_taken)
    dateTimestamp: number;  // Add this line
    date_taken?: string;
    uploadDate?: string;    // camelCase alias used in App.tsx sorting
    uploadDateTimestamp: number; // Add this line
    upload_date?: string;   // snake_case as returned by backend
    location?: string;
    // ... rest of interface
  ```

- [ ] **Step 2: Update `normalizePhoto` to compute timestamps**
  Update the `normalizePhoto` implementation to compute the timestamps once:
  ```typescript
  export function normalizePhoto(raw: RawPhoto): Photo {
    const isLocked = raw.is_locked ?? raw.isLocked ?? false;
    const resolvedUrl = isLocked ? `/api/v1/photos/${raw.id}/thumbnail` : (raw.url || '');
    const rawDate = raw.date || raw.date_taken || '';
    const sanitizedDate = sanitizeDateString(rawDate);
    const rawUploadDate = raw.upload_date ?? raw.uploadDate ?? rawDate;
    const sanitizedUploadDate = sanitizeDateString(rawUploadDate);

    const dateTimestamp = sanitizedDate ? new Date(sanitizedDate).getTime() : 0;
    const uploadDateTimestamp = sanitizedUploadDate ? new Date(sanitizedUploadDate).getTime() : dateTimestamp;

    return {
      ...raw,
      id: raw.id,
      url: resolvedUrl,
      path: raw.path || '',
      width: raw.width || 0,
      height: raw.height || 0,
      date: sanitizedDate,
      date_taken: sanitizeDateString(raw.date_taken),
      // Boolean flags - prioritize snake_case from backend
      isFavorite: raw.is_favorite ?? raw.isFavorite ?? false,
      isLocked: isLocked,
      isTrash: raw.is_trash ?? raw.isTrash ?? false,
      // Date fields
      uploadDate: sanitizedUploadDate,
      dateTimestamp,
      uploadDateTimestamp,
      // Keep original fields for compatibility
      is_favorite: raw.is_favorite ?? raw.isFavorite ?? false,
      is_locked: isLocked,
      is_trash: raw.is_trash ?? raw.isTrash ?? false,
      upload_date: sanitizedUploadDate,
      type: raw.type || (raw.mime_type?.startsWith('video/') ? 'video' : 'image'),
      mime_type: raw.mime_type,
      file_type: raw.file_type,
      file_size: raw.file_size,
      duration: raw.duration,
      fps: raw.fps,
      codec: raw.codec,
      audio_codec: raw.audio_codec,
      animated_url: raw.animated_url,
    };
  }
  ```

- [ ] **Step 3: Run typecheck**
  Run: `cd frontend && bunx tsc --noEmit`
  Expected: Clean compilation with 0 errors.

- [ ] **Step 4: Run tests**
  Run: `cd frontend && bun run test`
  Expected: All 11 tests pass.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add frontend/types.ts
  git commit -m "perf: precompute photo timestamps during normalization"
  ```

---

### Task 2: Optimize Image Sorter with Precomputed Timestamps

**Files:**
- Modify: [usePhotoSorting.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/hooks/appState/usePhotoSorting.ts)

**Interfaces:**
- Consumes: `Photo` object list with `dateTimestamp` and `uploadDateTimestamp` numbers.
- Produces: Sorted array of photos.

- [ ] **Step 1: Update the sorting comparator logic in `usePhotoSorting`**
  Modify sorting comparators to use precomputed timestamp values instead of instantiating `new Date()` repeatedly:
  ```typescript
      if (sortMode === 'newest') {
        return result.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
      }
      if (sortMode === 'oldest') {
        return result.sort((a, b) => a.dateTimestamp - b.dateTimestamp);
      }
      if (sortMode === 'added') {
        return result.sort((a, b) => b.uploadDateTimestamp - a.uploadDateTimestamp);
      }
  ```

- [ ] **Step 2: Run typecheck**
  Run: `cd frontend && bunx tsc --noEmit`
  Expected: Clean compilation with 0 errors.

- [ ] **Step 3: Run tests**
  Run: `cd frontend && bun run test`
  Expected: All 11 tests pass.

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add frontend/hooks/appState/usePhotoSorting.ts
  git commit -m "perf: optimize sorting loop with precomputed timestamps"
  ```

---

### Task 3: Downgrade GlassMaterial Backdrop Filter Blurs

**Files:**
- Modify: [GlassMaterial.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/GlassMaterial.tsx)

**Interfaces:**
- Consumes: `intensity` prop.
- Produces: Optimized `backdropFilter` css rules applied to layout containers.

- [ ] **Step 1: Reduce backdrop-filter blur levels**
  Modify lines 41 to 53 in `frontend/components/GlassMaterial.tsx` to lower the backdrop filter values:
  ```typescript
    // Intensity mappings (Reduced blurs for WebView/Tauri performance optimization)
    const blurValue = {
      subtle: 'blur(4px)',
      regular: 'blur(12px)',
      prominent: 'blur(16px)',
    }[intensity];
  ```

- [ ] **Step 2: Run production build validation**
  Run: `cd frontend && bun run build`
  Expected: Build completes successfully.

- [ ] **Step 3: Run tests**
  Run: `cd frontend && bun run test`
  Expected: All 11 tests pass.

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add frontend/components/GlassMaterial.tsx
  git commit -m "perf: optimize GlassMaterial blur intensities for WebView rendering"
  ```
