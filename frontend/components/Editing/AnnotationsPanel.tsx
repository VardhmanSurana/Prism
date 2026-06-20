/**
 * AnnotationsPanel.tsx
 * UI controls for drawing arrow, circle, rectangle, freehand, and highlighter annotations on the photo.
 */

import React, { useMemo, useState } from 'react';
import {
  RotateCcw,
  ArrowUpRight,
  Circle,
  Square,
  Edit3,
  Eraser,
  MousePointer2,
  Highlighter,
  Pipette,
  Grid3X3,
  ChevronDown,
  ChevronRight,
  Type,
  Sparkles,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';

export type AnnotationToolType = 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'highlighter' | 'text' | 'textPath';

export interface Annotation {
  id: string;
  type: AnnotationToolType;
  color: string;
  strokeWidth: number;
  opacity?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  bounds?: { x: number; y: number; w: number; h: number };
  visible?: boolean;
  
  // Text layer properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  bgColor?: string;
  bgOpacity?: number;
  bgGlass?: boolean;
  textStroke?: string;
  textShadow?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';

  // Text doodle properties
  doodleText?: string;
  showGuidePath?: boolean;
}

export type DrawToolId = 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter' | 'text' | 'textPath';

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: DrawToolId;
  setActiveDrawTool: (tool: DrawToolId) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  activeOpacity?: number;
  setActiveOpacity?: (opacity: number) => void;
  markStyleChanged?: () => void;
  
  // Text layer settings
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  fontSize?: number;
  setFontSize?: (size: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (w: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (s: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (val: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (val: number) => void;
  onUpdateTextProps?: (updatedProps: Partial<Annotation>) => void;

  // Text doodle settings
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;
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

const DRAW_TOOLS: { id: DrawToolId; name: string; icon: any }[] = [
    { id: 'select', name: 'Select', icon: MousePointer2 },
    { id: 'freehand', name: 'Pen', icon: Edit3 },
    { id: 'arrow', name: 'Arrow', icon: ArrowUpRight },
    { id: 'rect', name: 'Rect', icon: Square },
    { id: 'circle', name: 'Circle', icon: Circle },
    { id: 'highlighter', name: 'Highlight', icon: Highlighter },
    { id: 'text', name: 'Text', icon: Type },
    { id: 'textPath', name: 'Text Doodle', icon: Sparkles },
    { id: 'eraser', name: 'Eraser', icon: Eraser },
];

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
    activeOpacity,
    setActiveOpacity,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    fontWeight,
    setWeight,
    fontStyle,
    setStyle,
    textDecoration,
    setDecoration,
    textAlign,
    setTextAlign,
    lineHeight,
    setLineHeight,
    letterSpacing,
    setLetterSpacing,
    onUpdateTextProps,
    doodleText,
    setDoodleText,
    doodleFontSize,
    setDoodleFontSize,
    doodleFontFamily,
    setDoodleFontFamily,
    showDoodleGuide,
    setShowDoodleGuide,
  } = props;
  const isDefault = useMemo(() => annotations.length === 0, [annotations]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSwatchGrid, setShowSwatchGrid] = useState(false);
  const [customColor, setCustomColor] = useColor('#ef4444');
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false);
  const [pinnedColors, setPinnedColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prism_pinned_colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return ['#000000', '#ffffff'];
  });

  const pinColor = (color: string) => {
    if (!color) return;
    const normalized = color.toLowerCase();
    setPinnedColors(prev => {
      if (prev.map(c => c.toLowerCase()).includes(normalized)) return prev;
      const next = [...prev, color];
      try {
        localStorage.setItem('prism_pinned_colors', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const unpinColor = (color: string) => {
    setPinnedColors(prev => {
      const next = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      try {
        localStorage.setItem('prism_pinned_colors', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const selectedAnn = useMemo(() => {
    return annotations.find(a => a.id === selectedAnnId) || null;
  }, [annotations, selectedAnnId]);

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

  const handleToggleVisibility = (id: string) => {
    onChange(
      annotations.map((a) => {
        if (a.id !== id) return a;
        return { ...a, visible: a.visible === false ? true : false };
      })
    );
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
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
                Pinned
              </p>
              <button
                onClick={() => pinColor(activeColor)}
                className="text-[9px] font-bold uppercase text-primary hover:text-primary-focus transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded border border-white/5 hover:border-white/10"
                title="Pin active color"
              >
                + Pin Active
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {pinnedColors.map(color => {
                const isActive = activeColor.toLowerCase() === color.toLowerCase();
                return (
                  <div key={color} className="relative group/pin w-full aspect-square">
                    <button
                      onClick={() => handlePickColor(color)}
                      className={`w-full h-full rounded-lg border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                          : 'border-white/10 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    {pinnedColors.length > 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unpinColor(color);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity shadow cursor-pointer border border-black/25"
                        title="Remove from pinned"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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

        {/* Layer Opacity Slider */}
        {selectedAnn && (
          <div className="group/item mt-4">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Layer Opacity
              </label>
              <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                {Math.round((selectedAnn.opacity ?? 1) * 100)}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${(selectedAnn.opacity ?? 1) * 100}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((selectedAnn.opacity ?? 1) * 100)}
                onChange={e => {
                  const nextOpacity = Number(e.target.value) / 100;
                  setActiveOpacity?.(nextOpacity);
                  onUpdateTextProps?.({ opacity: nextOpacity });
                }}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>
        )}

        {/* Text Doodle Settings Panel */}
        {activeDrawTool === 'textPath' && (
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
                TEXT DOODLE SETTINGS
              </span>
            </div>

            {/* Doodle Wordings Input */}
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider block">
                Doodle Text
              </label>
              <input
                type="text"
                value={doodleText || ''}
                onChange={(e) => setDoodleText?.(e.target.value)}
                placeholder="e.g. peace in the air"
                className="w-full bg-white/[0.02] border border-white/10 focus:border-primary/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none tracking-wide transition-colors"
              />
              <p className="text-[8px] text-white/20 italic mt-0.5 leading-normal">
                💡 Drag on image to start doodling text!
              </p>
            </div>

            {/* Font Size slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">
                  Font Size
                </span>
                <span className="font-mono text-[10px] text-primary">{doodleFontSize}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                value={doodleFontSize || 18}
                onChange={(e) => setDoodleFontSize?.(Number(e.target.value))}
                className="w-full h-1 bg-white/5 rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Font Family select */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider block">
                Font Style
              </span>
              <select
                value={doodleFontFamily || 'Space Grotesk'}
                onChange={(e) => setDoodleFontFamily?.(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs tracking-wide text-white focus:outline-none cursor-pointer"
              >
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Pacifico">Pacifico</option>
                <option value="Caveat">Caveat</option>
                <option value="Satisfy">Satisfy</option>
                <option value="Bebas Neue">Bebas Neue</option>
                <option value="Helvetica">Arial / Sans</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
              </select>
            </div>

            {/* Show outline path guide */}
            <div className="flex items-center justify-between pt-1">
              <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider cursor-pointer select-none" htmlFor="showDoodleGuideCheck">
                Show Path Guide Line
              </label>
              <input
                id="showDoodleGuideCheck"
                type="checkbox"
                checked={showDoodleGuide !== false}
                onChange={(e) => setShowDoodleGuide?.(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Selected Text Layer Properties Panel */}
        {selectedAnn && selectedAnn.type === 'text' && (
          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
                TEXT PROPERTIES
              </span>
            </div>

            {/* Font Family Dropdown */}
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider block">FONT FAMILY</label>
              <select
                value={fontFamily || 'Space Grotesk'}
                onChange={(e) => {
                  setFontFamily?.(e.target.value);
                  onUpdateTextProps?.({ fontFamily: e.target.value });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs tracking-wide text-white focus:outline-none"
              >
                <option value="Arial">Arial</option>
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="Bebas Neue">Bebas Neue</option>
                <option value="Pacifico">Pacifico</option>
                <option value="Caveat">Caveat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Cinzel">Cinzel</option>
                <option value="Satisfy">Satisfy</option>
                <option value="Anton">Anton</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>

            {/* Font Size slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">Font Size</label>
                <span className="font-mono text-primary text-[10px] font-semibold">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                value={fontSize || 36}
                onChange={(e) => {
                  setFontSize?.(Number(e.target.value));
                  onUpdateTextProps?.({ fontSize: Number(e.target.value) });
                }}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Line Spacing (Line Height) slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">Line Height</label>
                <span className="font-mono text-primary text-[10px] font-semibold">{(lineHeight || 1.2).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={lineHeight || 1.2}
                onChange={(e) => {
                  setLineHeight?.(Number(e.target.value));
                  onUpdateTextProps?.({ lineHeight: Number(e.target.value) });
                }}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Letter Spacing slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">Letter Spacing</label>
                <span className="font-mono text-primary text-[10px] font-semibold">{letterSpacing || 0}px</span>
              </div>
              <input
                type="range"
                min="-4"
                max="24"
                step="1"
                value={letterSpacing || 0}
                onChange={(e) => {
                  setLetterSpacing?.(Number(e.target.value));
                  onUpdateTextProps?.({ letterSpacing: Number(e.target.value) });
                }}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Style & Align selection grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider block">STYLE</span>
                <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5">
                  <button
                    onClick={() => {
                      const next = fontWeight === 'bold' ? 'normal' : 'bold';
                      setWeight?.(next);
                      onUpdateTextProps?.({ fontWeight: next });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg text-[10px] transition cursor-pointer ${
                      fontWeight === 'bold' ? 'bg-white/10 text-white font-bold' : 'text-white/40 hover:text-white'
                    }`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const next = fontStyle === 'italic' ? 'normal' : 'italic';
                      setStyle?.(next);
                      onUpdateTextProps?.({ fontStyle: next });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg text-[10px] transition cursor-pointer ${
                      fontStyle === 'italic' ? 'bg-white/10 text-white italic' : 'text-white/40 hover:text-white'
                    }`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const next = textDecoration === 'underline' ? 'none' : 'underline';
                      setDecoration?.(next);
                      onUpdateTextProps?.({ textDecoration: next });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg text-[10px] transition cursor-pointer ${
                      textDecoration === 'underline' ? 'bg-white/10 text-white underline' : 'text-white/40 hover:text-white'
                    }`}
                    title="Underline"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider block">ALIGN</span>
                <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5">
                  <button
                    onClick={() => {
                      setTextAlign?.('left');
                      onUpdateTextProps?.({ textAlign: 'left' });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg transition cursor-pointer ${
                      textAlign === 'left' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTextAlign?.('center');
                      onUpdateTextProps?.({ textAlign: 'center' });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg transition cursor-pointer ${
                      textAlign === 'center' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTextAlign?.('right');
                      onUpdateTextProps?.({ textAlign: 'right' });
                    }}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg transition cursor-pointer ${
                      textAlign === 'right' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Annotations List */}
        <div className={`flex flex-col overflow-hidden transition-all duration-200 ${isLayersCollapsed ? 'h-auto min-h-0' : 'flex-1 min-h-[160px]'}`}>
          <button
            onClick={() => setIsLayersCollapsed(prev => !prev)}
            className="flex items-center justify-between w-full text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3 shrink-0 hover:text-white/60 transition-colors cursor-pointer text-left"
          >
            <span>Layers ({annotations.length})</span>
            {isLayersCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>

          {!isLayersCollapsed && (
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 bg-black/25 rounded-2xl max-h-[220px]">
              {annotations.length === 0 ? (
                <div className="w-full h-full min-h-[120px] flex items-center justify-center text-white/15 text-[10px] font-mono select-none">
                  No markup layers yet
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {annotations.map((ann, index) => {
                    const isVisible = ann.visible !== false;
                    return (
                      <div
                        key={ann.id}
                        className={`flex items-center justify-between p-2.5 px-3 hover:bg-white/[0.01] transition-all group ${
                          !isVisible ? 'bg-black/10' : ''
                        }`}
                      >
                        <div className={`flex items-center gap-2.5 min-w-0 transition-opacity ${!isVisible ? 'opacity-40' : ''}`}>
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                            style={{ backgroundColor: ann.color }}
                          />
                          <span className="text-xs text-white/70 font-semibold uppercase tracking-wider text-[10px]">
                            {index + 1}. {getToolLabel(ann.type)}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${isVisible ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} transition-all`}>
                          <button
                            onClick={() => handleToggleVisibility(ann.id)}
                            className={`p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
                              isVisible ? 'text-white/20 hover:text-white' : 'text-white/60 hover:text-white'
                            }`}
                            title={isVisible ? "Hide layer" : "Show layer"}
                          >
                            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="p-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete layer"
                          >
                            <Eraser size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

