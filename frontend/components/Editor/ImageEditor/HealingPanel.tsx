/**
 * HealingPanel.tsx
 * Sidebar panel for the Clone Stamp and Healing Brush tools.
 */

import React from 'react';
import { Stamp, Brush, RotateCcw, Lightbulb } from 'lucide-react';
import { HealingToolMode } from './HealingCanvas';

export interface HealingSettings {
  mode: HealingToolMode;
  brushSize: number;   // 5 - 200
  hardness: number;    // 0 - 100
  opacity: number;     // 10 - 100
}

export const DEFAULT_HEALING_SETTINGS: HealingSettings = {
  mode: 'clone-stamp',
  brushSize: 40,
  hardness: 70,
  opacity: 100,
};

interface HealingPanelProps {
  settings: HealingSettings;
  onSettingsChange: (s: HealingSettings) => void;
  onClearStrokes: () => void;
  hasStrokes: boolean;
}

export const HealingPanel: React.FC<HealingPanelProps> = ({
  settings,
  onSettingsChange,
  onClearStrokes,
  hasStrokes,
}) => {
  const update = (patch: Partial<HealingSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white">
      <style>{`
        .healing-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 2px; border-radius: 99px;
          outline: none; cursor: pointer;
          background: rgba(255,255,255,0.08);
        }
        .healing-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 11px; height: 11px;
          border-radius: 50%; background: #ccc; cursor: grab;
          border: 1px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          transition: transform 0.1s, background 0.1s;
        }
        .healing-slider::-webkit-slider-thumb:hover { transform: scale(1.2); background: #fff; }
      `}</style>

      {/* ── Mode selector ── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-2">Tool</p>
        <div className="grid grid-cols-3 gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
          {(
            [
              { id: 'clone-stamp', label: 'Clone' },
              { id: 'healing-brush', label: 'Heal' },
              { id: 'frequency-separation', label: 'Freq Sep' },
              { id: 'content-patch', label: 'Patch' },
              { id: 'dodge-burn', label: 'Dodge/Burn' },
            ] as const
          ).map(m => (
            <button
              key={m.id}
              onClick={() => update({ mode: m.id as HealingToolMode })}
              className={`py-1.5 px-1 text-center rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                settings.mode === m.id
                  ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode description */}
        <p className="text-[9px] text-white/40 mt-2 leading-relaxed">
          {settings.mode === 'clone-stamp' && 'Exactly copies pixels from source. Best for repeating patterns and textures.'}
          {settings.mode === 'healing-brush' && 'Blends sampled patch with destination texture for skin & organic surfaces.'}
          {settings.mode === 'frequency-separation' && 'Separates low-frequency color & high-frequency texture for skin smoothing.'}
          {settings.mode === 'content-patch' && 'Replaces target selection area with seamless Poisson gradient blending.'}
          {settings.mode === 'dodge-burn' && 'Selective non-destructive brush to lighten (Dodge) or darken (Burn) tonal zones.'}
        </p>
      </div>

      {/* ── Brush controls ── */}
      <div className="px-4 py-4 space-y-4 border-b border-white/5">
        {[
          { key: 'brushSize' as const, label: 'Brush Size', min: 5, max: 200, unit: 'px' },
          { key: 'hardness' as const,  label: 'Hardness',   min: 0, max: 100, unit: '%' },
          { key: 'opacity' as const,   label: 'Opacity',    min: 10, max: 100, unit: '%' },
        ].map(item => {
          const val = settings[item.key];
          const pct = ((val - item.min) / (item.max - item.min)) * 100;
          return (
            <div key={item.key} className="group/item">
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 select-none">
                  {item.label}
                </label>
                <span className="text-[11px] font-mono tabular-nums text-white/80">
                  {val}{item.unit}
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[2px] bg-white/10 rounded-full" />
                <div
                  className="absolute h-[2px] bg-white/60 rounded-full pointer-events-none"
                  style={{ width: `${pct}%` }}
                />
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  value={val}
                  onChange={e => update({ [item.key]: Number(e.target.value) })}
                  className="healing-slider"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Actions ── */}
      <div className="px-4 py-4 space-y-2">
        <button
          onClick={onClearStrokes}
          disabled={!hasStrokes}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-[11px] font-medium text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-default cursor-pointer"
        >
          <RotateCcw size={12} />
          Clear All Strokes
        </button>
      </div>

      {/* ── Instructions ── */}
      <div className="mx-4 mb-4 px-3 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <div className="flex items-start gap-2">
          <Lightbulb size={12} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-amber-400">How to use</p>
            <p className="text-[9px] text-white/40 leading-relaxed">
              1. <strong className="text-white/60">Alt+Click</strong> to set the source point (yellow circle)<br />
              2. <strong className="text-white/60">Click+Drag</strong> to paint over the area to fix<br />
              3. Use <strong className="text-white/60">[ ]</strong> to change brush size quickly
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 text-[9px] text-white/20 text-center">
        Changes are session-only overlays. Export to bake them into the image.
      </div>
    </div>
  );
};
