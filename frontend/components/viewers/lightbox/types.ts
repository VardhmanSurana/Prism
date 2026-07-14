import { Photo } from '@/types';

export interface ImageDisplayProps {
  photo: Photo;
  zoomScale: number;
  offset: { x: number; y: number };
  isDragging: boolean;
  highResStatus: 'loading' | 'loaded' | 'error';
  currentHighResUrl: string | null;
  /** Apply Ken Burns slow zoom while slideshow is playing. */
  kenBurns?: boolean;
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
  slideshowActive?: boolean;
  canStartSlideshow?: boolean;
  onClose: () => void;
  onSetZoomScale: (scale: number) => void;
  onResetInteraction: () => void;
  onToggleShowInfo: () => void;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onTrash?: () => void;
  onRemoveFromAlbum?: () => void;
  onSetAsCover?: () => void;
  onStartSlideshow?: () => void;
}

export interface VideoPlayerProps {
  photo: Photo;
  onClose?: () => void;
  /** Auto-start playback when the video is ready (e.g. slideshow mode). */
  autoPlay?: boolean;
  /** Fired when the video reaches the end (used by slideshow to advance). */
  onEnded?: () => void;
  /** Hide player chrome for distraction-free slideshow viewing. */
  hideControls?: boolean;
}
