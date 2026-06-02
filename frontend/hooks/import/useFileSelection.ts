import { open } from '@tauri-apps/plugin-dialog';

export const useFileSelection = () => {
  const extractPaths = (selected: any): string[] => {
    if (!selected) return [];
    const items = Array.isArray(selected) ? selected : [selected];
    return items.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'path' in item) return item.path;
      return String(item);
    });
  };

  const handleFileUpload = async (): Promise<string[]> => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']
        }]
      });

      return extractPaths(selected);
    } catch (e) {
      console.error('Tauri open dialog failed', e);
      return [];
    }
  };

  const handleFolderSelection = async (): Promise<string[]> => {
    try {
      const selected = await open({
        multiple: true,
        directory: true,
      });

      return extractPaths(selected);
    } catch (e) {
      console.error('Tauri open dialog failed', e);
      return [];
    }
  };

  return {
    extractPaths,
    handleFileUpload,
    handleFolderSelection
  };
};
