/**
 * LiquifyPanel.tsx
 * Sidebar control panel for Mesh Displacement, Warp, Pucker, Bloat, and Face Reshaping.
 * Styled to match the unified Image Editor Studio design system.
 */

import React, { useState } from 'react';
import { Smile, RotateCcw, Move, ChevronDown, Sparkles, Wand2 } from 'lucide-react';
import {
  LiquifyToolMode,
  FaceLiquifySettings,
  LiquifySettings,
  DEFAULT_LIQUIFY_SETTINGS,
} from './liquifyEngine';
import { EditorSlider } from './ui/EditorSlider';

export type { LiquifyToolMode, FaceLiquifySettings, LiquifySettings };

interface LiquifyPanelProps {
  settings: LiquifySettings;
  onChange: (s: LiquifySettings) => void;
  onResetMesh: () => void;
}

/**
 * LiquifyPanel - Renders liquify panel.
 */
export const LiquifyPanel: React.FC<LiquifyPanelProps> = ({
  settings = DEFAULT_LIQUIFY_SETTINGS,
  onChange,
  onResetMesh,
}) => {
  const [openSections, setOpenSections] = useState({
    mesh: true,
    brush: true,
    face: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const update = (patch: Partial<LiquifySettings>) => onChange({ ...settings, ...patch });
  /**
   * updateFace - Performs update face.
   */
  const updateFace = (patch: Partial<FaceLiquifySettings>) =>
    onChange({ ...settings, face: { ...settings.face, ...patch } });

  const hasChanges =
    settings.brushSize !== DEFAULT_LIQUIFY_SETTINGS.brushSize ||
    settings.pressure !== DEFAULT_LIQUIFY_SETTINGS.pressure ||
    settings.face.eyeSize !== 0 ||
    settings.face.eyeDistance !== 0 ||
    settings.face.noseWidth !== 0 ||
    settings.face.lipHeight !== 0 ||
    settings.face.chinShape !== 0;

  return (
    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar text-white p-4 space-y-4 select-none">
      {/* ── Sub-header ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Mesh Warp & Face Studio
        </span>

        {hasChanges && (
          <button
            onClick={onResetMesh}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Reset All Mesh Warps"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* ── 1. Mesh Tool Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('mesh')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Move size={11} className="text-primary" />
            <span>Mesh Tool Mode</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.mesh ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.mesh && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'warp', label: 'Warp' },
                  { id: 'pucker', label: 'Pucker' },
                  { id: 'bloat', label: 'Bloat' },
                  { id: 'smooth', label: 'Smooth' },
                  { id: 'reconstruct', label: 'Restore' },
                ] as const
              ).map(tool => {
                const isSelected = settings.mode === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => update({ mode: tool.id as LiquifyToolMode })}
                    className={`editor-btn editor-chip-btn ${
                      isSelected ? 'active' : ''
                    } py-2 px-1 text-[10px] font-bold uppercase flex items-center justify-center`}
                  >
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Brush Dynamics Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('brush')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Sparkles size={11} className="text-primary" />
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
              min={10}
              max={250}
              defaultValue={50}
              unit=" px"
            />

            <EditorSlider
              label="Warp Pressure"
              value={settings.pressure}
              onChange={val => update({ pressure: val })}
              min={1}
              max={100}
              defaultValue={50}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* ── 3. Face Retouch Sliders Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('face')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Smile size={11} className="text-primary" />
            <span>Face-Aware Reshape</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.face ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.face && (
          <div className="space-y-3 pt-1">
            {(
              [
                { key: 'eyeSize' as const, label: 'Eye Size' },
                { key: 'eyeDistance' as const, label: 'Eye Distance' },
                { key: 'noseWidth' as const, label: 'Nose Width' },
                { key: 'lipHeight' as const, label: 'Lip Height' },
                { key: 'chinShape' as const, label: 'Chin Shape' },
              ] as const
            ).map(f => (
              <EditorSlider
                key={f.key}
                label={f.label}
                value={settings.face[f.key]}
                onChange={val => updateFace({ [f.key]: val })}
                min={-100}
                max={100}
                defaultValue={0}
                bipolar
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Reset Action CTA ── */}
      <div className="space-y-2">
        <button
          onClick={onResetMesh}
          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <RotateCcw size={12} />
          <span>Reset Liquify Mesh</span>
        </button>
      </div>
    </div>
  );
};
