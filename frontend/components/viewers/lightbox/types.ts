import { Photo } from '@/types';

export interface ImageDisplayProps {
  photo: Photo;
  zoomScale: number;
  offset: { x: number; y: number };
  isDragging: boolean;
  highResStatus: 'loading' | 'loaded' | 'error';
  currentHighResUrl: string | null;
}

export interface NavigationArrowsProps {
  zoomScale: number;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export interface FilmstripProps {
  photos: Photo[];
  currentPhotoId: string | number;
  onSelect: (photo: Photo) => void;
}

export interface ToolbarProps {
  photo: Photo;
  highResStatus: 'loading' | 'loaded' | 'error';
  zoomScale: number;
  showInfo: boolean;
  currentIndex: number;
  totalCount: number;
  onClose: () => void;
  onSetZoomScale: (scale: number) => void;
  onResetInteraction: () => void;
  onToggleShowInfo: () => void;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onTrash?: () => void;
  onRemoveFromAlbum?: () => void;
  onSetAsCover?: () => void;
}

export interface VideoPlayerProps {
  photo: Photo;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}
