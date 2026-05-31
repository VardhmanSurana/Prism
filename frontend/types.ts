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
  latitude?: number;
  longitude?: number;
}

export interface Album {
  id: number;
  name: string;
  type: 'places' | 'memories' | 'people';
  photo_count: number;
  cover_url?: string;
  metadata?: any;
}

export interface Place {
  id: string;
  name: string;
  coverUrl: string;
  coordinates: { lat: number; lng: number };
}

export type ViewMode = 'photos' | 'explore' | 'sharing' | 'albums' | 'favorites' | 'archived' | 'utilities' | 'locked' | 'map' | 'trash' | 'people';

export type SortMode = 'newest' | 'oldest' | 'added';

export interface SearchFilters {
  query: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

/**
 * Normalize photo data from backend to ensure both camelCase and snake_case fields exist.
 * This prevents inconsistencies when backend changes field naming.
 */
export function normalizePhoto(raw: any): Photo {
  return {
    ...raw,
    // Boolean flags - prioritize snake_case from backend
    isFavorite: raw.is_favorite ?? raw.isFavorite ?? false,
    isArchived: raw.is_archived ?? raw.isArchived ?? false,
    isLocked: raw.is_locked ?? raw.isLocked ?? false,
    isTrash: raw.is_trash ?? raw.isTrash ?? false,
    // Date fields
    uploadDate: raw.upload_date ?? raw.uploadDate ?? raw.date,
    // Keep original fields for compatibility
    is_favorite: raw.is_favorite ?? raw.isFavorite ?? false,
    is_archived: raw.is_archived ?? raw.isArchived ?? false,
    is_locked: raw.is_locked ?? raw.isLocked ?? false,
    is_trash: raw.is_trash ?? raw.isTrash ?? false,
    upload_date: raw.upload_date ?? raw.uploadDate ?? raw.date,
  };
}