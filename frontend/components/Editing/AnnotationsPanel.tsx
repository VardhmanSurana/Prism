/**
 * AnnotationsPanel.tsx
 * UI controls for drawing arrow, circle, rectangle, freehand, and text annotations on the photo.
 */

import React, { useMemo } from 'react';
import { RotateCcw, ArrowUpRight, Circle, Square, Edit3, Type, Trash2, Eraser } from 'lucide-react';
import { Wheel } from '@uiw/react-color';

export interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'rect' | 'freehand' | 'text' | 'eraser';
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[]; // freehand + arrow (start + end)
  bounds?: { x: number; y: number; w: number; h: number }; // circle + rect
  text?: string;
  fontSize?: number;
}

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: string;
  setActiveDrawTool: (tool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'text' | 'eraser') => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
}

const PRESET_COLORS = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#ffffff', name: 'White' },
  { hex: '#000000', name: 'Black' },
];

const DRAW_TOOLS = [
  { id: 'freehand', name: 'Pen', icon: Edit3 },
  { id: 'arrow', name: 'Arrow', icon: ArrowUpRight },
  { id: 'rect', name: 'Rect', icon: Square },
  { id: 'circle', name: 'Circle', icon: Circle },
  { id: 'text', name: 'Text', icon: Type },
  { id: 'eraser', name: 'Eraser', icon: Eraser },
] as const;

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({
  annotations,
  onChange,
  activeDrawTool,
  setActiveDrawTool,
  activeColor,
  setActiveColor,
  strokeWidth,
  setStrokeWidth,
}) => {
  const isDefault = useMemo(() => annotations.length === 0, [annotations]);

  const handleReset = () => {
    onChange([]);
  };

  const handleDelete = (id: string) => {
    onChange(annotations.filter(a => a.id !== id));
  };

  const getToolLabel = (type: string) => {
    const t = DRAW_TOOLS.find(tool => tool.id === type);
    return t ? t.name : type;
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Markup & Draw
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors"
          >
            <RotateCcw size={9} /> Clear All
          </button>
        )}
      </div>

      <div className="flex-1 px-4 pb-6 space-y-6">
        {/* Draw Tools Grid */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
            Drawing Tool
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {DRAW_TOOLS.map(tool => {
              const Icon = tool.icon;
              const isActive = activeDrawTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveDrawTool(tool.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-black border border-primary shadow-lg shadow-primary/10'
                      : 'bg-white/[0.02] border border-white/5 text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }`}
                  title={tool.name}
                >
                  <Icon size={14} />
                  <span className="text-[8px] font-bold mt-1.5">{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
            Color
          </p>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {PRESET_COLORS.map(color => {
              const isActive = activeColor.toLowerCase() === color.hex.toLowerCase();
              return (
                <button
                  key={color.hex}
                  onClick={() => setActiveColor(color.hex)}
                  className={`w-6 h-6 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                      : 'border-white/10 hover:scale-105'
                      }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              );
            })}
          </div>

          <div className="flex justify-center mt-3">
            <Wheel
              color={activeColor}
              onChange={(color) => setActiveColor(color.hex)}
              width={160}
              height={160}
            />
          </div>
        </div>

        {/* Stroke Width Slider */}
        <div className="group/item">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
              Stroke Width
            </label>
            <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
              {strokeWidth}px
            </span>
          </div>
          <div className="relative h-4 flex items-center">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
              style={{
                left: '0%',
                width: `${((strokeWidth - 1) / 19) * 100}%`,
                boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
              }}
            />
            <input
              type="range"
              min={1}
              max={20}
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>

        {/* Annotations List */}
        <div className="flex-1 flex flex-col min-h-[160px] overflow-hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3 shrink-0">
            Layers ({annotations.length})
          </p>

          <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 bg-black/25 rounded-2xl max-h-[220px]">
            {annotations.length === 0 ? (
              <div className="w-full h-full min-h-[120px] flex items-center justify-center text-white/15 text-[10px] font-mono select-none">
                No markup layers yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {annotations.map((ann, index) => (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between p-2.5 px-3 hover:bg-white/[0.01] transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                        style={{ backgroundColor: ann.color }}
                      />
                      <span className="text-xs text-white/70 font-semibold uppercase tracking-wider text-[10px]">
                        {index + 1}. {getToolLabel(ann.type)}
                      </span>
                      {ann.text && (
                        <span className="text-[10px] text-white/30 truncate max-w-[100px] italic">
                          "{ann.text}"
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete layer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
