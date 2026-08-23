/**
 * HealingPanel.tsx
 * Sidebar panel for Clone Stamp and Healing Brush tools.
 * Styled to match the unified Image Editor Studio design system.
 */

import React, { useState } from 'react';
import {
  Stamp,
  Brush,
  RotateCcw,
  Lightbulb,
  Sparkles,
  Layers,
  ChevronDown,
  Wand2,
  Sun,
} from 'lucide-react';
import { HealingToolMode, HealingSettings, DEFAULT_HEALING_SETTINGS } from './healingEngine';
import { EditorSlider } from './ui/EditorSlider';

export type { HealingToolMode, HealingSettings };

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
  const [openSections, setOpenSections] = useState({
    tool: true,
    brush: true,
    guide: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const update = (patch: Partial<HealingSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  return (
    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar text-white p-4 space-y-4 select-none">
      {/* ── Sub-header ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Texture & Retouch Studio
        </span>

        {hasStrokes && (
          <button
            onClick={onClearStrokes}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Clear all painted strokes"
          >
            <RotateCcw size={10} />
            Reset Strokes
          </button>
        )}
      </div>

      {/* ── 1. Tool Mode Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('tool')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Stamp size={11} className="text-primary" />
            <span>Retouch Tool</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.tool ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.tool && (
          <div className="space-y-2 pt-1">
            {/* Tool Selection Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'clone-stamp', label: 'Clone Stamp', icon: <Stamp size={11} /> },
                  { id: 'healing-brush', label: 'Spot Heal', icon: <Wand2 size={11} /> },
                  { id: 'frequency-separation', label: 'Freq Sep', icon: <Layers size={11} /> },
                  { id: 'content-patch', label: 'Patch Blend', icon: <Sparkles size={11} /> },
                  { id: 'dodge-burn', label: 'Dodge / Burn', icon: <Sun size={11} /> },
                ] as const
              ).map(m => {
                const isSelected = settings.mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => update({ mode: m.id as HealingToolMode })}
                    className={`editor-btn editor-chip-btn ${
                      isSelected ? 'active' : ''
                    } py-2 px-2 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 ${
                      m.id === 'dodge-burn' ? 'col-span-2' : ''
                    }`}
                  >
                    {m.icon}
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mode Description Pill */}
            <div className="p-2 rounded-lg bg-black/25 border border-white/5 text-[9px] text-white/50 leading-relaxed">
              {settings.mode === 'clone-stamp' &&
                'Alt+Click to sample reference pixels, then paint to copy exact texture.'}
              {settings.mode === 'healing-brush' &&
                'Smart spot healing seamlessly blends sampled texture with surrounding skin and surfaces.'}
              {settings.mode === 'frequency-separation' &&
                'Separates low-frequency color & high-frequency texture for skin smoothing.'}
              {settings.mode === 'content-patch' &&
                'Replaces target selection area with seamless Poisson gradient blending.'}
              {settings.mode === 'dodge-burn' &&
                'Paint locally to lighten (dodge) or darken (burn) luminance values non-destructively.'}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Brush Settings Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('brush')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Brush size={11} className="text-primary" />
            <span>Brush Dynamics</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.brush ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.brush && (
          <div className="space-y-3 pt-1">
            <EditorSlider
              label="Brush Size"
              value={settings.brushSize}
              onChange={val => update({ brushSize: val })}
              min={5}
              max={200}
              defaultValue={DEFAULT_HEALING_SETTINGS.brushSize}
              unit=" px"
            />

            <EditorSlider
              label="Edge Hardness"
              value={settings.hardness}
              onChange={val => update({ hardness: val })}
              min={0}
              max={100}
              defaultValue={DEFAULT_HEALING_SETTINGS.hardness}
              unit="%"
            />

            <EditorSlider
              label="Stroke Opacity"
              value={settings.opacity}
              onChange={val => update({ opacity: val })}
              min={10}
              max={100}
              defaultValue={DEFAULT_HEALING_SETTINGS.opacity}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* ── 3. Quick Action CTA ── */}
      <div className="space-y-2">
        <button
          onClick={onClearStrokes}
          disabled={!hasStrokes}
          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex items-center justify-center gap-2"
        >
          <RotateCcw size={12} />
          <span>Clear All Strokes</span>
        </button>
      </div>

      {/* ── 4. Instructions Guide Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-2">
        <div
          onClick={() => toggleSection('guide')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <Lightbulb size={11} className="text-amber-400" />
            <span>How to use</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.guide ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.guide && (
          <div className="space-y-1.5 pt-1 text-[9px] text-white/50 border-t border-white/5 leading-relaxed">
            <p>
              1. <strong className="text-white/80">Click</strong> anywhere on photo to set sample point (<strong className="text-white/80">Alt+Click</strong> to reset).
            </p>
            <p>
              2. <strong className="text-white/80">Click & Drag</strong> to paint and clone texture.
            </p>
            <p>
              3. Press <strong className="text-white/80">[ ]</strong> keys to dynamically resize brush.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
