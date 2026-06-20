/// <reference types="vite/client" />
export const DEFAULT_API_BASE = 'http://127.0.0.1:8269';
export const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

export const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('/thumbnails/') || url.startsWith('/uploads/') || url.startsWith('/crop_face/') || url.startsWith('/api/v1/')) {
    return `${API_BASE}${url}`;
  }
  if (url.startsWith('thumbnails/') || url.startsWith('uploads/') || url.startsWith('crop_face/') || url.startsWith('api/v1/')) {
    return `${API_BASE}/${url}`;
  }
  if (url.startsWith('local://')) {
    const path = url.replace('local://', '');
    return `${API_BASE}/local?path=${encodeURIComponent(path)}`;
  }
  return url;
};
