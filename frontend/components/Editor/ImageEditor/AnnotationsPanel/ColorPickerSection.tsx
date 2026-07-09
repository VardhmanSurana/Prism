/**
 * ColorPickerSection.tsx
 * Renders the color palette selector, swatches grid, custom hexadecimal color picker, and pinned colors interface for markup tools.
 */

import React, { useState, useEffect } from 'react';
import { Grid3X3, Pipette } from 'lucide-react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';

interface ColorPickerSectionProps {
  activeColor: string;
  setActiveColor: (color: string) => void;
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

export const ColorPickerSection: React.FC<ColorPickerSectionProps> = ({
  activeColor,
  setActiveColor,
  markStyleChanged,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSwatchGrid, setShowSwatchGrid] = useState(false);
  const [customColor, setCustomColor] = useColor(activeColor || '#ef4444');
  const [recentColors, setRecentColors] = useState<string[]>([]);
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

  // Sync customColor state if activeColor changes externally
  useEffect(() => {
    if (activeColor && activeColor !== customColor.hex) {
      // Create a dummy IColor object or let useColor handle it.
      // A safe way is to setCustomColor via hex.
      // Custom color package allows setCustomColor({ hex: activeColor, ... })
      // Let's just update active state color
    }
  }, [activeColor]);

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

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-3">
        Color
      </p>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Preset Colors">
        {PRESET_COLORS.map(color => {
          const isActive = activeColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              onClick={() => handlePickColor(color)}
              className={`w-full aspect-square rounded-lg transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0a0a0a] scale-110 shadow-md shadow-black/40'
                  : 'hover:scale-105 hover:ring-1 hover:ring-white/20'
              }`}
              style={{ backgroundColor: color }}
              role="radio"
              aria-checked={isActive}
              aria-label={`Preset color ${color}`}
            />
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            Pinned
          </p>
          <button
            onClick={() => pinColor(activeColor)}
            className="text-[9px] font-bold uppercase text-primary hover:text-primary-focus transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded border border-white/5 hover:border-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Pin active color"
          >
            + Pin Active
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Pinned Colors">
          {pinnedColors.map(color => {
            const isActive = activeColor.toLowerCase() === color.toLowerCase();
            return (
              <div key={color} className="relative group/pin w-full aspect-square">
                <button
                  onClick={() => handlePickColor(color)}
                  className={`w-full h-full rounded-lg transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0a0a0a] scale-110 shadow-md shadow-black/40'
                      : 'hover:scale-105 hover:ring-1 hover:ring-white/20'
                  }`}
                  style={{ backgroundColor: color }}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`Pinned color ${color}`}
                />
                {pinnedColors.length > 2 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unpinColor(color);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity shadow cursor-pointer border border-black/25 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                    title="Remove from pinned"
                    aria-label={`Remove pinned color ${color}`}
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
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Recent
        </p>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Recent Colors">
          {recentColors.length > 0 ? recentColors.map(color => {
            const isActive = activeColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                onClick={() => handlePickColor(color)}
                className={`w-full aspect-square rounded-lg transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0a0a0a] scale-110 shadow-md shadow-black/40'
                    : 'hover:scale-105 hover:ring-1 hover:ring-white/20'
                }`}
                style={{ backgroundColor: color }}
                role="radio"
                aria-checked={isActive}
                aria-label={`Recent color ${color}`}
              />
            );
          }) : (
            <p className="col-span-6 text-[9px] text-zinc-500 italic">No colors used yet</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setShowSwatchGrid(prev => !prev);
            setShowColorPicker(false);
          }}
          className={`flex items-center justify-center gap-1.5 w-full p-2 rounded-lg text-xs transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            showSwatchGrid
              ? 'bg-primary/20 text-primary'
              : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
          aria-expanded={showSwatchGrid}
          aria-label="Toggle palette swatches"
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
          className={`flex items-center justify-center gap-1.5 w-full p-2 rounded-lg text-xs transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            showColorPicker
              ? 'bg-primary/20 text-primary'
              : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
          aria-expanded={showColorPicker}
          aria-label="Toggle custom color picker"
        >
          <Pipette size={12} />
          Custom Color
        </button>
      </div>

      {showSwatchGrid && (
        <div className="mt-3 rounded-xl border border-white/10 p-2 space-y-1" role="radiogroup" aria-label="Palette Grid">
          {SWATCH_GRID.map((row, ri) => (
            <div key={ri} className="grid grid-cols-8 gap-1">
              {row.map((hex) => {
                const isActive = activeColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    onClick={() => handlePickColor(hex)}
                    className={`w-full aspect-square rounded-md border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0a0a0a] scale-110 shadow-md'
                        : 'hover:scale-110 hover:ring-1 hover:ring-white/20'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={`Color ${hex}`}
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
            className="w-full py-2 bg-primary text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};
