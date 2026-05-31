import React, { useState, useRef, useEffect } from 'react';
import { Upload, ChevronDown, FileImage, FolderOpen } from 'lucide-react';

interface ImportButtonProps {
  onFileUpload: () => void;
  onFolderImport: () => void;
}

export const ImportButton: React.FC<ImportButtonProps> = ({ onFileUpload, onFolderImport }) => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setIsImportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={importMenuRef}>
      <button 
        onClick={() => setIsImportOpen(!isImportOpen)}
        className="flex items-center gap-2.5 px-6 py-2 bg-primary text-black rounded-full text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition-all active:scale-95 shadow-[0_0_20px_rgba(var(--color-primary),0.15)]"
      >
        <Upload size={14} />
        <span className="hidden sm:inline">Import</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isImportOpen ? 'rotate-180' : ''}`} />
      </button>

      {isImportOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl p-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => { onFileUpload(); setIsImportOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-surfaceHover rounded-lg transition-colors"
          >
            <FileImage size={16} className="text-primary" />
            <span>Import Files</span>
          </button>
          <button
            onClick={() => { onFolderImport(); setIsImportOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-surfaceHover rounded-lg transition-colors"
          >
            <FolderOpen size={16} className="text-emerald-500" />
            <span>Import Folder</span>
          </button>
        </div>
      )}
    </div>
  );
};
