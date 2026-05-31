export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('/thumbnails/') || url.startsWith('/uploads/') || url.startsWith('/crop_face/')) {
    return `${API_BASE}${url}`;
  }
  if (url.startsWith('thumbnails/') || url.startsWith('uploads/') || url.startsWith('crop_face/')) {
    return `${API_BASE}/${url}`;
  }
  if (url.startsWith('local://')) {
    const path = url.replace('local://', '');
    return `${API_BASE}/local?path=${encodeURIComponent(path)}`;
  }
  return url;
};
