/**
 * LutPanel.tsx
 * 3D LUT (Look-Up Table) panel for the Image Editor sidebar.
 *
 * Features:
 *  - 10 built-in cinematic LUTs with live preview
 *  - Import custom .cube files
 *  - Export current LUT as .cube file
 *  - Opacity blend control
 *  - Category filter tabs
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Download, X, Check, ChevronDown,
  Film, Palette, Camera, Sparkles, Wand2,
} from 'lucide-react';
import { Adjustments, LutAdjustments } from './filterEngine';
import { BUILTIN_LUTS, parseCubeFile, getBuiltinLutData, exportToCubeFile } from './lutEngine';

interface LutPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cinematic: <Film size={11} />,
  vintage:   <Camera size={11} />,
  portrait:  <Sparkles size={11} />,
  creative:  <Palette size={11} />,
  bw:        <Wand2 size={11} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  all:       'All',
  cinematic: 'Cinema',
  vintage:   'Vintage',
  portrait:  'Portrait',
  creative:  'Creative',
  bw:        'B&W',
};

const CATEGORIES = ['all', 'cinematic', 'vintage', 'bw', 'portrait', 'creative'] as const;

export const LutPanel: React.FC<LutPanelProps> = ({ adjustments, onChange }) => {
  const lut = adjustments.lut || { builtinId: null, customData: null, opacity: 100 };
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeLutId = lut.builtinId;
  const hasCustom = !!lut.customData;
  const hasAnyLut = activeLutId !== null || hasCustom;

  const updateLut = useCallback((patch: Partial<LutAdjustments>) => {
    onChange({ ...adjustments, lut: { ...lut, ...patch } });
  }, [adjustments, lut, onChange]);

  const handleSelectBuiltin = useCallback((id: string) => {
    if (activeLutId === id && !hasCustom) {
      // Deselect
      onChange({ ...adjustments, lut: { builtinId: null, customData: null, opacity: lut.opacity } });
    } else {
      onChange({ ...adjustments, lut: { builtinId: id, customData: null, opacity: lut.opacity } });
    }
  }, [activeLutId, hasCustom, adjustments, lut, onChange]);

  const handleReset = useCallback(() => {
    onChange({ ...adjustments, lut: { builtinId: null, customData: null, opacity: 100 } });
  }, [adjustments, onChange]);

  const handleImportCube = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseCubeFile(text);
      if (!parsed) {
        setImportError('Invalid .cube file — check format and try again');
        return;
      }
      parsed.title = file.name.replace('.cube', '');
      onChange({ ...adjustments, lut: { builtinId: null, customData: parsed, opacity: lut.opacity } });
    } catch {
      setImportError('Failed to read file');
    }
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, [adjustments, lut, onChange]);

  const handleExportCube = useCallback(() => {
    const lutData = lut.customData || (lut.builtinId ? getBuiltinLutData(lut.builtinId) : null);
    if (!lutData) return;

    const cubeText = exportToCubeFile(lutData, lut.customData?.title || lut.builtinId || 'prism-lut');
    const blob = new Blob([cubeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lutData.title || 'prism-lut'}.cube`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lut]);

  const filteredLuts = activeCategory === 'all'
    ? BUILTIN_LUTS
    : BUILTIN_LUTS.filter(l => l.category === activeCategory);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white">
      <style>{`
        .lut-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          border-radius: 99px;
          outline: none;
          cursor: pointer;
          background: rgba(255,255,255,0.08);
        }
        .lut-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #ccc;
          cursor: grab;
          border: 1px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          transition: transform 0.1s ease, background 0.1s ease;
        }
        .lut-slider::-webkit-slider-thumb:hover { transform: scale(1.2); background: #fff; }
        .lut-card {
          position: relative;
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          border: 1.5px solid transparent;
          transition: all 0.15s ease;
          background: rgba(255,255,255,0.04);
        }
        .lut-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.07); }
        .lut-card.active { border-color: rgba(var(--color-primary), 0.6); background: rgba(var(--color-primary), 0.08); }
      `}</style>

      {/* ── Header actions ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-white/5">
        <div className="flex gap-2">
          {/* Import .cube */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import .cube LUT file"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <Upload size={11} />
            Import .cube
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".cube"
            className="hidden"
            onChange={handleImportCube}
          />

          {/* Export .cube */}
          {hasAnyLut && (
            <button
              onClick={handleExportCube}
              title="Export current LUT as .cube file"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white transition-all cursor-pointer"
            >
              <Download size={11} />
              Export
            </button>
          )}
        </div>

        {/* Reset */}
        {hasAnyLut && (
          <button
            onClick={handleReset}
            title="Remove LUT"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-red-400 transition-colors cursor-pointer"
          >
            <X size={11} />
            Remove
          </button>
        )}
      </div>

      {/* Import error */}
      {importError && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
          {importError}
        </div>
      )}

      {/* Custom imported LUT badge */}
      {hasCustom && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-primary">{lut.customData?.title || 'Custom LUT'}</div>
            <div className="text-[9px] text-white/30 mt-0.5">Custom imported • {lut.customData?.size}³ table</div>
          </div>
          <Check size={14} className="text-primary" />
        </div>
      )}

      {/* ── Opacity control ── */}
      {hasAnyLut && (
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[11px] font-medium text-white/50">Blend Strength</span>
            <span className="text-[11px] font-mono font-bold text-white/90">{lut.opacity}%</span>
          </div>
          <div className="relative h-4 flex items-center">
            <div className="absolute w-full h-[2px] bg-white/10 rounded-full" />
            <div
              className="absolute h-[2px] bg-primary/70 rounded-full pointer-events-none"
              style={{ width: `${lut.opacity}%` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={lut.opacity}
              onChange={e => updateLut({ opacity: Number(e.target.value) })}
              className="lut-slider"
            />
          </div>
        </div>
      )}

      {/* ── Category filter ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-white/30 hover:text-white/60 border border-transparent'
              }`}
            >
              {cat !== 'all' && CATEGORY_ICONS[cat]}
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* ── LUT grid ── */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {filteredLuts.map(builtinLut => {
          const isActive = activeLutId === builtinLut.id && !hasCustom;
          return (
            <button
              key={builtinLut.id}
              onClick={() => handleSelectBuiltin(builtinLut.id)}
              className={`lut-card text-left p-3 ${isActive ? 'active' : ''}`}
            >
              {/* Color preview swatches — derived from LUT's category palette */}
              <LutSwatch lutId={builtinLut.id} category={builtinLut.category} isActive={isActive} />

              <div className="mt-2">
                <div className={`text-[10px] font-bold truncate ${isActive ? 'text-primary' : 'text-white/80'}`}>
                  {builtinLut.name}
                </div>
                <div className="text-[9px] text-white/30 leading-tight mt-0.5 line-clamp-2">
                  {builtinLut.description}
                </div>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check size={9} className="text-black font-black" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 pb-6 text-[9px] text-white/20 text-center leading-relaxed">
        LUTs are applied non-destructively using Canvas2D pixel mapping.
        Import any standard .cube file for custom grades.
      </div>
    </div>
  );
};

// ── LUT Swatch component — visual color gradient representing each LUT ────────

const SWATCH_COLORS: Record<string, [string, string, string]> = {
  'golden-hour':    ['#1a2a3a', '#c87941', '#f5d89a'],
  'teal-orange':    ['#0d3040', '#667766', '#e8874a'],
  'matte-fade':     ['#3a3530', '#8a7a6a', '#d4c9b8'],
  'bleach-bypass':  ['#1a1a1a', '#555550', '#d8d8d0'],
  'film-print':     ['#1a1510', '#7a6050', '#e0c8a8'],
  'fuji-provia':    ['#0d1f2d', '#1a7a50', '#4ab0e8'],
  'noir':           ['#0a0a0a', '#505050', '#e0e0e0'],
  'emerald-city':   ['#0a1a0d', '#1a6a2a', '#a0d060'],
  'rose-gold':      ['#201015', '#b0607a', '#f0c8a8'],
  'arctic-blue':    ['#0a1020', '#204060', '#80b8e8'],
};

const LutSwatch: React.FC<{ lutId: string; category: string; isActive: boolean }> = ({ lutId }) => {
  const colors = SWATCH_COLORS[lutId] || ['#1a1a2e', '#4a4a6a', '#c8c8e8'];
  return (
    <div
      className="w-full h-8 rounded-md overflow-hidden"
      style={{
        background: `linear-gradient(to right, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
      }}
    />
  );
};
