import { Photo } from '../../types';

export interface Person {
  id: number;
  name: string;
  cover_face_thumbnail: string;
  photo_count: number;
}

export interface PeopleViewProps {
  onPhotoClick: (photo: Photo) => void;
  onPhotosLoaded?: (photos: Photo[]) => void;
}
