import { Photo } from '../../types';
import { API_BASE } from '../../constants';

interface ImportProgressStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

interface UseImportProcessProps {
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: ImportProgressStatus) => void;
}

export const useImportProcess = ({ onUpload, onImportProgress }: UseImportProcessProps) => {
  const startImport = async (filePaths: string[]) => {
    const total = filePaths.length;
    let processed = 0;
    const uploadedPhotos: Photo[] = [];

    onImportProgress({
      is_scanning: true,
      total_files: total,
      processed_files: 0,
      progress: 0
    });

    for (const path of filePaths) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/photos/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: path }),
        });

        if (response.ok) {
          const p = await response.json();
          if (p && p.id) {
             const normalized = {
               ...p,
               isFavorite: p.is_favorite ?? p.isFavorite,
               isArchived: p.is_archived ?? p.isArchived,
               isLocked: p.is_locked ?? p.isLocked,
               isTrash: p.is_trash ?? p.isTrash,
               uploadDate: p.upload_date ?? p.uploadDate
             };
             uploadedPhotos.push(normalized);
          }
        }
      } catch (e) {
        console.error('[IMPORT LOOP] Failed to import:', path, e);
      } finally {
        processed++;
        const currentProgress = Math.round((processed / total) * 100);
        onImportProgress({
          is_scanning: true,
          total_files: total,
          processed_files: processed,
          progress: currentProgress
        });
      }
    }

    setTimeout(() => {
      onImportProgress({ is_scanning: false, total_files: 0, processed_files: 0, progress: 0 });
    }, 2000);

    if (uploadedPhotos.length > 0) {
      onUpload(uploadedPhotos);
    }
  };

  return {
    startImport
  };
};
