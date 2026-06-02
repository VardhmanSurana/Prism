import { API_BASE } from '../../constants';

interface ImportProgressStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

interface UseDirectoryExpansionProps {
  onImportProgress: (status: ImportProgressStatus) => void;
}

export const useDirectoryExpansion = ({ onImportProgress }: UseDirectoryExpansionProps) => {
  const expandDirectories = async (paths: string[]): Promise<string[]> => {
    const allFiles: string[] = [];
    
    onImportProgress({
      is_scanning: true,
      total_files: paths.length * 10,
      processed_files: 0,
      progress: 0
    });
    
    for (const dir of paths) {
       try {
           const res = await fetch(`${API_BASE}/api/v1/photos/expand-directory`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ file_path: dir }),
           });
           const data = await res.json();
           if (data.files && data.files.length > 0) {
               allFiles.push(...data.files);
           }
       } catch (e) {
           console.error('Failed to expand directory:', dir, e);
       }
    }
    
    return allFiles;
  };

  return {
    expandDirectories
  };
};
