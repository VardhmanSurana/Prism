/// <reference types="vite/client" />
export const DEFAULT_API_BASE = 'http://127.0.0.1:8269';
export const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

export const resolveUrl = (url: string) => {
  if (!url) return '';
  const [base, query] = url.split('?');
  let resolvedBase = base;

  if (base.startsWith('/thumbnails/') || base.startsWith('/uploads/') || base.startsWith('/crop_face/') || base.startsWith('/api/v1/')) {
    resolvedBase = `${API_BASE}${base}`;
  } else if (base.startsWith('thumbnails/') || base.startsWith('uploads/') || base.startsWith('crop_face/') || base.startsWith('api/v1/')) {
    resolvedBase = `${API_BASE}/${base}`;
  } else if (base.startsWith('local://')) {
    const path = base.replace('local://', '');
    resolvedBase = `${API_BASE}/local?path=${encodeURIComponent(path)}`;
  } else if (base.startsWith('transcode://')) {
    const path = base.replace('transcode://', '');
    resolvedBase = `${API_BASE}/transcode?path=${encodeURIComponent(path)}`;
  } else if (base.startsWith('hls://')) {
    const path = base.replace('hls://', '');
    resolvedBase = `${API_BASE}/hls/playlist?path=${encodeURIComponent(path)}`;
  }

  if (query) {
    const separator = resolvedBase.includes('?') ? '&' : '?';
    return `${resolvedBase}${separator}${query}`;
  }
  return resolvedBase;
};

/**
 * Resolve a Photo object's display URL.
 * Many explore-API endpoints return raw Photo rows where `url` is null.
 * This helper falls back to the thumbnail endpoint using uuid or id.
 * @param size - Optional thumbnail size (default 400, max 2048)
 */
export const photoSrc = (photo: { url?: string | null; uuid?: string; id?: string | number }, size?: number): string => {
  if (photo.url && photo.url.trim().length > 0) {
    const resolved = resolveUrl(photo.url);
    if (size && size > 400) {
      const separator = resolved.includes('?') ? '&' : '?';
      return `${resolved}${separator}size=${size}`;
    }
    return resolved;
  }
  const key = photo.uuid || photo.id;
  if (!key) return '';
  const sizeParam = size && size > 400 ? `?size=${size}` : '';
  return `${API_BASE}/api/v1/photos/${key}/thumbnail${sizeParam}`;
};
