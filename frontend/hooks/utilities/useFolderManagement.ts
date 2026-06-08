import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

interface UseFolderManagementProps {
  excludedFolders: string[];
  onFoldersChange: (folders: string[]) => void;
}

export const useFolderManagement = ({ excludedFolders, onFoldersChange }: UseFolderManagementProps) => {
  const [folderInput, setFolderInput] = useState('');

  const handleAddFolder = () => {
    if (folderInput && !excludedFolders.includes(folderInput)) {
      const newFolders = [...excludedFolders, folderInput];
      onFoldersChange(newFolders);
      setFolderInput('');
    }
  };

  const handleRemoveFolder = (folder: string) => {
    const newFolders = excludedFolders.filter(f => f !== folder);
    onFoldersChange(newFolders);
  };

  const openBrowseDialog = async (title: string): Promise<string | null> => {
    try {
      const selected = await open({ directory: true, multiple: false, title });
      return typeof selected === 'string' ? selected : null;
    } catch (e) { /* fallthrough */ }
    return null;
  };

  const handleBrowse = async () => {
    const selected = await openBrowseDialog('Select Folder to Exclude');
    if (selected) setFolderInput(selected);
  };

  return {
    folderInput,
    setFolderInput,
    handleAddFolder,
    handleRemoveFolder,
    handleBrowse,
    openBrowseDialog
  };
};
