/// <reference types="vite/client" />
const DEFAULT_API_BASE = 'http://127.0.0.1:8269';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('prism_server_url');
    if (saved && saved.trim().length > 0) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return (import.meta.env.VITE_API_BASE as string) || DEFAULT_API_BASE;
};

export const setApiBase = (url: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cleaned = url.trim().replace(/\/+$/, '');
    localStorage.setItem('prism_server_url', cleaned);
  }
};

export const API_BASE = {
  toString: () => getApiBase(),
  valueOf: () => getApiBase(),
  concat: (str: string) => getApiBase() + str,
  startsWith: (str: string) => getApiBase().startsWith(str),
  replace: (pattern: string | RegExp, replacement: string) => (getApiBase() as any).replace(pattern, replacement),
  includes: (str: string) => getApiBase().includes(str),
  length: 0,
} as unknown as string;

export const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const currentBase = getApiBase();
  const [base, query] = url.split('?');
  let resolvedBase = base;

  if (base.startsWith('/thumbnails/') || base.startsWith('/uploads/') || base.startsWith('/crop_face/') || base.startsWith('/api/v1/')) {
    resolvedBase = `${currentBase}${base}`;
  } else if (base.startsWith('thumbnails/') || base.startsWith('uploads/') || base.startsWith('crop_face/') || base.startsWith('api/v1/')) {
    resolvedBase = `${currentBase}/${base}`;
  } else if (base.startsWith('upload_')) {
    resolvedBase = `${currentBase}/uploads/${base}`;
  } else if (base.startsWith('local://')) {
    const path = base.replace('local://', '');
    resolvedBase = `${currentBase}/local?path=${encodeURIComponent(path)}`;
  } else if (base.startsWith('transcode://')) {
    const path = base.replace('transcode://', '');
    resolvedBase = `${currentBase}/transcode?path=${encodeURIComponent(path)}`;
  } else if (base.startsWith('hls://')) {
    const path = base.replace('hls://', '');
    resolvedBase = `${currentBase}/hls/playlist?path=${encodeURIComponent(path)}`;
  } else if (base.startsWith('/') || base.match(/^[a-zA-Z]:\\/)) {
    resolvedBase = `${currentBase}/local?path=${encodeURIComponent(base)}`;
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
  return `${getApiBase()}/api/v1/photos/${key}/thumbnail${sizeParam}`;
};
