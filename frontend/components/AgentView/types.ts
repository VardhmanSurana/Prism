import { Photo } from '../../types';

export interface Message {
  role: 'assistant' | 'user';
  content: string;
  photos?: Photo[];
  plan?: any;
  tools?: any[];
  totalCandidates?: number | null;
  attachedImage?: { url: string; path: string };
}

export interface SessionItem {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentDiagnosticsProps {
  plan: any;
  tools: any[];
  totalCandidates: number | null;
  isStreaming?: boolean;
}

export interface AgentViewProps {
  onPhotoClick: (photo: Photo) => void;
}

export interface Suggestion {
  text: string;
  icon: string;
}

export interface InlinePhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onShowMore: () => void;
}

export interface GalleryDrawerProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
  onPhotoClick: (photo: Photo) => void;
  onClear?: () => void;
  onCreateAlbum?: () => void;
  onAskAboutPhoto?: (photo: Photo) => void;
}