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
      console.log("[FILE UPLOAD] Opening file selection dialog...");
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']
        }]
      });

      const paths = extractPaths(selected);
      console.log("[FILE UPLOAD] Selected paths:", paths);
      if (paths.length === 0) {
        console.warn("[FILE UPLOAD] File selection cancelled or empty.");
      }
      return paths;
    } catch (e) {
      console.error('Tauri open dialog failed', e);
      return [];
    }
  };

  const handleFolderSelection = async (): Promise<string[]> => {
    try {
      console.log("[FOLDER IMPORT] Opening folder selection dialog...");
      const selected = await open({
        multiple: true,
        directory: true,
      });

      const paths = extractPaths(selected);
      console.log("[FOLDER IMPORT] Selected paths:", paths);
      if (paths.length === 0) {
        console.warn("[FOLDER IMPORT] Folder selection cancelled or empty.");
      }
      return paths;
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
