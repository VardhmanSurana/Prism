import React, { useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { resolveUrl } from '../../constants';

interface FilePreviewProps {
  file: {
    name: string;
    path: string;
    is_video?: boolean;
  };
  imgLoading: boolean;
  dimensions: { width: number; height: number } | null;
  onLoad: (width: number, height: number) => void;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, imgLoading, dimensions, onLoad, onClose }) => {
  const previewUrl = resolveUrl('local://' + file.path);
  const isVideo = file.is_video || /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i.test(file.name);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    v.pause();
    v.currentTime = 0;
  }, []);

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

      <div
        className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center"
        onMouseEnter={isVideo ? handleMouseEnter : undefined}
        onMouseLeave={isVideo ? handleMouseLeave : undefined}
      >
        {imgLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-primary/70" size={16} />
          </div>
        )}
        {isVideo ? (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            loop
            preload="metadata"
            playsInline
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              onLoad(video.videoWidth, video.videoHeight);
            }}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        ) : (
          <img
            src={previewUrl}
            alt={file.name}
            onLoad={(e) => {
              const img = e.currentTarget;
              onLoad(img.naturalWidth, img.naturalHeight);
            }}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        {isVideo && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
            <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[9px] font-mono px-1.5 py-0.5 rounded">
              Hover to preview
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-white/90 font-medium truncate text-center border-b border-white/5 pb-3" title={file.name}>
        {file.name}
      </div>
    </div>
  );
};
