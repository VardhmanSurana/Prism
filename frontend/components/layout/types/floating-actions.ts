import { Photo } from '../../../types';

interface ImportStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

export interface FloatingActionsProps {
  importStatus: ImportStatus;
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: ImportStatus) => void;
}
