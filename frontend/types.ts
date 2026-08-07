export interface Photo {
  id: string | number;
  uuid?: string;
  url: string;
  path: string;           // absolute filesystem path (used for local:// fallback)
  width: number;
  height: number;
  aspect_ratio?: number;
  date: string;           // ISO string (Creation Date / date_taken)
  dateTimestamp?: number;
  date_taken?: string;
  uploadDate?: string;    // camelCase alias used in App.tsx sorting
  uploadDateTimestamp?: number;
  upload_date?: string;   // snake_case as returned by backend
  location?: string;
  caption?: string;
  filename?: string;
  isFavorite: boolean;
  is_favorite?: boolean;
  isLocked?: boolean;
  is_locked?: boolean;
  isTrash?: boolean;
  is_trash?: boolean;
  type?: 'image' | 'video';
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  duration?: number;
  fps?: number;
  codec?: string;
  audio_codec?: string;
  pix_fmt?: string;
  color_range?: string;
  rotation?: number;

  animated_url?: string;
  ai_summary?: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  people?: { id: string | number; uuid?: string; name: string; cover_face_thumbnail: string }[];
  city?: string;
  state?: string;
  country?: string;
  exif_make?: string;
  exif_model?: string;
  exif_focal_length?: number;
  exif_iso?: number;
  hash?: string;
  search_explanation?: { score: number; matched: string[] };
}

interface AlbumMetadata {
  total_size?: number;
  date_range?: { start: string; end: string };
  location_count?: number;
  city?: string;
  state?: string;
  country?: string;
  year?: number;
  month?: number;
}

export interface Album {
  id: number | string;
  uuid?: string;
  name: string;
  type: 'places' | 'memories' | 'people' | 'custom' | 'smart';
  photo_count: number;
  cover_url?: string;
  metadata?: AlbumMetadata;
  is_smart?: boolean;
  smart_type?: 'screenshots' | 'documents' | 'places';
}

export interface SmartAlbum {
  id: string;
  uuid?: string;
  name: string;
  type: 'smart';
  smart_type: 'screenshots' | 'documents' | 'places';
  photo_count: number;
  cover_url?: string;
  metadata?: AlbumMetadata;
}

type AnyAlbum = Album | SmartAlbum;

interface Place {
  id: string;
  name: string;
  coverUrl: string;
  coordinates: { lat: number; lng: number };
}

export type ViewMode = 'gallery' | 'explore' | 'sharing' | 'albums' | 'favorites' | 'utilities' | 'appearance' | 'locked' | 'map' | 'trash' | 'people' | 'projects' | 'agent' | 'toolbox';

export type SortMode = 'newest' | 'oldest' | 'added';

export interface SearchFilters {
  query: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

export interface RawPhoto {
  id: string | number;
  uuid?: string;
  url?: string;
  path?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  date?: string;
  date_taken?: string;
  upload_date?: string;
  uploadDate?: string;
  isFavorite?: boolean;
  is_favorite?: boolean;
  isLocked?: boolean;
  is_locked?: boolean;
  isTrash?: boolean;
  is_trash?: boolean;
  type?: 'image' | 'video';
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  duration?: number;
  fps?: number;
  codec?: string;
  audio_codec?: string;
  rotation?: number;
  animated_url?: string;
  ai_summary?: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  people?: { id: string | number; uuid?: string; name: string; cover_face_thumbnail: string }[];
  city?: string;
  state?: string;
  country?: string;
  pix_fmt?: string;
  color_range?: string;
  exif_make?: string;
  exif_model?: string;
  exif_focal_length?: number;
  exif_iso?: number;
  hash?: string;
  search_explanation?: { score: number; matched: string[] };
}

function sanitizeDateString(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  let sanitized = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(sanitized)) {
    sanitized = sanitized.replace(' ', 'T');
    const dotIndex = sanitized.indexOf('.');
    if (dotIndex !== -1) {
      let endOfFraction = dotIndex + 1;
      while (endOfFraction < sanitized.length && /\d/.test(sanitized[endOfFraction])) {
        endOfFraction++;
      }
      const fraction = sanitized.substring(dotIndex + 1, endOfFraction);
      const ms = fraction.substring(0, 3).padEnd(3, '0');
      sanitized = sanitized.substring(0, dotIndex) + '.' + ms + sanitized.substring(endOfFraction);
    }
    if (!/[Zz]$/.test(sanitized) && !/[+-]\d{2}:?\d{2}$/.test(sanitized)) {
      sanitized += 'Z';
    }
  }
  return sanitized;
}

/**
 * Normalize photo data from backend to ensure both camelCase and snake_case fields exist.
 * This prevents inconsistencies when backend changes field naming.
 */
export function normalizePhoto(raw: RawPhoto): Photo {
  const photoKey = raw.uuid || raw.id;
  const isLocked = raw.is_locked ?? raw.isLocked ?? false;
  const fallbackUrl = raw.path
    ? (raw.path.startsWith('local://') ? raw.path : `local://${raw.path}`)
    : `/api/v1/photos/${photoKey}/thumbnail`;
  const resolvedUrl = isLocked
    ? `/api/v1/photos/${photoKey}/thumbnail`
    : (raw.url && raw.url.trim().length > 0 ? raw.url : fallbackUrl);
  const rawDate = raw.date || raw.date_taken || '';
  const sanitizedDate = sanitizeDateString(rawDate);
  const rawUploadDate = raw.upload_date ?? raw.uploadDate ?? rawDate;
  const sanitizedUploadDate = sanitizeDateString(rawUploadDate);

  const dateTimestamp = sanitizedDate ? new Date(sanitizedDate).getTime() : 0;
  const uploadDateTimestamp = sanitizedUploadDate ? new Date(sanitizedUploadDate).getTime() : dateTimestamp;

  return {
    ...raw,
    id: raw.id,
    uuid: raw.uuid,
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
    type: (raw.type === 'video' || raw.file_type === 'video' || raw.mime_type?.startsWith('video/') || (raw.path && ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.flv', '.wmv', '.3gp'].some(ext => raw.path!.toLowerCase().endsWith(ext)))) ? 'video' : 'image',
    mime_type: raw.mime_type,
    file_type: raw.file_type,
    file_size: raw.file_size,
    duration: raw.duration,
    fps: raw.fps,
    codec: raw.codec,
    audio_codec: raw.audio_codec,
    pix_fmt: raw.pix_fmt,
    color_range: raw.color_range,
    rotation: raw.rotation,
    animated_url: raw.animated_url,
    ai_summary: raw.ai_summary,
    latitude: raw.latitude,
    longitude: raw.longitude,
    summary: raw.summary,
    people: raw.people,
    city: raw.city,
    state: raw.state,
    country: raw.country,
    hash: raw.hash,
    search_explanation: raw.search_explanation,
  };
}
