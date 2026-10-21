/**
 * KeyframeGraphEditor.tsx — Interactive Keyframe Easing & Spline Curve Editor.
 * Displays keyframe curves over time and allows visual inspection/editing of Bezier handles.
 */
import React, { useState } from 'react';
import type { Keyframe, KeyframeProperty } from '@/types/nle';
import { useNLEStore } from '@/store/nleStore';

interface KeyframeGraphEditorProps {
  clipId: string;
  property: KeyframeProperty;
  keyframes: Keyframe[];
  durationSec: number;
}

/**
 * KeyframeGraphEditor - Renders keyframe graph editor.
 */
export const KeyframeGraphEditor: React.FC<KeyframeGraphEditorProps> = ({
  clipId,
  property,
  keyframes,
  durationSec,
}) => {
  /**
   * setClipKeyframes - Performs set clip keyframes.
   */
  const setClipKeyframes = useNLEStore((s) => s.setClipKeyframes);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!keyframes || keyframes.length === 0) {
    return (
      <div className="h-28 bg-[#171615] border-t border-white/10 flex items-center justify-center">
        <span className="text-zinc-500 text-xs font-mono">No keyframes on property: {property}</span>
      </div>
    );
  }

  const svgWidth = 400;
  const svgHeight = 90;
  const padding = 15;

  /**
   * minVal - Performs min val.
   */
  const minVal = Math.min(...keyframes.map((k) => k.v), 0);
  /**
   * maxVal - Performs max val.
   */
  const maxVal = Math.max(...keyframes.map((k) => k.v), 1);
  const valRange = Math.max(maxVal - minVal, 0.001);

  /**
   * getSvgCoords - Retrieves get svg coords.
   */
  const getSvgCoords = (t: number, v: number) => {
    const x = padding + (t / durationSec) * (svgWidth - padding * 2);
    const y = svgHeight - padding - ((v - minVal) / valRange) * (svgHeight - padding * 2);
    return { x, y };
  };

  // Generate SVG path line connecting keyframes
  /**
   * points - Performs points.
   */
  const points = keyframes.map((k) => getSvgCoords(k.t, k.v));
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  /**
   * handleInterpolationChange - Handles interpolation change.
   */
  const handleInterpolationChange = (idx: number, interpolation: Keyframe['interpolation']) => {
    /**
     * updated - Performs updated.
     */
    const updated = keyframes.map((k, i) => (i === idx ? { ...k, interpolation } : k));
    setClipKeyframes(clipId, property, updated);
  };

  return (
    <div className="h-32 bg-[#171615] border-t border-white/10 p-2 flex flex-col justify-between select-none">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-[#e5a93c] text-xs font-mono font-semibold uppercase">{property} Curve</span>
          <span className="text-zinc-500 text-[10px]">{keyframes.length} keyframes</span>
        </div>
        {selectedIdx !== null && keyframes[selectedIdx] && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-[10px]">Easing:</span>
            <select
              value={keyframes[selectedIdx].interpolation}
              onChange={(e) => handleInterpolationChange(selectedIdx, e.target.value as Keyframe['interpolation'])}
              className="bg-[#1d1b1a] text-zinc-200 text-[10px] rounded px-1.5 py-0.5 border border-white/10 outline-none focus:border-[#e5a93c]/50"
            >
              <option value="linear">Linear</option>
              <option value="ease-in">Ease-In</option>
              <option value="ease-out">Ease-Out</option>
              <option value="ease-in-out">Ease-In-Out</option>
              <option value="bezier">Bezier</option>
            </select>
          </div>
        )}
      </div>

      {/* SVG Curve Graph Canvas */}
      <div className="relative flex-1 bg-[#151312] rounded border border-white/10 overflow-hidden my-1">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
          {/* Grid lines */}
          <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          
          {/* Curve path */}
          <path d={pathD} fill="none" stroke="#e5a93c" strokeWidth="2" />

          {/* Keyframe Nodes */}
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={selectedIdx === idx ? "5" : "3.5"}
              fill={selectedIdx === idx ? "#f5f0ed" : "#e5a93c"}
              stroke="#151312"
              strokeWidth="1.5"
              className="cursor-pointer hover:scale-125 transition-transform"
              onClick={() => setSelectedIdx(idx)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};
