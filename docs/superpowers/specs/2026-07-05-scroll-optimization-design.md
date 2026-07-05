# Scroll & Render Performance Optimization Design

Optimizes the scrolling behavior and thumbnail rendering inside the Tauri system WebViews for Prism.

## Goal Description
Users experience choppy scrolling and stutter in the media grid. This is caused by a combination of:
1. Redundant concurrent page-fetching API requests when scrolling past the threshold.
2. Layout thrashing from checking DOM heights/scroll positions on every single scroll frame.
3. Synchronous image decoding blocking the main thread during fast scrolling.
4. Rendering grid items on the CPU instead of utilizing the GPU.

This design implements solutions for all four problems.

## Proposed Changes

### Frontend Component & Styling Changes

#### [MODIFY] [usePhotoSorting.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/hooks/appState/usePhotoSorting.ts)
Throttles the scroll event check with `requestAnimationFrame` to ensure layout queries run at most once per frame.

```typescript
  const isScrollingRef = useRef(false);
  const handleScroll = useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          if (scrollTop + clientHeight >= scrollHeight - 500) {
            onFetchPhotos();
          }
        }
        isScrollingRef.current = false;
      });
    }
  }, [onFetchPhotos]);
```

#### [MODIFY] [usePhotos.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/hooks/usePhotos.ts)
Adds a `fetchingRef` guard to block concurrent/duplicate fetches for the same offset page during active infinite scrolls.

```typescript
  const fetchingRef = useRef(false);

  const fetchPhotos = useCallback(async (reset = false) => {
    if (fetchingRef.current && !reset) return;
    if (!hasMoreRef.current && !reset) return;

    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const currentOffset = reset ? 0 : offsetRef.current;
      const response = await fetchWithRetry(`${API_BASE}/api/v1/photos/?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      // ... same processing logic ...
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);
```

#### [MODIFY] [LazyImage.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/LazyImage.tsx)
Adds `decoding="async"` to the thumbnail `<img>` elements to tell the browser engine to decode webp images off the main thread.

```typescript
        <img
          ref={imgRef}
          src={displayUrl}
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          alt={alt}
          decoding="async"
          className={`${className} transition-opacity duration-500 ease-out 
            ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
```

#### [MODIFY] [index.css](file:///home/chotaxdon/Work/Projects/Prism/frontend/index.css)
Promotes `.photo-item-hover` elements to their own GPU layers to prevent layout reflows and redraw stutters.

```css
.photo-item-hover {
  transform: translate3d(0, 0, 0);
  will-change: transform;
}
```

---

## Verification Plan

### Automated Tests
Verify that the frontend builds and typechecks cleanly:
- Typecheck: `cd frontend && bunx tsc --noEmit`
- Tests: `cd frontend && bun test`
- Build: `cd frontend && bun run build`

### Manual Verification
- Scroll rapidly through the grid in Tauri to check that the scrolling is butter-smooth.
- Confirm in DevTools Network tab that no duplicate API requests are made for the same offset.
