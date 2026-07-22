import React, { useState } from 'react';
import { Columns2, Grid2X2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Photo } from '@/types';
import { API_BASE } from '@/constants';
import { ImageDisplay } from './ImageDisplay';

interface ComparisonViewProps {
  currentPhoto: Photo;
  photos?: Photo[];
  onClose: () => void;
  onSelectPhoto: (photo: Photo) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  currentPhoto,
  photos = [],
  onClose,
  onSelectPhoto,
}) => {
  const [layout, setLayout] = useState<'2-up' | '4-up'>('2-up');
  const [zoomScale, setZoomScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Select candidate comparison photos from surrounding list
  const currentIdx = photos.findIndex(p => String(p.id) === String(currentPhoto.id));
  const candidatePhotos = photos.length > 1 ? photos : [currentPhoto];

  // Pick items for 2-up or 4-up grid
  const comparisonItems = layout === '2-up'
    ? [
        candidatePhotos[currentIdx] || currentPhoto,
        candidatePhotos[(currentIdx + 1) % candidatePhotos.length] || currentPhoto,
      ]
    : [
        candidatePhotos[currentIdx] || currentPhoto,
        candidatePhotos[(currentIdx + 1) % candidatePhotos.length] || currentPhoto,
        candidatePhotos[(currentIdx + 2) % candidatePhotos.length] || currentPhoto,
        candidatePhotos[(currentIdx + 3) % candidatePhotos.length] || currentPhoto,
      ];

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => {
    setZoomScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="absolute inset-0 z-40 bg-[#0D0F14] flex flex-col overflow-hidden">
      {/* Top Comparison Toolbar */}
      <div className="shrink-0 px-6 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Side-by-Side Comparison</span>
          <span className="text-xs text-gray-400 font-mono">
            {layout === '2-up' ? '2 Photos Split' : '4 Photos Grid'} • Synced Zoom ({Math.round(zoomScale * 100)}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => setLayout('2-up')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                layout === '2-up' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns2 size={14} />
              <span>2-Up</span>
            </button>
            <button
              onClick={() => setLayout('4-up')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                layout === '4-up' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid2X2 size={14} />
              <span>4-Up</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-white/10 mx-1" />

          <button onClick={handleZoomIn} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
            <ZoomIn size={15} />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
            <ZoomOut size={15} />
          </button>
          <button onClick={handleResetZoom} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
            <RotateCcw size={15} />
          </button>

          <div className="h-4 w-[1px] bg-white/10 mx-1" />

          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Synchronized Comparison Grid */}
      <div className={`flex-1 grid gap-2 p-4 overflow-hidden ${layout === '2-up' ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {comparisonItems.map((photo, i) => (
          <div
            key={`${photo.id}-${i}`}
            className="relative flex flex-col rounded-xl overflow-hidden bg-black/40 border border-white/10 hover:border-primary/50 transition-all group"
            onClick={() => onSelectPhoto(photo)}
          >
            {/* Synchronized Image Container */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <ImageDisplay
                photo={photo}
                zoomScale={zoomScale}
                offset={offset}
                isDragging={false}
                highResStatus="loaded"
                currentHighResUrl={photo.url || `${API_BASE}/api/v1/photos/${photo.id}/file`}
              />
            </div>

            {/* Photo Metadata Footer Badge */}
            <div className="shrink-0 p-2.5 bg-black/70 backdrop-blur-md border-t border-white/10 flex items-center justify-between text-xs text-gray-300">
              <span className="truncate font-mono">{photo.filename}</span>
              <span className="text-[11px] text-gray-400">
                {photo.width} × {photo.height}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
