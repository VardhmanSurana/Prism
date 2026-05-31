import { Photo } from '../../types';

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
  onPrev: () => void;
  onNext: () => void;
}
