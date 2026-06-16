import { useState } from 'react';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';

interface UseFolderManagementProps {
  watchedFolders: string[];
  onWatchedFoldersChange: (folders: string[]) => void;
  excludedFolders: string[];
  onExcludedFoldersChange: (folders: string[]) => void;
}

export const useFolderManagement = ({
  watchedFolders,
  onWatchedFoldersChange,
  excludedFolders,
  onExcludedFoldersChange
}: UseFolderManagementProps) => {
  const [watchedInput, setWatchedInput] = useState('');
  const [excludedInput, setExcludedInput] = useState('');

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

  const handleAddWatchedFolder = () => {
    if (watchedInput && !watchedFolders.includes(watchedInput)) {
      const newFolders = [...watchedFolders, watchedInput];
      onWatchedFoldersChange(newFolders);
      setWatchedInput('');
    }
  };

  const handleRemoveWatchedFolder = (folder: string) => {
    const newFolders = watchedFolders.filter(f => f !== folder);
    onWatchedFoldersChange(newFolders);
  };

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

  const handleAddExcludedFolder = () => {
    if (excludedInput && !excludedFolders.includes(excludedInput)) {
      const newFolders = [...excludedFolders, excludedInput];
      onExcludedFoldersChange(newFolders);
      setExcludedInput('');
    }
  };

  const handleRemoveExcludedFolder = (folder: string) => {
    const newFolders = excludedFolders.filter(f => f !== folder);
    onExcludedFoldersChange(newFolders);
  };

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
