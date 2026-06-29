import React, { useCallback, useRef, useState } from 'react';
import { Clip } from '@/store/videoEditorStore';
import type { ClipProps } from '../types';

const TYPE_STYLES = {
  video: {
    bg: 'bg-gradient-to-r from-blue-600 to-blue-500',
    border: 'border-blue-400/40',
    hoverBg: 'hover:from-blue-500 hover:to-blue-400',
    handleBg: 'bg-blue-300/30',
    selectedBg: 'ring-2 ring-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.4)]',
  },
  audio: {
    bg: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    border: 'border-emerald-400/40',
    hoverBg: 'hover:from-emerald-500 hover:to-emerald-400',
    handleBg: 'bg-emerald-300/30',
    selectedBg: 'ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]',
  },
  text: {
    bg: 'bg-gradient-to-r from-violet-600 to-violet-500',
    border: 'border-violet-400/40',
    hoverBg: 'hover:from-violet-500 hover:to-violet-400',
    handleBg: 'bg-violet-300/30',
    selectedBg: 'ring-2 ring-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.4)]',
  },
  subtitle: {
    bg: 'bg-gradient-to-r from-cyan-600 to-cyan-500',
    border: 'border-cyan-400/40',
    hoverBg: 'hover:from-cyan-500 hover:to-cyan-400',
    handleBg: 'bg-cyan-300/30',
    selectedBg: 'ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]',
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
  const bars = 40;
  return (
    <svg
      className="w-full h-full opacity-40"
      viewBox={`0 0 ${bars * 3} 24`}
      preserveAspectRatio="none"
    >
      {Array.from({ length: bars }, (_, i) => {
        const h = 3 + Math.sin(i * 0.5) * 4 + Math.cos(i * 1.1) * 5 + Math.sin(i * 2.3) * 2;
        const clamped = Math.max(2, Math.min(20, h));
        return (
          <rect
            key={i}
            x={i * 3}
            y={12 - clamped / 2}
            width={2}
            height={clamped}
            rx={1}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

function ThumbnailStrip() {
  const colors = [
    'hsl(210, 50%, 20%)',
    'hsl(215, 55%, 22%)',
    'hsl(220, 50%, 25%)',
    'hsl(205, 45%, 28%)',
    'hsl(200, 40%, 30%)',
    'hsl(210, 50%, 24%)',
    'hsl(218, 52%, 26%)',
    'hsl(212, 48%, 22%)',
  ];
  return (
    <div className="flex h-full w-full opacity-50">
      {colors.map((color, i) => (
        <div
          key={i}
          className="flex-1 h-full"
          style={{ backgroundColor: color }}
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
      className={`absolute top-1 bottom-1 rounded-lg border flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${
        styles.bg
      } ${styles.hoverBg} ${
        isSelected ? styles.selectedBg : styles.border
      } ${isDragging ? 'cursor-grabbing z-10' : ''}`}
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
