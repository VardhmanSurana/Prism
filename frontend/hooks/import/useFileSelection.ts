import { openFileFolderBrowser, BrowseResult } from '../../services/FileFolderBrowserService';

export const useFileSelection = () => {
  const extractPaths = (selected: string | string[] | null): string[] => {
    if (!selected) return [];
    const items = Array.isArray(selected) ? selected : [selected];
    return items.map(item => {
      if (typeof item === 'string') return item;
      return String(item);
    });
  };

  const handleFileUpload = async (): Promise<BrowseResult | null> => {
    try {
      return await openFileFolderBrowser({
        title: 'Select Image File(s) to Upload',
        multiple: true,
        directoryOnly: false,
        allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']
      });
    } catch (e) {
      console.error('Custom file open dialog failed', e);
      return null;
    }
  };

  const handleFolderSelection = async (): Promise<BrowseResult | null> => {
    try {
      return await openFileFolderBrowser({
        title: 'Select Folder(s) to Scan',
        multiple: true,
        directoryOnly: true,
      });
    } catch (e) {
      console.error('Custom folder open dialog failed', e);
      return null;
    }
  };

  return {
    extractPaths,
    handleFileUpload,
    handleFolderSelection
  };
};
