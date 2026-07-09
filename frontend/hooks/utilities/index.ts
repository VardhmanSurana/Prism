
// Re-export the main hook for backward compatibility
import { useSyncConfig } from './useSyncConfig';
import { useFolderManagement } from './useFolderManagement';
import { usePurgeOperations } from './usePurgeOperations';
import { useLibraryOperations } from './useLibraryOperations';
import { useConfirmDialog } from './useConfirmDialog';

export const useUtilities = ({ onResetSuccess }: { onResetSuccess?: () => void } = {}) => {
  const { 
    syncEnabled, 
    watchedFolders,
    excludedFolders, 
    isLoading, 
    setWatchedFolders,
    setExcludedFolders, 
    handleToggleSync 
  } = useSyncConfig();

  const { confirmDialog, setConfirmDialog, openConfirmDialog, closeConfirmDialog } = useConfirmDialog();

  const {
    watchedInput,
    setWatchedInput,
    handleAddWatchedFolder,
    handleRemoveWatchedFolder,
    handleBrowseWatched,
    excludedInput,
    setExcludedInput,
    handleAddExcludedFolder,
    handleRemoveExcludedFolder,
    handleBrowseExcluded,
    openBrowseDialog
  } = useFolderManagement({ 
    watchedFolders,
    onWatchedFoldersChange: setWatchedFolders,
    excludedFolders,
    onExcludedFoldersChange: setExcludedFolders
  });

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
  } = useLibraryOperations({ onConfirm: openConfirmDialog, onResetSuccess });

  return {
    syncEnabled,
    watchedFolders,
    excludedFolders,
    watchedInput,
    setWatchedInput,
    handleAddWatchedFolder,
    handleRemoveWatchedFolder,
    handleBrowseWatched,
    excludedInput,
    setExcludedInput,
    handleAddExcludedFolder,
    handleRemoveExcludedFolder,
    handleBrowseExcluded,
    // Backward compatibility:
    folderInput: excludedInput,
    setFolderInput: setExcludedInput,
    handleAddFolder: handleAddExcludedFolder,
    handleRemoveFolder: handleRemoveExcludedFolder,
    handleBrowse: handleBrowseExcluded,
    purgeInput,
    setPurgeInput,
    purgeStatus,
    isResetting,
    systemStatus,
    confirmDialog,
    setConfirmDialog,
    handleToggleSync,
    handlePurgeBrowse,
    handlePurgeFolder,
    handleResetLibrary,
    handleTriggerFaceSync
  };
};
