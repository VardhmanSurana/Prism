import { useState } from 'react';

export interface ImportStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

export function useImportStatus() {
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    is_scanning: false,
    total_files: 0,
    processed_files: 0,
    progress: 0
  });

  return {
    importStatus,
    setImportStatus
  };
}
