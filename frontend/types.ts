export interface Photo {
  id: string | number;
  url: string;
  path: string;           // absolute filesystem path (used for local:// fallback)
  width: number;
  height: number;
  aspect_ratio?: number;
  date: string;           // ISO string (Creation Date / date_taken)
  date_taken?: string;
  uploadDate?: string;    // camelCase alias used in App.tsx sorting
  upload_date?: string;   // snake_case as returned by backend
  location?: string;
  caption?: string;
  filename?: string;
  isFavorite: boolean;
  is_favorite?: boolean;
  isArchived?: boolean;
  is_archived?: boolean;
  isLocked?: boolean;
  is_locked?: boolean;
  isTrash?: boolean;
  is_trash?: boolean;
  type?: 'image' | 'video';
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  ai_summary?: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  people?: { id: string | number; name: string; cover_face_thumbnail: string }[];
  city?: string;
  state?: string;
  country?: string;
  search_explanation?: { score: number; matched: string[] };
}

export interface AlbumMetadata {
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
  id: number;
  name: string;
  type: 'places' | 'memories' | 'people';
  photo_count: number;
  cover_url?: string;
  metadata?: AlbumMetadata;
}

export interface Place {
  id: string;
  name: string;
  coverUrl: string;
  coordinates: { lat: number; lng: number };
}

export type ViewMode = 'gallery' | 'explore' | 'sharing' | 'albums' | 'favorites' | 'archived' | 'utilities' | 'locked' | 'map' | 'trash' | 'people' | 'agent';

export type SortMode = 'newest' | 'oldest' | 'added';

export interface SearchFilters {
  query: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

export interface RawPhoto {
  id: string | number;
  url?: string;
  path?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  date?: string;
  date_taken?: string;
  upload_date?: string;
  uploadDate?: string;
  location?: string;
  caption?: string;
  filename?: string;
  is_favorite?: boolean;
  isFavorite?: boolean;
  is_archived?: boolean;
  isArchived?: boolean;
  is_locked?: boolean;
  isLocked?: boolean;
  is_trash?: boolean;
  isTrash?: boolean;
  type?: 'image' | 'video';
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  ai_summary?: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  people?: { id: string | number; name: string; cover_face_thumbnail: string }[];
  city?: string;
  state?: string;
  country?: string;
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
  const isLocked = raw.is_locked ?? raw.isLocked ?? false;
  const resolvedUrl = isLocked ? `/api/v1/photos/${raw.id}/thumbnail` : (raw.url || '');
  const rawDate = raw.date || raw.date_taken || '';
  const sanitizedDate = sanitizeDateString(rawDate);
  const rawUploadDate = raw.upload_date ?? raw.uploadDate ?? rawDate;
  const sanitizedUploadDate = sanitizeDateString(rawUploadDate);
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
    isArchived: raw.is_archived ?? raw.isArchived ?? false,
    isLocked: isLocked,
    isTrash: raw.is_trash ?? raw.isTrash ?? false,
    // Date fields
    uploadDate: sanitizedUploadDate,
    // Keep original fields for compatibility
    is_favorite: raw.is_favorite ?? raw.isFavorite ?? false,
    is_archived: raw.is_archived ?? raw.isArchived ?? false,
    is_locked: isLocked,
    is_trash: raw.is_trash ?? raw.isTrash ?? false,
    upload_date: sanitizedUploadDate,
  };
}