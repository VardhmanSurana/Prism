/**
 * AnnotationsPanel.tsx
 * UI controls for drawing arrow, circle, rectangle, freehand, and highlighter annotations on the photo.
 */

import React, { useMemo, useState } from 'react';
import { RotateCcw, ArrowUpRight, Circle, Square, Edit3, Eraser, MousePointer2, Highlighter, Pipette, Grid3X3 } from 'lucide-react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';

export interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'highlighter';
  color: string;
  strokeWidth: number;
  opacity?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  bounds?: { x: number; y: number; w: number; h: number };
}

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter';
  setActiveDrawTool: (tool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter') => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  activeOpacity?: number;
  setActiveOpacity?: (opacity: number) => void;
  markStyleChanged?: () => void;
}

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#f43f5e',
  '#ffffff',
  '#000000',
];

const DRAW_TOOLS = [
    { id: 'select', name: 'Select', icon: MousePointer2 },
    { id: 'freehand', name: 'Pen', icon: Edit3 },
    { id: 'arrow', name: 'Arrow', icon: ArrowUpRight },
    { id: 'rect', name: 'Rect', icon: Square },
    { id: 'circle', name: 'Circle', icon: Circle },
    { id: 'highlighter', name: 'Highlight', icon: Highlighter },
    { id: 'eraser', name: 'Eraser', icon: Eraser },
] as const;

const SWATCH_GRID: string[][] = [
  ['#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
  ['#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
  ['#92400e', '#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'],
  ['#854d0e', '#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#fef9c3'],
  ['#3f6212', '#4d7c0f', '#65a30d', '#84cc16', '#a3e635', '#bef264', '#d9f99d', '#ecfccb'],
  ['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'],
  ['#115e59', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'],
  ['#164e63', '#0e7490', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'],
  ['#0c4a6e', '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'],
  ['#1e3a5f', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  ['#312e81', '#3730a3', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  ['#4c1d95', '#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
  ['#581c87', '#6b21a8', '#9333ea', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff'],
  ['#701a75', '#86198f', '#c026d3', '#d946ef', '#e879f9', '#f0abfc', '#f5d0fe', '#fae8ff'],
  ['#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#fce7f3'],
  ['#9f1239', '#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2'],
  ['#171717', '#262626', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#f5f5f5'],
  ['#1c1917', '#292524', '#44403c', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#f5f5f4'],
];

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = (props) => {
  const {
    annotations,
    onChange,
    activeDrawTool,
    setActiveDrawTool,
    activeColor,
    setActiveColor,
    strokeWidth,
    setStrokeWidth,
    selectedAnnId,
    markStyleChanged,
  } = props;
  const isDefault = useMemo(() => annotations.length === 0, [annotations]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSwatchGrid, setShowSwatchGrid] = useState(false);
  const [customColor, setCustomColor] = useColor('#ef4444');
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const pushRecentColor = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      return [color, ...filtered].slice(0, 6);
    });
  };

  const handlePickColor = (color: string) => {
    setActiveColor(color);
    pushRecentColor(color);
    markStyleChanged?.();
  };

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
          <div className="grid grid-cols-4 gap-1.5">
            {DRAW_TOOLS.map(tool => {
              const Icon = tool.icon;
              const isActive = activeDrawTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveDrawTool(tool.id as any)}
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
          <div className="grid grid-cols-6 gap-2">
            {[
                '#ef4444',
                '#f97316',
                '#eab308',
                '#22c55e',
                '#14b8a6',
                '#06b6d4',
                '#3b82f6',
                '#8b5cf6',
                '#d946ef',
                '#f43f5e',
                '#ffffff',
                '#000000',
            ].map(color => {
              const isActive = activeColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => handlePickColor(color)}
                  className={`w-full aspect-square rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                      : 'border-white/10 hover:scale-105'
                      }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
              Pinned
            </p>
            <div className="grid grid-cols-6 gap-2">
                {['#000000', '#ffffff'].map(color => {
                const isActive = activeColor.toLowerCase() === color.toLowerCase();
                return (
                    <button
                    key={color}
                    onClick={() => handlePickColor(color)}
                    className={`w-full aspect-square rounded-lg border transition-all duration-200 cursor-pointer ${
                        isActive
                        ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                        : 'border-white/10 hover:scale-105'
                        }`}
                    style={{ backgroundColor: color }}
                    />
                );
                })}
            </div>
            </div>
            <div className="mt-4 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
                Recent
            </p>
            <div className="grid grid-cols-6 gap-2">
                {recentColors.length > 0 ? recentColors.map(color => {
                const isActive = activeColor.toLowerCase() === color.toLowerCase();
                return (
                    <button
                    key={color}
                    onClick={() => handlePickColor(color)}
                    className={`w-full aspect-square rounded-lg border transition-all duration-200 cursor-pointer ${
                        isActive
                        ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                        : 'border-white/10 hover:scale-105'
                        }`}
                    style={{ backgroundColor: color }}
                    />
                );
                }) : (
                <p className="col-span-6 text-[9px] text-white/20 italic">No colors used yet</p>
                )}
            </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowSwatchGrid(prev => !prev);
                    setShowColorPicker(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 w-full p-2 rounded-lg text-xs transition-colors duration-200 cursor-pointer ${
                    showSwatchGrid
                      ? 'bg-primary/20 text-primary'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <Grid3X3 size={12} />
                  Palette
                </button>
                <button
                  onClick={() => {
                    handlePickColor(customColor.hex);
                    setShowColorPicker(prev => !prev);
                    setShowSwatchGrid(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 w-full p-2 rounded-lg text-xs transition-colors duration-200 cursor-pointer ${
                    showColorPicker
                      ? 'bg-primary/20 text-primary'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <Pipette size={12} />
                  Custom Color
                </button>
            </div>
            {showSwatchGrid && (
              <div className="mt-3 rounded-xl border border-white/10 p-2 space-y-1">
                {SWATCH_GRID.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-8 gap-1">
                    {row.map((hex) => {
                      const isActive = activeColor.toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={hex}
                          onClick={() => handlePickColor(hex)}
                          className={`w-full aspect-square rounded-md border transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'border-white ring-2 ring-white/30 scale-110 shadow-md'
                              : 'border-white/5 hover:scale-110 hover:border-white/20'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {showColorPicker && (
              <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                <ColorPicker
                  color={customColor}
                  onChange={setCustomColor}
                  hideInput={false}
                />
                <button
                  onClick={() => {
                    handlePickColor(customColor.hex);
                    setShowColorPicker(false);
                  }}
                  className="w-full py-2 bg-primary text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
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
              onChange={e => { setStrokeWidth(Number(e.target.value)); markStyleChanged?.(); }}
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
                    </div>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete layer"
                    >
                      <Eraser size={12} />
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

