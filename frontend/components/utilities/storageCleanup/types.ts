import { Photo } from '../../../types';

export type CleanupTab = 'blurry' | 'duplicates' | 'documents';

export interface BlurryPhoto {
  id: number;
  url: string;
  filename: string;
  blur_score: number;
}

export interface DuplicateCluster {
  key: string;
  photo_count: number;
  photos: Array<{
    id: number;
    url: string;
    filename: string;
  }>;
}

export interface StorageCleanupState {
  activeSubTab: CleanupTab;
  blurryPhotos: BlurryPhoto[];
  duplicateClusters: DuplicateCluster[];
  documentPhotos: Photo[];
  isLoading: boolean;
}

export interface PhotoCardProps {
  photo: {
    id: number;
    url: string;
    filename: string;
    blur_score?: number;
    ai_summary?: string;
  };
  onDelete: (id: number) => void;
  variant: 'blurry' | 'duplicate' | 'document';
}

export interface TabContentProps {
  isLoading: boolean;
  data: any;
  onDelete: (id: number) => void;
}
