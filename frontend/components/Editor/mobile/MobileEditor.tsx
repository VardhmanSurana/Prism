import React, { useState, useMemo } from 'react';
import { ArrowLeft, Undo2, Redo2, RotateCcw, Check, Sun, Contrast, Sliders, Sparkles, Eye, Flame, Droplets, Focus, Disc } from 'lucide-react';
import type { Photo } from '@/types';
import { photoSrc } from '@/constants';

interface MobileEditorProps {
  photo: Photo;
  onClose: () => void;
  onSave?: (adjustments: Record<string, number>) => void;
}

interface ToolDef {
  id: string;
  label: string;
  icon: React.ElementType;
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
}

const MOBILE_TOOLS: ToolDef[] = [
  { id: 'exposure', label: 'Exposure', icon: Sun, min: -100, max: 100, defaultValue: 0 },
  { id: 'brightness', label: 'Brightness', icon: Sparkles, min: -100, max: 100, defaultValue: 0 },
  { id: 'contrast', label: 'Contrast', icon: Contrast, min: -100, max: 100, defaultValue: 0 },
  { id: 'highlights', label: 'Highlights', icon: Eye, min: -100, max: 100, defaultValue: 0 },
  { id: 'shadows', label: 'Shadows', icon: Sliders, min: -100, max: 100, defaultValue: 0 },
  { id: 'saturation', label: 'Saturation', icon: Droplets, min: -100, max: 100, defaultValue: 0 },
  { id: 'temperature', label: 'Warmth', icon: Flame, min: -100, max: 100, defaultValue: 0 },
  { id: 'sharpness', label: 'Sharpness', icon: Focus, min: 0, max: 100, defaultValue: 0 },
  { id: 'vignette', label: 'Vignette', icon: Disc, min: 0, max: 100, defaultValue: 0 },
];

export const MobileEditor: React.FC<MobileEditorProps> = ({ photo, onClose, onSave }) => {
  const [activeToolId, setActiveToolId] = useState<string>('exposure');
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => ({
    exposure: 0,
    brightness: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    sharpness: 0,
    vignette: 0,
  }));

  const [history, setHistory] = useState<Record<string, number>[]>([adjustments]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const activeTool = useMemo(
    () => MOBILE_TOOLS.find((t) => t.id === activeToolId) || MOBILE_TOOLS[0],
    [activeToolId]
  );

  const currentValue = adjustments[activeTool.id] ?? activeTool.defaultValue;

  const handleSliderChange = (val: number) => {
    const next = { ...adjustments, [activeTool.id]: val };
    setAdjustments(next);
  };

  const handleSliderCommit = (val: number) => {
    const next = { ...adjustments, [activeTool.id]: val };
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(next);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAdjustments(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAdjustments(history[historyIndex + 1]);
    }
  };

  const handleReset = () => {
    const resetValues: Record<string, number> = {};
    MOBILE_TOOLS.forEach((t) => {
      resetValues[t.id] = t.defaultValue;
    });
    setAdjustments(resetValues);
    setHistory([resetValues]);
    setHistoryIndex(0);
  };

  // Preview CSS filter simulation
  const previewFilter = useMemo(() => {
    const b = 1 + (adjustments.brightness || 0) / 100;
    const c = 1 + (adjustments.contrast || 0) / 100;
    const s = 1 + (adjustments.saturation || 0) / 100;
    const exp = 1 + (adjustments.exposure || 0) / 100;
    return `brightness(${b * exp}) contrast(${c}) saturate(${s})`;
  }, [adjustments]);

  return (
    <div className="fixed inset-0 z-50 bg-[#07080c] flex flex-col select-none overflow-hidden font-sans">
      {/* ── Top Navigation Bar ── */}
      <header className="h-14 pt-safe px-4 flex items-center justify-between border-b border-white/10 bg-[#0e1017]/90 backdrop-blur-xl shrink-0 z-10">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-gray-400 hover:text-white rounded-full transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Cancel</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-full transition-colors"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-full transition-colors"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
            title="Reset All"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <button
          onClick={() => {
            onSave?.(adjustments);
            onClose();
          }}
          className="px-3 py-1.5 bg-[#FCBC00] hover:bg-[#FCBC00]/90 active:scale-95 text-black font-semibold text-xs rounded-full flex items-center gap-1 shadow-lg shadow-[#FCBC00]/20 transition-all"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>Save</span>
        </button>
      </header>

      {/* ── Photo Canvas Viewport ── */}
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden">
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <img
            src={photoSrc(photo)}
            alt={photo.filename}
            style={{ filter: previewFilter }}
            className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl transition-all duration-75"
          />
        </div>
      </div>

      {/* ── Bottom Controls Sheet (Thumb Zone) ── */}
      <div className="bg-[#0e1017]/95 backdrop-blur-2xl border-t border-white/10 pb-safe shrink-0 flex flex-col">
        {/* Active Tool Slider (Thumb Zone) */}
        <div className="px-6 pt-4 pb-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>{activeTool.label}</span>
            <span
              onClick={() => {
                handleSliderChange(activeTool.defaultValue);
                handleSliderCommit(activeTool.defaultValue);
              }}
              className="px-2 py-0.5 rounded-md bg-white/5 text-white cursor-pointer active:scale-90 transition-transform font-mono"
            >
              {currentValue > 0 ? `+${currentValue}` : currentValue}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-500 font-mono w-6 text-right">
              {activeTool.min}
            </span>
            <input
              type="range"
              min={activeTool.min}
              max={activeTool.max}
              value={currentValue}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              onPointerUp={(e) => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FCBC00]"
            />
            <span className="text-[10px] text-gray-500 font-mono w-6">
              +{activeTool.max}
            </span>
          </div>
        </div>

        {/* Horizontal Tool Categories Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-t border-white/5">
          {MOBILE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = tool.id === activeToolId;
            const isEdited = (adjustments[tool.id] ?? tool.defaultValue) !== tool.defaultValue;

            return (
              <button
                key={tool.id}
                onClick={() => setActiveToolId(tool.id)}
                className={`flex flex-col items-center gap-1.5 px-3.5 py-2 rounded-xl shrink-0 transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-[#FCBC00]/15 border border-[#FCBC00]/40 text-[#FCBC00]'
                    : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon size={18} strokeWidth={isSelected ? 2.2 : 1.8} />
                  {isEdited && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FCBC00] shadow-sm shadow-[#FCBC00]/60" />
                  )}
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
