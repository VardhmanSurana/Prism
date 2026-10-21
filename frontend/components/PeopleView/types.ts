import { Photo } from '../../types';

export interface Person {
  id: number;
  uuid?: string;
  name: string;
  cover_face_thumbnail: string;
  photo_count: number;
  video_count?: number;
  years_span?: string;
  primary_location?: string;
  is_favorite?: boolean;
  category?: 'family' | 'studio' | 'favorites' | 'uncategorized';
}

export interface PeopleViewProps {
  onPhotoClick: (photo: Photo) => void;
  onPhotosLoaded?: (photos: Photo[]) => void;
}
