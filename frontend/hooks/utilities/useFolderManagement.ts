import { useState } from 'react';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';

interface UseFolderManagementProps {
  watchedFolders: string[];
  onWatchedFoldersChange: (folders: string[]) => void;
  excludedFolders: string[];
  onExcludedFoldersChange: (folders: string[]) => void;
}

/**
 * useFolderManagement - Hook managing folder management.
 */
export const useFolderManagement = ({
  watchedFolders,
  onWatchedFoldersChange,
  excludedFolders,
  onExcludedFoldersChange
}: UseFolderManagementProps) => {
  const [watchedInput, setWatchedInput] = useState('');
  const [excludedInput, setExcludedInput] = useState('');

  /**
   * openBrowseDialog - Performs open browse dialog.
   */
  const openBrowseDialog = async (title: string, multiple = false): Promise<string[] | null> => {
    try {
      const result = await openFileFolderBrowser({
        title,
        directoryOnly: true,
        multiple
      });
      return result ? result.paths : null;
    } catch (e) { /* fallthrough */ }
    return null;
  };

  /**
   * handleAddWatchedFolder - Handles add watched folder.
   */
  const handleAddWatchedFolder = () => {
    if (watchedInput && !watchedFolders.includes(watchedInput)) {
      const newFolders = [...watchedFolders, watchedInput];
      onWatchedFoldersChange(newFolders);
      setWatchedInput('');
    }
  };

  /**
   * handleRemoveWatchedFolder - Handles remove watched folder.
   */
  const handleRemoveWatchedFolder = (folder: string) => {
    /**
     * newFolders - Performs new folders.
     */
    const newFolders = watchedFolders.filter(f => f !== folder);
    onWatchedFoldersChange(newFolders);
  };

  /**
   * handleBrowseWatched - Handles browse watched.
   */
  const handleBrowseWatched = async () => {
    const selected = await openBrowseDialog('Select Library Folder(s) to Watch', true);
    if (selected && selected.length > 0) {
      const newFolders = [...watchedFolders];
      selected.forEach(folder => {
        if (!newFolders.includes(folder)) {
          newFolders.push(folder);
        }
      });
      onWatchedFoldersChange(newFolders);
      // Populate input with the first selected folder just as visual feedback
      setWatchedInput(selected[0]);
    }
  };

  /**
   * handleAddExcludedFolder - Handles add excluded folder.
   */
  const handleAddExcludedFolder = () => {
    if (excludedInput && !excludedFolders.includes(excludedInput)) {
      const newFolders = [...excludedFolders, excludedInput];
      onExcludedFoldersChange(newFolders);
      setExcludedInput('');
    }
  };

  /**
   * handleRemoveExcludedFolder - Handles remove excluded folder.
   */
  const handleRemoveExcludedFolder = (folder: string) => {
    /**
     * newFolders - Performs new folders.
     */
    const newFolders = excludedFolders.filter(f => f !== folder);
    onExcludedFoldersChange(newFolders);
  };

  /**
   * handleBrowseExcluded - Handles browse excluded.
   */
  const handleBrowseExcluded = async () => {
    const selected = await openBrowseDialog('Select Folder(s) to Exclude', true);
    if (selected && selected.length > 0) {
      const newFolders = [...excludedFolders];
      selected.forEach(folder => {
        if (!newFolders.includes(folder)) {
          newFolders.push(folder);
        }
      });
      onExcludedFoldersChange(newFolders);
      setExcludedInput(selected[0]);
    }
  };

  return {
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
  };
};
