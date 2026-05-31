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
    console.log("[IMPORT START] Total paths to import:", filePaths.length, filePaths);
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
        console.log("[IMPORT LOOP] Processing path:", path);
        const response = await fetch(`${API_BASE}/api/v1/photos/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: path }),
        });

        console.log("[IMPORT LOOP] Response status for path:", path, response.status);
        if (response.ok) {
          const p = await response.json();
          console.log("[IMPORT LOOP] Parsed JSON response for path:", path, p);
          if (p && p.id) {
             const normalized = {
               ...p,
               isFavorite: p.is_favorite ?? p.isFavorite,
               isArchived: p.is_archived ?? p.isArchived,
               isLocked: p.is_locked ?? p.isLocked,
               isTrash: p.is_trash ?? p.isTrash,
               uploadDate: p.upload_date ?? p.uploadDate
             };
             console.log("[IMPORT LOOP] Normalized object:", normalized);
             uploadedPhotos.push(normalized);
          }
        } else {
          try {
            const error = await response.json();
            console.warn('[IMPORT LOOP] Import skipped:', path, error.detail);
          } catch {
            console.warn('[IMPORT LOOP] Import failed with status:', response.status, path);
          }
        }
      } catch (e) {
        console.error('[IMPORT LOOP] Failed to import:', path, e);
      } finally {
        processed++;
        const currentProgress = Math.round((processed / total) * 100);
        console.log(`[IMPORT LOOP] Finally block. Processed: ${processed}/${total}. Progress: ${currentProgress}%`);
        onImportProgress({
          is_scanning: true,
          total_files: total,
          processed_files: processed,
          progress: currentProgress
        });
      }
    }

    console.log("[IMPORT END] Import loop completed. Uploaded count:", uploadedPhotos.length);
    setTimeout(() => {
      console.log("[IMPORT END] Clearing import progress state.");
      onImportProgress({ is_scanning: false, total_files: 0, processed_files: 0, progress: 0 });
    }, 2000);

    if (uploadedPhotos.length > 0) {
      console.log("[IMPORT END] Updating photos grid with new photos:", uploadedPhotos);
      onUpload(uploadedPhotos);
    }
  };

  return {
    startImport
  };
};
