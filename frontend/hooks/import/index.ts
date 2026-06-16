export { useFileSelection } from './useFileSelection';
export { useImportProcess } from './useImportProcess';
export { useDirectoryExpansion } from './useDirectoryExpansion';

// Re-export the main hook for backward compatibility
import { useFileSelection } from './useFileSelection';
import { useImportProcess } from './useImportProcess';
import { useDirectoryExpansion } from './useDirectoryExpansion';
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
        alert("No supported images found in the selected folders.");
    }
  };

  return {
    handleFileUpload: handleFileUploadWithImport,
    handleFolderImport
  };
};
