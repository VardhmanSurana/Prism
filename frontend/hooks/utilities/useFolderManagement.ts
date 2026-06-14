import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

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

  const openBrowseDialog = async (title: string): Promise<string | null> => {
    try {
      const selected = await open({ directory: true, multiple: false, title });
      return typeof selected === 'string' ? selected : null;
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
    const selected = await openBrowseDialog('Select Library Folder to Watch');
    if (selected) setWatchedInput(selected);
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
    const selected = await openBrowseDialog('Select Folder to Exclude');
    if (selected) setExcludedInput(selected);
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
