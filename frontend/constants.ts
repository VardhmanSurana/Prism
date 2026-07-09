/// <reference types="vite/client" />
const DEFAULT_API_BASE = 'http://127.0.0.1:8269';
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
