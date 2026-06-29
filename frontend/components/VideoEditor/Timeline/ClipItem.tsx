import React, { useCallback, useRef, useState } from 'react';
import { Clip } from '@/store/videoEditorStore';
import type { ClipProps } from '../types';

const TYPE_STYLES = {
  video: {
    bg: 'bg-blue-500/80',
    border: 'border-blue-400/50',
    hoverBg: 'hover:bg-blue-500/90',
    handleBg: 'bg-blue-700/60',
    selectedBg: 'bg-blue-400/20',
  },
  audio: {
    bg: 'bg-green-500/80',
    border: 'border-green-400/50',
    hoverBg: 'hover:bg-green-500/90',
    handleBg: 'bg-green-700/60',
    selectedBg: 'bg-green-400/20',
  },
  text: {
    bg: 'bg-purple-500/80',
    border: 'border-purple-400/50',
    hoverBg: 'hover:bg-purple-500/90',
    handleBg: 'bg-purple-700/60',
    selectedBg: 'bg-purple-400/20',
  },
  subtitle: {
    bg: 'bg-teal-500/80',
    border: 'border-teal-400/50',
    hoverBg: 'hover:bg-teal-500/90',
    handleBg: 'bg-teal-700/60',
    selectedBg: 'bg-teal-400/20',
  },
};

const TRIM_HANDLE_WIDTH = 8;

function getClipLabel(clip: Clip): string {
  if (clip.type === 'text' || clip.type === 'subtitle') {
    return clip.text || (clip.type === 'text' ? 'Text' : 'Subtitle');
  }
  if (clip.sourcePath) {
    const parts = clip.sourcePath.split('/');
    return parts[parts.length - 1] || clip.type;
  }
  return clip.type;
}

function WaveformPlaceholder() {
  const bars = 20;
  return (
    <svg
      className="w-full h-full opacity-30"
      viewBox={`0 0 ${bars * 4} 20`}
      preserveAspectRatio="none"
    >
      {Array.from({ length: bars }, (_, i) => {
        const h = 4 + Math.sin(i * 0.8) * 3 + Math.cos(i * 1.3) * 4;
        return (
          <rect
            key={i}
            x={i * 4}
            y={10 - h / 2}
            width={2}
            height={h}
            rx={1}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

function ThumbnailStrip() {
  return (
    <div className="flex gap-px h-full w-full">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex-1 h-full opacity-30"
          style={{
            backgroundColor: `hsl(${210 + i * 8}, 60%, ${25 + i * 3}%)`,
          }}
        />
      ))}
    </div>
  );
}

export const ClipItem: React.FC<ClipProps> = ({
  clip,
  zoom,
  isSelected,
  onSelect,
  onTrimStart,
  onTrimEnd,
  onDrag,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'trimStart' | 'trimEnd' | null>(null);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);

  const styles = TYPE_STYLES[clip.type] || TYPE_STYLES.video;
  const width = Math.max(20, clip.duration * zoom);
  const left = clip.startTime * zoom;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: 'move' | 'trimStart' | 'trimEnd') => {
      e.stopPropagation();
      onSelect();
      setIsDragging(true);
      setDragMode(mode);
      dragStartX.current = e.clientX;

      if (mode === 'move') {
        dragStartValue.current = clip.startTime;
      } else if (mode === 'trimStart') {
        dragStartValue.current = clip.trimStart;
      } else {
        dragStartValue.current = clip.duration;
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - dragStartX.current;
        const deltaSec = deltaPx / zoom;

        if (mode === 'move') {
          const newStart = Math.max(0, dragStartValue.current + deltaSec);
          onDrag(newStart);
        } else if (mode === 'trimStart') {
          onTrimStart(deltaSec);
        } else {
          onTrimEnd(deltaSec);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setDragMode(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [clip, zoom, onSelect, onDrag, onTrimStart, onTrimEnd],
  );

  const label = getClipLabel(clip);

  return (
    <div
      className={`absolute top-1 bottom-1 rounded-md border cursor-grab select-none overflow-hidden transition-shadow ${
        styles.bg
      } ${styles.border} ${isSelected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''} ${
        isDragging ? 'cursor-grabbing z-10' : ''
      }`}
      style={{ left, width }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Left trim handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity ${styles.handleBg}`}
        onMouseDown={(e) => handleMouseDown(e, 'trimStart')}
      >
        <div className="w-0.5 h-3 bg-white/40 rounded-full" />
      </div>

      {/* Clip content */}
      <div className="relative h-full px-3 py-1 flex items-center gap-2 overflow-hidden">
        {clip.type === 'video' && (
          <div className="absolute inset-0 ml-2">
            <ThumbnailStrip />
          </div>
        )}
        {clip.type === 'audio' && (
          <div className="absolute inset-0 flex items-center px-2 text-green-200">
            <WaveformPlaceholder />
          </div>
        )}
        {(clip.type === 'text' || clip.type === 'subtitle') && (
          <div className="absolute inset-0 flex items-center px-3">
            <span className="text-[10px] text-white/70 truncate italic">
              {clip.text || 'Empty text'}
            </span>
          </div>
        )}
        <span
          className={`relative text-[10px] font-medium truncate ${
            clip.type === 'audio' ? 'text-green-100' : clip.type === 'video' ? 'text-blue-100' : 'text-white/80'
          }`}
        >
          {label}
        </span>
      </div>

      {/* Right trim handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity ${styles.handleBg}`}
        onMouseDown={(e) => handleMouseDown(e, 'trimEnd')}
      >
        <div className="w-0.5 h-3 bg-white/40 rounded-full" />
      </div>
    </div>
  );
};
