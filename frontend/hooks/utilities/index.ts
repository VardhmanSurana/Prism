export { useSyncConfig } from './useSyncConfig';
export { useFolderManagement } from './useFolderManagement';
export { usePurgeOperations } from './usePurgeOperations';
export { useLibraryOperations } from './useLibraryOperations';
export { useConfirmDialog } from './useConfirmDialog';

// Re-export the main hook for backward compatibility
import { useSyncConfig } from './useSyncConfig';
import { useFolderManagement } from './useFolderManagement';
import { usePurgeOperations } from './usePurgeOperations';
import { useLibraryOperations } from './useLibraryOperations';
import { useConfirmDialog } from './useConfirmDialog';

export const useUtilities = () => {
  const { 
    syncEnabled, 
    excludedFolders, 
    isLoading, 
    setExcludedFolders, 
    handleToggleSync 
  } = useSyncConfig();

  const { confirmDialog, setConfirmDialog, openConfirmDialog, closeConfirmDialog } = useConfirmDialog();

  const {
    folderInput,
    setFolderInput,
    handleAddFolder,
    handleRemoveFolder,
    handleBrowse,
    openBrowseDialog
  } = useFolderManagement({ excludedFolders, onFoldersChange: setExcludedFolders });

  const {
    purgeInput,
    setPurgeInput,
    purgeStatus,
    handlePurgeBrowse,
    handlePurgeFolder
  } = usePurgeOperations({ openBrowseDialog });

  const {
    isResetting,
    systemStatus,
    handleResetLibrary,
    handleTriggerFaceSync,
    setSystemStatus
  } = useLibraryOperations({ onConfirm: openConfirmDialog });

  return {
    syncEnabled,
    excludedFolders,
    folderInput,
    setFolderInput,
    purgeInput,
    setPurgeInput,
    purgeStatus,
    isResetting,
    systemStatus,
    confirmDialog,
    setConfirmDialog,
    handleToggleSync,
    handleAddFolder,
    handleRemoveFolder,
    handleBrowse,
    handlePurgeBrowse,
    handlePurgeFolder,
    handleResetLibrary,
    handleTriggerFaceSync
  };
};
