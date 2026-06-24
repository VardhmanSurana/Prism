import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { resolveUrl } from '../../constants';

interface FilePreviewProps {
  file: {
    name: string;
    path: string;
  };
  imgLoading: boolean;
  dimensions: { width: number; height: number } | null;
  onLoad: (width: number, height: number) => void;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, imgLoading, dimensions, onLoad, onClose }) => {
  const previewUrl = resolveUrl('local://' + file.path);

  return (
    <div className="flex flex-col h-full w-[380px] bg-[#0c0c0c] border-l border-white/5 p-4 overflow-y-auto custom-scrollbar shrink-0 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">File Preview</h4>
        <button
          onClick={onClose}
          className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5"
        >
          <X size={12} />
        </button>
      </div>

      <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
        {imgLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary/70" size={16} />
          </div>
        )}
        <img
          src={previewUrl}
          alt={file.name}
          onLoad={(e) => {
            const img = e.currentTarget;
            onLoad(img.naturalWidth, img.naturalHeight);
          }}
          className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
        />
      </div>

      <div className="mt-3 text-xs text-white/90 font-medium truncate text-center border-b border-white/5 pb-3" title={file.name}>
        {file.name}
      </div>
    </div>
  );
};
