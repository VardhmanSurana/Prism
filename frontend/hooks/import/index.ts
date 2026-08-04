export { useFileSelection } from './useFileSelection';
export { useImportProcess } from './useImportProcess';
export { useDirectoryExpansion } from './useDirectoryExpansion';
export { useDragDropImport } from './useDragDropImport';
export {
  resolveDroppedPaths,
  isImportableMediaPath,
  isTauriRuntime,
  IMPORTABLE_EXTENSIONS,
} from './importPaths';
export type { DragDropPhase } from './useDragDropImport';

// Re-export the main hook for backward compatibility
import { useFileSelection } from './useFileSelection';
import { useImportProcess } from './useImportProcess';
import { useDirectoryExpansion } from './useDirectoryExpansion';
import { resolveDroppedPaths } from './importPaths';
import { Photo } from '../../types';

interface ImportProgressStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

interface UseImportProps {
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: ImportProgressStatus) => void;
}

export const useImport = ({ onUpload, onImportProgress }: UseImportProps) => {
  const { handleFileUpload, handleFolderSelection } = useFileSelection();
  const { startImport } = useImportProcess({ onUpload, onImportProgress });
  const { expandDirectories } = useDirectoryExpansion({ onImportProgress });

  const handleFileUploadWithImport = async () => {
    const result = await handleFileUpload();
    if (!result || result.paths.length === 0) return;
    await startImport(result.paths, result.resizeWidth);
  };

  const handleFolderImport = async () => {
    const result = await handleFolderSelection();
    if (!result || result.paths.length === 0) {
      onImportProgress({ is_scanning: false, total_files: 0, processed_files: 0, progress: 0 });
      return;
    }

    const allFiles = await expandDirectories(result.paths);

    if (allFiles.length > 0) {
      await startImport(allFiles, result.resizeWidth);
    } else {
      onImportProgress({ is_scanning: false, total_files: 0, processed_files: 0, progress: 0 });
      alert('No supported images found in the selected folders.');
    }
  };

  /** Import from absolute OS paths (drag-and-drop, CLI, etc.) */
  const importPaths = async (paths: string[], resizeWidth?: number) => {
    if (!paths.length) return;
    const files = await resolveDroppedPaths(paths, onImportProgress);
    if (files.length === 0) {
      onImportProgress({ is_scanning: false, total_files: 0, processed_files: 0, progress: 0 });
      alert('No supported images or videos found.');
      return;
    }
    await startImport(files, resizeWidth);
  };

  return {
    handleFileUpload: handleFileUploadWithImport,
    handleFolderImport,
    importPaths,
    startImport,
  };
};
