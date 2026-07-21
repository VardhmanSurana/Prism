import React, { useEffect, useState } from 'react';
import type { Clip } from '@/types/nle';
import { API_BASE } from '@/constants';
import { useNLEStore } from '@/store/nleStore';

const TRACK_HEIGHT = 48;

interface ClipElementProps {
  clip: Clip;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
  pixelsPerSec: number;
  fps: number;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (type: 'move' | 'trim-in' | 'trim-out', mouseX: number) => void;
}

export const ClipElement: React.FC<ClipElementProps> = ({
  clip, trackType, pixelsPerSec, fps, isSelected, isDragging, onSelect, onDragStart,
}) => {
  const detachAudio = useNLEStore((s) => s.detachAudio);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextPos, setContextPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const left = (clip.startFrame / fps) * pixelsPerSec;
  const width = (clip.durationFrames / fps) * pixelsPerSec;

  const getThemeClasses = () => {
    if (isDragging) {
      return 'bg-[#2563eb] border-2 border-blue-400 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20';
    }
    if (isSelected) {
      switch (trackType) {
        case 'audio':
          return 'bg-[#183327] border-2 border-[#10b981] shadow-lg shadow-emerald-500/20';
        case 'text':
          return 'bg-[#2f1d38] border-2 border-[#a855f7] shadow-lg shadow-purple-500/20';
        case 'video':
        default:
          return 'bg-[#1d2d44] border-2 border-blue-500 shadow-lg shadow-blue-500/20';
      }
    }
    switch (trackType) {
      case 'audio':
        return 'bg-[#10241b] border border-emerald-500/35 hover:bg-[#153024] hover:border-emerald-500/50';
      case 'text':
        return 'bg-[#1f1225] border border-purple-500/35 hover:bg-[#2a1a32] hover:border-purple-500/50';
      case 'video':
      default:
        return 'bg-[#132030] border border-blue-500/35 hover:bg-[#1a2b42] hover:border-blue-500/50';
    }
  };

  return (
    <div
      className={`absolute top-1 bottom-1 rounded-[4px] cursor-pointer overflow-hidden transition-all select-none ${getThemeClasses()}`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (trackType === 'video') {
          setContextPos({ x: e.clientX, y: e.clientY });
          setShowContextMenu(true);
        }
      }}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 z-20 flex items-center justify-center border-r border-white/5"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart('trim-in', e.clientX);
        }}
      >
        <div className="w-[1.5px] h-3 bg-white/40 rounded-full" />
      </div>

      {/* Clip content — draggable */}
      <div
        className="absolute inset-0 px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
          onDragStart('move', e.clientX);
        }}
      >
        {trackType === 'video' && (
          <ThumbnailStrip sourcePath={clip.sourcePath} width={width} height={TRACK_HEIGHT - 8} speed={clip.speed} inPoint={clip.inPoint} outPoint={clip.outPoint} />
        )}
        {trackType === 'audio' && (
          <WaveformBar clipId={clip.id} sourcePath={clip.sourcePath} width={width} height={TRACK_HEIGHT - 8} speed={clip.speed} inPoint={clip.inPoint} outPoint={clip.outPoint} />
        )}

        {trackType === 'text' && clip.text?.text && (
          <div className="absolute inset-0 flex items-center justify-center px-4 select-none pointer-events-none">
            <span className="text-[10px] text-purple-300 font-mono italic truncate max-w-full">
              "{clip.text.text}"
            </span>
          </div>
        )}

        {/* Header label with filename */}
        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-0.5 pointer-events-none z-10">
          <div className="text-[9px] text-white/90 font-medium truncate leading-none select-none">
            {clip.sourcePath.split('/').pop() || clip.text?.text || 'Clip'}
          </div>
        </div>

        {/* Freeze/Speed indicators overlay */}
        <div className="absolute bottom-1 left-2.5 pointer-events-none z-10 flex gap-1">
          {clip.speed === 0 && (
            <div className="text-[8px] bg-cyan-950/80 text-cyan-300 px-1 rounded-[2px] leading-tight select-none border border-cyan-800/40">❄ Freeze</div>
          )}
          {clip.speed < 0 && clip.speed !== 0 && (
            <div className="text-[8px] bg-orange-950/80 text-orange-300 px-1 rounded-[2px] leading-tight select-none border border-orange-850/40">◀ {Math.abs(clip.speed)}x</div>
          )}
          {clip.speed > 0 && clip.speed !== 1 && (
            <div className="text-[8px] bg-yellow-950/80 text-yellow-300 px-1 rounded-[2px] leading-tight select-none border border-yellow-800/40">{clip.speed}x</div>
          )}
        </div>
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 z-20 flex items-center justify-center border-l border-white/5"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart('trim-out', e.clientX);
        }}
      >
        <div className="w-[1.5px] h-3 bg-white/40 rounded-full" />
      </div>

      {/* Fade indicators */}
      {clip.fadeIn > 0 && (
        <div className="absolute left-2 top-0 bottom-0 w-2 bg-gradient-to-r from-green-400/40 to-transparent pointer-events-none" />
      )}
      {clip.fadeOut > 0 && (
        <div className="absolute right-2 top-0 bottom-0 w-2 bg-gradient-to-l from-red-400/40 to-transparent pointer-events-none" />
      )}

      {/* Right-click Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-[100] bg-[#1a1a1a] border border-[#333] rounded shadow-xl py-1 text-xs text-[#ccc]"
          style={{ left: contextPos.x, top: contextPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowContextMenu(false);
              detachAudio(clip.id);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#3b82f6] hover:text-white flex items-center gap-1.5"
          >
            🔊 Detach Audio to Track
          </button>
        </div>
      )}
    </div>
  );
};

const waveformCache = new Map<string, number[]>();

const WaveformBar: React.FC<{ clipId: string; sourcePath: string; width: number; height: number; speed: number; inPoint: number; outPoint: number }> = ({ clipId, sourcePath, width, height, speed, inPoint, outPoint }) => {
  const cacheKey = `${sourcePath}_${speed}_${inPoint}_${outPoint}`;
  const [peaks, setPeaks] = useState<number[]>(() => waveformCache.get(cacheKey) || []);

  useEffect(() => {
    if (waveformCache.has(cacheKey)) {
      setPeaks(waveformCache.get(cacheKey)!);
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/api/v1/nle/clips/waveform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: sourcePath, speed, in_point: inPoint, out_point: outPoint }),
    }).then(r => r.json()).then(data => {
      if (!cancelled && data.peaks) {
        waveformCache.set(cacheKey, data.peaks);
        setPeaks(data.peaks);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePath, speed, inPoint, outPoint, cacheKey]);

  if (peaks.length === 0) return null;
  const barWidth = width / peaks.length;
  return (
    <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
      {peaks.map((p, i) => (
        <rect key={i} x={i * barWidth} y={height / 2 - (p * height / 2.5)} width={Math.max(barWidth - 0.5, 0.5)} height={p * height * 0.8} fill="rgba(52, 211, 153, 0.35)" />
      ))}
    </svg>
  );
};

const ThumbnailStrip: React.FC<{ sourcePath: string; width: number; height: number; speed: number; inPoint: number; outPoint: number }> = ({ sourcePath, width, height, speed, inPoint, outPoint }) => {
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/nle/clips/thumbnail-strip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: sourcePath, num_thumbnails: Math.max(3, Math.floor(width / 80)), speed, in_point: inPoint, out_point: outPoint }),
    }).then(r => r.json()).then(data => {
      if (!cancelled && data.thumbnails) setThumbs(data.thumbnails);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePath, width, speed, inPoint, outPoint]);

  if (thumbs.length === 0) return null;
  const thumbWidth = width / thumbs.length;
  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {thumbs.map((b64, i) => (
        <img key={i} src={`data:image/jpeg;base64,${b64}`} className="h-full object-cover select-none pointer-events-none opacity-85" style={{ width: thumbWidth }} alt="" />
      ))}
    </div>
  );
};
