import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { Keyframe, KeyframeProperty } from '@/types/nle';
import { Dropdown } from '@/components/ui/Dropdown';

const PROPS: { key: KeyframeProperty; label: string }[] = [
  { key: 'opacity', label: 'Opacity' },
  { key: 'scaleX', label: 'Scale X' },
  { key: 'scaleY', label: 'Scale Y' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'volume', label: 'Volume' },
  { key: 'x', label: 'Position X' },
  { key: 'y', label: 'Position Y' },
];

const W = 220;
const H = 100;
const PAD = 8;
const KF_R = 4;

export const KeyframeEditor: React.FC = () => {
  const clip = useNLEStore((s) => s.getSelectedClip());
  const setClipKeyframes = useNLEStore((s) => s.setClipKeyframes);
  const playheadPosition = useNLEStore((s) => s.playheadPosition);
  const fps = useNLEStore((s) => s.projectFps);
  const [selectedProp, setSelectedProp] = useState<KeyframeProperty>('opacity');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!clip) return null;

  const clipDuration = clip.durationFrames / fps;
  const kfs = clip.keyframes[selectedProp] ?? [];

  const propRange = useMemo(() => {
    switch (selectedProp) {
      case 'opacity': return { min: 0, max: 1 };
      case 'scaleX': case 'scaleY': return { min: 0.1, max: 3 };
      case 'rotation': return { min: -180, max: 180 };
      case 'volume': return { min: 0, max: 2 };
      case 'x': case 'y': return { min: -500, max: 500 };
      default: return { min: 0, max: 1 };
    }
  }, [selectedProp]);

  const toSVG = useCallback((t: number, v: number) => {
    const x = PAD + (t / clipDuration) * (W - 2 * PAD);
    const y = H - PAD - ((v - propRange.min) / (propRange.max - propRange.min)) * (H - 2 * PAD);
    return { x, y };
  }, [clipDuration, propRange]);

  const fromSVG = useCallback((svgX: number, svgY: number) => {
    const t = ((svgX - PAD) / (W - 2 * PAD)) * clipDuration;
    const v = propRange.min + ((H - PAD - svgY) / (H - 2 * PAD)) * (propRange.max - propRange.min);
    return { t: Math.max(0, Math.min(clipDuration, t)), v };
  }, [clipDuration, propRange]);

  const sorted = useMemo(() => [...kfs].sort((a, b) => a.t - b.t), [kfs]);

  const pathD = useMemo(() => {
    if (sorted.length === 0) return '';
    const pts = sorted.map(kf => toSVG(kf.t, kf.v));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.interpolation === 'linear') {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      } else {
        const steps = 20;
        for (let s = 1; s <= steps; s++) {
          const progress = s / steps;
          const time = prev.t + (curr.t - prev.t) * progress;
          let interpProgress = progress;
          if (curr.interpolation === 'ease-in') interpProgress = progress * progress;
          else if (curr.interpolation === 'ease-out') interpProgress = progress * (2 - progress);
          else if (curr.interpolation === 'ease-in-out') interpProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
          const val = prev.v + (curr.v - prev.v) * interpProgress;
          const pt = toSVG(time, val);
          d += ` L ${pt.x} ${pt.y}`;
        }
      }
    }
    return d;
  }, [sorted, toSVG]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (W / rect.width);
    const svgY = (e.clientY - rect.top) * (H / rect.height);
    const { t, v } = fromSVG(svgX, svgY);

    const newKf: Keyframe = { t, v, interpolation: 'linear' };
    const updated = [...kfs, newKf].sort((a, b) => a.t - b.t);
    setClipKeyframes(clip.id, selectedProp, updated);
  }, [kfs, fromSVG, clip.id, selectedProp, setClipKeyframes]);

  const handleKfMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setDragIdx(idx);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragIdx === null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (W / rect.width);
    const svgY = (e.clientY - rect.top) * (H / rect.height);
    const { t, v } = fromSVG(svgX, svgY);
    const updated = [...kfs];
    updated[dragIdx] = { ...updated[dragIdx], t, v };
    updated.sort((a, b) => a.t - b.t);
    setClipKeyframes(clip.id, selectedProp, updated);
    const newIdx = updated.findIndex(kf => kf.t === t && kf.v === v);
    if (newIdx !== -1) setDragIdx(newIdx);
  }, [dragIdx, kfs, fromSVG, clip.id, selectedProp, setClipKeyframes]);

  const handleMouseUp = useCallback(() => {
    setDragIdx(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = kfs.filter((_, i) => i !== idx);
    setClipKeyframes(clip.id, selectedProp, updated);
  }, [kfs, clip.id, selectedProp, setClipKeyframes]);

  const playheadX = PAD + (playheadPosition / clipDuration) * (W - 2 * PAD);

  return (
    <div className="p-3 border-b border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-xs font-medium">Keyframes</span>
      </div>
      <Dropdown
        value={selectedProp}
        onChange={(val) => setSelectedProp(val as KeyframeProperty)}
        options={PROPS.map((p) => ({ value: p.key, label: p.label }))}
        className="w-full mb-2"
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full bg-zinc-950 rounded border border-zinc-800 cursor-crosshair"
        style={{ height: H }}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD}
            y1={H - PAD - frac * (H - 2 * PAD)}
            x2={W - PAD}
            y2={H - PAD - frac * (H - 2 * PAD)}
            stroke="#27272a"
            strokeWidth={0.5}
          />
        ))}

        {/* Curve path */}
        {pathD && (
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
        )}

        {/* Playhead */}
        {playheadPosition <= clipDuration && (
          <line
            x1={playheadX}
            y1={PAD}
            x2={playheadX}
            y2={H - PAD}
            stroke="#ef4444"
            strokeWidth={1}
          />
        )}

        {/* Keyframe dots */}
        {sorted.map((kf, i) => {
          const pt = toSVG(kf.t, kf.v);
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={KF_R}
              fill={dragIdx === i ? '#60a5fa' : '#3b82f6'}
              stroke="#1e3a5f"
              strokeWidth={1}
              className="cursor-grab"
              onMouseDown={(e) => handleKfMouseDown(e, i)}
              onContextMenu={(e) => handleContextMenu(e, i)}
            />
          );
        })}
      </svg>

      {kfs.length === 0 && (
        <p className="text-zinc-600 text-[10px] mt-1 text-center">
          Click to add a keyframe
        </p>
      )}
    </div>
  );
};

export default KeyframeEditor;
