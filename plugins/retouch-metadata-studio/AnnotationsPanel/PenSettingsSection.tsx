/**
 * PenSettingsSection.tsx
 * Settings section for the Pen (freehand) tool — stroke style, close & fill,
 * fill opacity, and arrow end. Mirrors the Shape Fill Properties panel styling.
 */

import React from 'react';
import { Pen, CircleDot, Slash } from 'lucide-react';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';
import { Annotation, PenSettings, PenStrokeStyle } from './types';

interface PenSettingsSectionProps {
  settings: PenSettings;
  onChange: (next: Partial<PenSettings>) => void;
  /** When a freehand stroke is selected, changes are also applied to it */
  selectedFreehand?: Annotation | null;
  onUpdateSelected?: (updatedProps: Partial<Annotation>) => void;
}

const STYLE_OPTIONS: { id: PenStrokeStyle; label: string; icon: React.ReactNode }[] = [
  { id: 'solid', label: 'Solid', icon: <Pen size={13} strokeWidth={1.5} /> },
  { id: 'dashed', label: 'Dashed', icon: <Slash size={13} strokeWidth={1.5} /> },
  { id: 'dotted', label: 'Dotted', icon: <CircleDot size={13} strokeWidth={1.5} /> },
];

export const PenSettingsSection: React.FC<PenSettingsSectionProps> = ({
  settings,
  onChange,
  selectedFreehand,
  onUpdateSelected,
}) => {
  const apply = (patch: Partial<PenSettings>) => {
    onChange(patch);
    if (selectedFreehand && onUpdateSelected) {
      const annPatch: Partial<Annotation> = {};
      if (patch.style !== undefined) annPatch.penStyle = patch.style;
      if (patch.closeFill !== undefined) annPatch.closePath = patch.closeFill;
      if (patch.fillOpacity !== undefined) annPatch.fillOpacity = patch.fillOpacity;
      if (patch.arrowEnd !== undefined) annPatch.arrowEnd = patch.arrowEnd;
      onUpdateSelected(annPatch);
    }
  };

  return (
    <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 shadow-md">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
          PEN OPTIONS
          {selectedFreehand && (
            <span className="ml-1.5 text-[#22c55e] normal-case tracking-normal">· editing selected</span>
          )}
        </span>
      </div>

      {/* Stroke Style */}
      <div>
        <label className="text-[11px] font-medium text-zinc-400 select-none block mb-2">Stroke Style</label>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pen stroke style">
          {STYLE_OPTIONS.map(opt => {
            const active = settings.style === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => apply({ style: opt.id })}
                aria-pressed={active}
                title={`${opt.label} stroke`}
                className={`editor-btn flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[9px] font-semibold uppercase tracking-wider ${
                  active
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Close & Fill */}
      <div className="flex items-center justify-between">
        <label htmlFor="penCloseFillCheckbox" className="text-[11px] font-medium text-zinc-400 select-none cursor-pointer">
          Close &amp; Fill
        </label>
        <input
          id="penCloseFillCheckbox"
          type="checkbox"
          checked={settings.closeFill}
          onChange={(e) => apply({ closeFill: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* Fill Opacity */}
      {settings.closeFill && (
        <EditorSlider
          label="Fill Opacity"
          value={Math.round(settings.fillOpacity * 100)}
          onChange={(val) => apply({ fillOpacity: val / 100 })}
          min={0}
          max={100}
          defaultValue={50}
          unit="%"
        />
      )}

      {/* Arrow End */}
      <div className="flex items-center justify-between">
        <label htmlFor="penArrowEndCheckbox" className="text-[11px] font-medium text-zinc-400 select-none cursor-pointer">
          Arrow End
        </label>
        <input
          id="penArrowEndCheckbox"
          type="checkbox"
          checked={settings.arrowEnd}
          onChange={(e) => apply({ arrowEnd: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>
    </div>
  );
};
