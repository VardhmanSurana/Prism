import { Photo, RawPhoto, normalizePhoto } from '../../types';
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
  const startImport = async (filePaths: string[], resizeWidth?: number) => {
    const total = filePaths.length;
    const counter = { processed: 0 };
    const uploadedPhotos: Photo[] = [];

    onImportProgress({
      is_scanning: true,
      total_files: total,
      processed_files: 0,
      progress: 0
    });

    const CONCURRENCY_LIMIT = 8;
    for (let i = 0; i < filePaths.length; i += CONCURRENCY_LIMIT) {
      const chunk = filePaths.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.allSettled(
        chunk.map(async (path) => {
          let attempts = 0;
          const MAX_ATTEMPTS = 3;
          let success = false;

          while (attempts < MAX_ATTEMPTS && !success) {
            try {
              const response = await fetch(`${API_BASE}/api/v1/photos/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: path, resize_width: resizeWidth }),
              });

              if (response.ok) {
                const p = await response.json() as RawPhoto;
                if (p && p.id) {
                  uploadedPhotos.push(normalizePhoto(p));
                }
                success = true;
              } else if (response.status === 429) {
                attempts++;
                const waitTime = Math.pow(2, attempts) * 1000;
                console.warn(`[IMPORT LOOP] Rate limited (429) for ${path}. Retrying in ${waitTime}ms (Attempt ${attempts}/${MAX_ATTEMPTS})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                console.error(`[IMPORT LOOP] Failed to import: ${path}. Status: ${response.status}`);
                break; // Don't retry other errors
              }
            } catch (e) {
              console.error('[IMPORT LOOP] Network error for:', path, e);
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          counter.processed++;
          const currentProgress = Math.round((counter.processed / total) * 100);
          onImportProgress({
            is_scanning: true,
            total_files: total,
            processed_files: counter.processed,
            progress: currentProgress
          });
        })
      );
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
