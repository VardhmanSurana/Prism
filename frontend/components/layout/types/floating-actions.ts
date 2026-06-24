export interface ImportStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

export interface FloatingActionsProps {
  importStatus: ImportStatus;
  syncStatus: ImportStatus;
}
