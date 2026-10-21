/**
 * LassoPreviewSection.tsx
 * Preview mode selector (Ants, Rubylith, B&W) and quick actions (Select All, Invert Mask).
 */

import React from 'react';
import { Maximize2, CheckCircle2 } from 'lucide-react';
import { LassoState, MaskPreviewMode } from '../lassoEngine';

interface LassoPreviewSectionProps {
  state: LassoState;
  update: (patch: Partial<LassoState>) => void;
  handleSelectAll: () => void;
  handleInvert: () => void;
}

export const LassoPreviewSection: React.FC<LassoPreviewSectionProps> = ({
  state,
  update,
  handleSelectAll,
  handleInvert,
}) => {
  return (
    <div className="space-y-3 pt-1">
      {/* Preview Mode Selector Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { id: 'ants', label: 'Ants' },
            { id: 'overlay', label: 'Rubylith' },
            { id: 'bw', label: 'B & W' },
          ] as const
        ).map(p => {
          const isSelected = state.previewMode === p.id;
          return (
            <button
              key={p.id}
              onClick={() => update({ previewMode: p.id as MaskPreviewMode })}
              className={`editor-btn editor-chip-btn ${
                isSelected ? 'active' : ''
              } py-1.5 px-2 text-[10px] font-bold uppercase`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Quick Actions (Select All / Invert) */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          onClick={handleSelectAll}
          className="py-2 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
        >
          <Maximize2 size={11} /> Select All
        </button>
        <button
          onClick={handleInvert}
          disabled={!state.hasActiveMask}
          className="py-2 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 active:scale-[0.98]"
        >
          <CheckCircle2 size={11} /> Invert Mask
        </button>
      </div>
    </div>
  );
};

