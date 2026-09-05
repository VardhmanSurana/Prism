/**
 * PenSettingsSection.tsx
 * Comprehensive settings section for the Freehand Pen tool:
 * Stroke style (solid/dashed/dotted), calligraphic taper profiles, tactile textures (chalk, crayon, drybrush),
 * doodle wave patterns, directional arrowhead toggle, and close-path fill.
 */

import React from 'react';
import { Pen, CircleDot, Slash, ArrowRight } from 'lucide-react';
import { Annotation, PenSettings, PenStrokeStyle, LineTaper, LineTexture, DoodleLineStyle } from './types';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

interface PenSettingsSectionProps {
  settings: PenSettings;
  onChange: (next: Partial<PenSettings>) => void;
  /** When a freehand stroke is selected, changes are also applied to it */
  selectedFreehand?: Annotation | null;
  onUpdateSelected?: (updatedProps: Partial<Annotation>) => void;
}

const STYLE_OPTIONS: { id: PenStrokeStyle; label: string; icon: React.ReactNode }[] = [
  { id: 'solid', label: 'Solid', icon: <Pen size={12} strokeWidth={1.5} /> },
  { id: 'dashed', label: 'Dashed', icon: <Slash size={12} strokeWidth={1.5} /> },
  { id: 'dotted', label: 'Dotted', icon: <CircleDot size={12} strokeWidth={1.5} /> },
];

export const PenSettingsSection: React.FC<PenSettingsSectionProps> = ({
  settings,
  onChange,
  selectedFreehand,
  onUpdateSelected,
}) => {
  const curStyle = selectedFreehand ? (selectedFreehand.penStyle ?? 'solid') : settings.style;
  const curTaper = selectedFreehand ? (selectedFreehand.lineTaper ?? 'none') : (settings.taper ?? 'none');
  const curTexture = selectedFreehand ? (selectedFreehand.lineTexture ?? 'none') : (settings.texture ?? 'none');
  const curDoodle = selectedFreehand ? selectedFreehand.doodleLineStyle : settings.doodleStyle;
  const curArrowEnd = selectedFreehand ? (selectedFreehand.arrowEnd ?? false) : settings.arrowEnd;
  const curCloseFill = selectedFreehand ? (selectedFreehand.closePath ?? false) : settings.closeFill;
  const curFillOpacity = selectedFreehand ? Math.round((selectedFreehand.fillOpacity ?? 0.5) * 100) : Math.round(settings.fillOpacity * 100);

  const apply = (patch: Partial<PenSettings>) => {
    onChange(patch);
    if (selectedFreehand && onUpdateSelected) {
      const annPatch: Partial<Annotation> = {};
      if (patch.style !== undefined) annPatch.penStyle = patch.style;
      if (patch.taper !== undefined) annPatch.lineTaper = patch.taper;
      if (patch.texture !== undefined) annPatch.lineTexture = patch.texture;
      if (patch.doodleStyle !== undefined) annPatch.doodleLineStyle = patch.doodleStyle;
      if (patch.arrowEnd !== undefined) annPatch.arrowEnd = patch.arrowEnd;
      if (patch.closeFill !== undefined) annPatch.closePath = patch.closeFill;
      if (patch.fillOpacity !== undefined) annPatch.fillOpacity = patch.fillOpacity;
      onUpdateSelected(annPatch);
    }
  };

  return (
    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-3 shadow-md">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
            Pen Options
            {selectedFreehand && (
              <span className="ml-1.5 text-[#22c55e] normal-case tracking-normal">· editing selected</span>
            )}
          </span>
        </div>
        {/* Quick Arrowhead toggle */}
        <button
          type="button"
          onClick={() => apply({ arrowEnd: !curArrowEnd })}
          title="Toggle arrowhead at stroke end"
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors cursor-pointer border ${
            curArrowEnd
              ? 'bg-primary/20 border-primary text-primary font-bold'
              : 'bg-white/[0.03] border-white/5 text-white/50 hover:text-white hover:border-white/10'
          }`}
        >
          <ArrowRight size={10} />
          <span>Arrow</span>
        </button>
      </div>

      {/* 1. Stroke Style */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-white/50">Stroke Style</div>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Pen stroke style">
          {STYLE_OPTIONS.map(opt => {
            const active = curStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => apply({ style: opt.id })}
                className={`flex items-center justify-center gap-1.5 h-7 rounded-lg text-[10px] font-medium border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                  active
                    ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Calligraphic Stroke Taper */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-white/50">Stroke Taper</div>
        <div role="radiogroup" aria-label="Stroke Taper" className="grid grid-cols-5 gap-1">
          {[
            {
              id: 'none' as LineTaper,
              label: 'Uniform',
              title: 'Uniform: constant stroke width',
              svg: <line x1="3" y1="7" x2="23" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />,
            },
            {
              id: 'hand' as LineTaper,
              label: 'Brush',
              title: 'Hand Brush: calligraphic pressure swell and organic taper',
              svg: <path d="M 3 7 Q 8 3.8, 14 3.8 Q 20 3.8, 23 6.5 Q 20 9.8, 14 9.8 Q 8 9.8, 3 7 Z" fill="currentColor" />,
            },
            {
              id: 'taperStart' as LineTaper,
              label: 'Needle',
              title: 'Needle: fine entry expanding to thick body',
              svg: <path d="M 3 7 L 23 3.5 L 23 10.5 Z" fill="currentColor" />,
            },
            {
              id: 'taperBoth' as LineTaper,
              label: 'Dual',
              title: 'Double Taper: pointed ends with weighted center',
              svg: <path d="M 3 7 Q 13 3.5, 23 7 Q 13 10.5, 3 7 Z" fill="currentColor" />,
            },
            {
              id: 'dynamic' as LineTaper,
              label: 'Pulse',
              title: 'Dynamic Pulse: organic undulating rhythm',
              svg: <path d="M 3 7 Q 8 3.5, 13 7 Q 18 10.5, 23 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />,
            },
          ].map((t) => {
            const isActive = curTaper === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                title={t.title}
                onClick={() => apply({ taper: t.id })}
                className={`flex flex-col items-center justify-center h-10 py-1 px-0.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                  isActive
                    ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <svg width="26" height="14" viewBox="0 0 26 14" className="overflow-visible">
                  {t.svg}
                </svg>
                <span className="text-[9px] font-medium tracking-tight mt-0.5 truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Texture Effects */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-white/50">Texture Effect</div>
        <div role="radiogroup" aria-label="Texture Effect" className="grid grid-cols-4 gap-1">
          {[
            { id: 'none' as LineTexture, label: 'Smooth', title: 'Smooth vector stroke' },
            { id: 'chalk' as LineTexture, label: 'Chalk', title: 'Chalk: porous paper grain and chalk tooth' },
            { id: 'crayon' as LineTexture, label: 'Crayon', title: 'Crayon: rough wax laydown' },
            { id: 'drybrush' as LineTexture, label: 'Bristle', title: 'Drybrush: directional bristle drag' },
          ].map((tex) => {
            const isActive = curTexture === tex.id;
            return (
              <button
                key={tex.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                title={tex.title}
                onClick={() => apply({ texture: tex.id })}
                className={`flex items-center justify-center h-7 px-1.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-center cursor-pointer ${
                  isActive
                    ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <span className="text-[10px] font-medium whitespace-nowrap">{tex.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Pattern Overlays */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-white/50">Pattern Wave</div>
        <div role="radiogroup" aria-label="Pattern Wave" className="grid grid-cols-4 gap-1">
          {[
            { id: undefined, label: 'None', path: 'M3 7 H21' },
            { id: 'wave' as DoodleLineStyle, label: 'Wave', path: 'M3 7 Q6 3 9 7 T15 7 T21 7' },
            { id: 'zigzag' as DoodleLineStyle, label: 'Zigzag', path: 'M3 7 L6 3 L10 11 L14 3 L18 11 L21 7' },
            { id: 'sketch' as DoodleLineStyle, label: 'Sketch', path: 'M3 7 Q6 5 10 8 T16 6 T21 7' },
            { id: 'ripple' as DoodleLineStyle, label: 'Ripple', path: 'M3 7 Q6 5 8 7 T13 7 T18 7 T21 7' },
            { id: 'arc' as DoodleLineStyle, label: 'Arc', path: 'M3 9 Q12 2 21 9' },
            { id: 'sCurve' as DoodleLineStyle, label: 'S-Curve', path: 'M3 9 Q7 4 12 7 T21 5' },
            { id: 'loop' as DoodleLineStyle, label: 'Loop', path: 'M3 7 C6 2 9 2 9 7 C9 12 12 12 15 7 C17 3 19 5 21 7' },
          ].map((s) => {
            const isActive = curDoodle === s.id;
            return (
              <button
                key={s.label}
                type="button"
                role="radio"
                aria-checked={isActive}
                title={s.label}
                onClick={() => apply({ doodleStyle: s.id })}
                className={`flex flex-col items-center justify-center h-11 py-1 px-0.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                  isActive
                    ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <svg width="24" height="12" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d={s.path} />
                </svg>
                <span className="text-[9px] font-medium tracking-tight mt-0.5 whitespace-nowrap truncate max-w-full px-0.5">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Closed Shape & Fill */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        <div className="flex items-center justify-between">
          <label htmlFor="penCloseFillCheck" className="text-[11px] font-medium text-white/60 select-none cursor-pointer">
            Close & Fill Shape
          </label>
          <input
            id="penCloseFillCheck"
            type="checkbox"
            checked={curCloseFill}
            onChange={(e) => apply({ closeFill: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        {curCloseFill && (
          <EditorSlider
            label="Fill Opacity"
            value={curFillOpacity}
            onChange={(val) => apply({ fillOpacity: val / 100 })}
            min={0}
            max={100}
            defaultValue={50}
            unit="%"
          />
        )}
      </div>
    </div>
  );
};

