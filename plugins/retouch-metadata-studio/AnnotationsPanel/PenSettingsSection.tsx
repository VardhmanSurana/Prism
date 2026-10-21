/**
 * PenSettingsSection.tsx
 * Comprehensive settings section for the Freehand Pen tool:
 * Stroke style (solid/dashed/dotted), calligraphic taper profiles, tactile textures (chalk, crayon, drybrush),
 * directional arrowhead toggle, and close-path fill.
 */

import React, { useState } from 'react';
import {
  Pen,
  CircleDot,
  Slash,
  ArrowRight,
  ChevronDown,
  Sparkles,
  RotateCcw,
  Pencil,
  Palette,
  Droplets,
  Feather,
  Paintbrush,
} from 'lucide-react';
import { Annotation, PenSettings, PenStrokeStyle, LineTaper, BrushType } from './types';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';
import { ALL_BRUSHES } from './BrushesPalette';
import {
  CHALK_PRESETS,
  CRAYON_PRESETS,
  DRYBRUSH_PRESETS,
  WATERCOLOR_PRESETS,
  CALLIGRAPHY_PRESETS,
} from './brushUtils';

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
  const [isBrushPickerOpen, setIsBrushPickerOpen] = useState(false);
  const curBrushType: BrushType = selectedFreehand?.brushType ?? settings.brushType ?? 'brush';
  const activeBrushMeta = ALL_BRUSHES.find(b => b.id === curBrushType) || ALL_BRUSHES[0];
  const ActiveBrushIcon = activeBrushMeta.icon;

  const curStyle = selectedFreehand ? (selectedFreehand.penStyle ?? 'solid') : settings.style;
  const curTaper = selectedFreehand ? (selectedFreehand.lineTaper ?? 'none') : (settings.taper ?? 'none');
  const curArrowEnd = selectedFreehand ? (selectedFreehand.arrowEnd ?? false) : settings.arrowEnd;
  const curCloseFill = selectedFreehand ? (selectedFreehand.closePath ?? false) : settings.closeFill;
  const curFillOpacity = selectedFreehand ? Math.round((selectedFreehand.fillOpacity ?? 0.5) * 100) : Math.round(settings.fillOpacity * 100);

  // Chalk
  const curChalkPressure = selectedFreehand ? (selectedFreehand.chalkPressure ?? 60) : (settings.chalkPressure ?? 60);
  const curChalkGrain = selectedFreehand ? (selectedFreehand.chalkGrain ?? 50) : (settings.chalkGrain ?? 50);
  const curChalkRoughness = selectedFreehand ? (selectedFreehand.chalkRoughness ?? 50) : (settings.chalkRoughness ?? 50);

  // Crayon
  const curCrayonDensity = selectedFreehand ? (selectedFreehand.crayonDensity ?? 50) : (settings.crayonDensity ?? 50);
  const curCrayonGrain = selectedFreehand ? (selectedFreehand.crayonGrain ?? 50) : (settings.crayonGrain ?? 50);
  const curCrayonRoughness = selectedFreehand ? (selectedFreehand.crayonRoughness ?? 50) : (settings.crayonRoughness ?? 50);

  // Drybrush & Oil
  const curDrybrushDensity = selectedFreehand ? (selectedFreehand.drybrushDensity ?? 50) : (settings.drybrushDensity ?? 50);
  const curDrybrushStreaks = selectedFreehand ? (selectedFreehand.drybrushStreaks ?? 50) : (settings.drybrushStreaks ?? 50);
  const curDrybrushRoughness = selectedFreehand ? (selectedFreehand.drybrushRoughness ?? 50) : (settings.drybrushRoughness ?? 50);

  // Watercolor
  const curWatercolorBleed = selectedFreehand ? (selectedFreehand.watercolorBleed ?? 50) : (settings.watercolorBleed ?? 50);
  const curWatercolorSpread = selectedFreehand ? (selectedFreehand.watercolorSpread ?? 50) : (settings.watercolorSpread ?? 50);
  const curWatercolorWetness = selectedFreehand ? (selectedFreehand.watercolorWetness ?? 50) : (settings.watercolorWetness ?? 50);

  // Calligraphy
  const defaultAngle = curBrushType === 'calligraphy2' ? -45 : 45;
  const curNibAngle = selectedFreehand ? (selectedFreehand.nibAngle ?? defaultAngle) : (settings.nibAngle ?? defaultAngle);
  const curNibWeight = selectedFreehand ? (selectedFreehand.nibWeight ?? 50) : (settings.nibWeight ?? 50);

  // Paint Brush / Soft edge
  const curBrushFeather = selectedFreehand ? (selectedFreehand.brushFeather ?? 0) : (settings.brushFeather ?? 0);

  // Dash & Gap
  const curDashLength = selectedFreehand ? (selectedFreehand.dashLength ?? 5) : (settings.dashLength ?? 5);
  const curDashGap = selectedFreehand ? (selectedFreehand.dashGap ?? 4) : (settings.dashGap ?? 4);

  // Taper Dynamics
  const curTaperIntensity = selectedFreehand ? (selectedFreehand.taperIntensity ?? 50) : (settings.taperIntensity ?? 50);

  const apply = (patch: Partial<PenSettings>) => {
    onChange(patch);
    if (selectedFreehand && onUpdateSelected) {
      const annPatch: Partial<Annotation> = {};
      if (patch.style !== undefined) annPatch.penStyle = patch.style;
      if (patch.taper !== undefined) annPatch.lineTaper = patch.taper;
      if (patch.brushType !== undefined) annPatch.brushType = patch.brushType;
      if (patch.doodleStyle !== undefined) annPatch.doodleLineStyle = patch.doodleStyle;
      if (patch.arrowEnd !== undefined) annPatch.arrowEnd = patch.arrowEnd;
      if (patch.closeFill !== undefined) annPatch.closePath = patch.closeFill;
      if (patch.fillOpacity !== undefined) annPatch.fillOpacity = patch.fillOpacity;
      if (patch.chalkPressure !== undefined) annPatch.chalkPressure = patch.chalkPressure;
      if (patch.chalkGrain !== undefined) annPatch.chalkGrain = patch.chalkGrain;
      if (patch.chalkRoughness !== undefined) annPatch.chalkRoughness = patch.chalkRoughness;
      if (patch.crayonDensity !== undefined) annPatch.crayonDensity = patch.crayonDensity;
      if (patch.crayonGrain !== undefined) annPatch.crayonGrain = patch.crayonGrain;
      if (patch.crayonRoughness !== undefined) annPatch.crayonRoughness = patch.crayonRoughness;
      if (patch.drybrushDensity !== undefined) annPatch.drybrushDensity = patch.drybrushDensity;
      if (patch.drybrushStreaks !== undefined) annPatch.drybrushStreaks = patch.drybrushStreaks;
      if (patch.drybrushRoughness !== undefined) annPatch.drybrushRoughness = patch.drybrushRoughness;
      if (patch.watercolorBleed !== undefined) annPatch.watercolorBleed = patch.watercolorBleed;
      if (patch.watercolorSpread !== undefined) annPatch.watercolorSpread = patch.watercolorSpread;
      if (patch.watercolorWetness !== undefined) annPatch.watercolorWetness = patch.watercolorWetness;
      if (patch.nibAngle !== undefined) annPatch.nibAngle = patch.nibAngle;
      if (patch.nibWeight !== undefined) annPatch.nibWeight = patch.nibWeight;
      if (patch.dashLength !== undefined) annPatch.dashLength = patch.dashLength;
      if (patch.dashGap !== undefined) annPatch.dashGap = patch.dashGap;
      if (patch.taperIntensity !== undefined) annPatch.taperIntensity = patch.taperIntensity;
      if (patch.brushFeather !== undefined) annPatch.brushFeather = patch.brushFeather;
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
        {curStyle === 'dashed' && (
          <div className="pt-1.5 space-y-1.5 animate-in fade-in duration-100">
            <EditorSlider
              label="Dash Length"
              value={curDashLength}
              onChange={(val) => apply({ dashLength: val })}
              min={1}
              max={20}
              defaultValue={5}
              unit="x"
            />
            <EditorSlider
              label="Dash Spacing / Gap"
              value={curDashGap}
              onChange={(val) => apply({ dashGap: val })}
              min={1}
              max={20}
              defaultValue={4}
              unit="x"
            />
          </div>
        )}
        {curStyle === 'dotted' && (
          <div className="pt-1.5 space-y-1.5 animate-in fade-in duration-100">
            <EditorSlider
              label="Dot Spacing"
              value={curDashGap}
              onChange={(val) => apply({ dashGap: val })}
              min={1}
              max={20}
              defaultValue={4}
              unit="x"
            />
          </div>
        )}
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
        {curTaper !== 'none' && (
          <div className="pt-1.5 animate-in fade-in duration-100">
            <EditorSlider
              label="Taper Swell Factor"
              value={curTaperIntensity}
              onChange={(val) => apply({ taperIntensity: val })}
              min={10}
              max={100}
              defaultValue={50}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* Current Active Brush Selector (from the bigger MS Paint Brushes list) */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-white/50">Brush Type</div>
        <button
          type="button"
          onClick={() => setIsBrushPickerOpen(prev => !prev)}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all text-left cursor-pointer group overflow-hidden"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-white text-zinc-950 shadow-sm shrink-0">
              <ActiveBrushIcon size={13} className="stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-white leading-tight truncate">
                {activeBrushMeta.name}
              </div>
              <div className="text-[8px] text-zinc-400 truncate leading-tight mt-0.5">
                {activeBrushMeta.description}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 group-hover:text-white shrink-0 ml-1.5">
            <span className="text-[8px] font-medium">Change</span>
            <ChevronDown size={11} className={`transition-transform duration-150 ${isBrushPickerOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isBrushPickerOpen && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-black/30 rounded-xl border border-white/5 max-h-[220px] overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
            {ALL_BRUSHES.map(b => {
              const Icon = b.icon;
              const isSel = curBrushType === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    apply({ brushType: b.id });
                    setIsBrushPickerOpen(false);
                  }}
                  title={`${b.name} — ${b.description}`}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSel
                      ? 'bg-white/15 border-white/40 text-white font-bold shadow-sm ring-1 ring-white/20'
                      : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className={`p-1 rounded shrink-0 ${isSel ? 'bg-white text-zinc-950' : 'bg-white/5 text-zinc-400'}`}>
                    <Icon size={11} className={isSel ? 'stroke-[2.2]' : 'stroke-[1.6]'} />
                  </div>
                  <span className="text-[9px] truncate font-medium">{b.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chalk Variables Panel (active when Chalk is selected) */}
      {curBrushType === 'chalk' && (
        <div className="p-2.5 bg-amber-500/[0.04] border border-amber-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/10">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-amber-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-300">
                Chalk Variables
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ chalkPressure: 60, chalkGrain: 50, chalkRoughness: 50 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset chalk sliders to standard defaults"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <div className="text-[9px] font-medium text-zinc-400">Presets</div>
            <div className="grid grid-cols-3 gap-1">
              {CHALK_PRESETS.map((preset) => {
                const isActive =
                  curChalkPressure === preset.pressure &&
                  curChalkGrain === preset.grain &&
                  curChalkRoughness === preset.roughness;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      apply({
                        chalkPressure: preset.pressure,
                        chalkGrain: preset.grain,
                        chalkRoughness: preset.roughness,
                      })
                    }
                    title={preset.description}
                    className={`px-1 py-1 rounded-lg text-[8.5px] font-medium border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 font-bold shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-0.5">
            <div>
              <EditorSlider
                label="Pressure / Tooth"
                value={curChalkPressure}
                onChange={(val) => apply({ chalkPressure: val })}
                min={0}
                max={100}
                defaultValue={60}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Coverage density: light tooth gap ↔ dense coverage
              </div>
            </div>

            <div>
              <EditorSlider
                label="Grain Fineness"
                value={curChalkGrain}
                onChange={(val) => apply({ chalkGrain: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Chunky sidewalk grit ↔ powdery blackboard dust
              </div>
            </div>

            <div>
              <EditorSlider
                label="Edge Crumble"
                value={curChalkRoughness}
                onChange={(val) => apply({ chalkRoughness: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Border roughness & chalk edge displacement
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crayon Variables Panel (active when Crayon is selected) */}
      {curBrushType === 'crayon' && (
        <div className="p-2.5 bg-amber-500/[0.04] border border-amber-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/10">
            <div className="flex items-center gap-1.5">
              <Pencil size={11} className="text-amber-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-300">
                Crayon Variables
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ crayonDensity: 50, crayonGrain: 50, crayonRoughness: 50 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset crayon sliders to standard defaults"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <div className="text-[9px] font-medium text-zinc-400">Presets</div>
            <div className="grid grid-cols-3 gap-1">
              {CRAYON_PRESETS.map((preset) => {
                const isActive =
                  curCrayonDensity === preset.density &&
                  curCrayonGrain === preset.grain &&
                  curCrayonRoughness === preset.roughness;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      apply({
                        crayonDensity: preset.density,
                        crayonGrain: preset.grain,
                        crayonRoughness: preset.roughness,
                      })
                    }
                    title={preset.description}
                    className={`px-1 py-1 rounded-lg text-[8.5px] font-medium border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 font-bold shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-0.5">
            <div>
              <EditorSlider
                label="Wax Density / Pressure"
                value={curCrayonDensity}
                onChange={(val) => apply({ crayonDensity: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Light wax grain ↔ rich opaque wax laydown
              </div>
            </div>

            <div>
              <EditorSlider
                label="Texture Grain"
                value={curCrayonGrain}
                onChange={(val) => apply({ crayonGrain: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Coarse rough paper ↔ fine paper tooth
              </div>
            </div>

            <div>
              <EditorSlider
                label="Edge Chatter"
                value={curCrayonRoughness}
                onChange={(val) => apply({ crayonRoughness: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Wax border displacement & edge roughness
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drybrush / Oil Variables Panel (active when Oil or Dry Brush is selected) */}
      {(curBrushType === 'drybrush' || curBrushType === 'oil') && (
        <div className="p-2.5 bg-orange-500/[0.04] border border-orange-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-orange-500/10">
            <div className="flex items-center gap-1.5">
              <Palette size={11} className="text-orange-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-orange-300">
                {curBrushType === 'oil' ? 'Oil Brush Variables' : 'Dry Brush Variables'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ drybrushDensity: 50, drybrushStreaks: 50, drybrushRoughness: 50 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset bristle sliders to standard defaults"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <div className="text-[9px] font-medium text-zinc-400">Presets</div>
            <div className="grid grid-cols-3 gap-1">
              {DRYBRUSH_PRESETS.map((preset) => {
                const isActive =
                  curDrybrushDensity === preset.density &&
                  curDrybrushStreaks === preset.streaks &&
                  curDrybrushRoughness === preset.roughness;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      apply({
                        drybrushDensity: preset.density,
                        drybrushStreaks: preset.streaks,
                        drybrushRoughness: preset.roughness,
                      })
                    }
                    title={preset.description}
                    className={`px-1 py-1 rounded-lg text-[8.5px] font-medium border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-orange-400/20 border-orange-400/50 text-orange-300 font-bold shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-0.5">
            <div>
              <EditorSlider
                label="Pigment Viscosity"
                value={curDrybrushDensity}
                onChange={(val) => apply({ drybrushDensity: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Dry skipping tooth ↔ rich opaque impasto
              </div>
            </div>

            <div>
              <EditorSlider
                label="Bristle Striations"
                value={curDrybrushStreaks}
                onChange={(val) => apply({ drybrushStreaks: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Broad hair clumps ↔ fine hair drag lines
              </div>
            </div>

            <div>
              <EditorSlider
                label="Bristle Drag Roughness"
                value={curDrybrushRoughness}
                onChange={(val) => apply({ drybrushRoughness: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Clean contour ↔ broken bristle drag displacement
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Watercolor Variables Panel (active when Watercolor is selected) */}
      {curBrushType === 'watercolor' && (
        <div className="p-2.5 bg-sky-500/[0.04] border border-sky-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-sky-500/10">
            <div className="flex items-center gap-1.5">
              <Droplets size={11} className="text-sky-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-sky-300">
                Watercolor Variables
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ watercolorBleed: 50, watercolorSpread: 50, watercolorWetness: 50 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset watercolor sliders to standard defaults"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <div className="text-[9px] font-medium text-zinc-400">Presets</div>
            <div className="grid grid-cols-3 gap-1">
              {WATERCOLOR_PRESETS.map((preset) => {
                const isActive =
                  curWatercolorBleed === preset.bleed &&
                  curWatercolorSpread === preset.spread &&
                  curWatercolorWetness === preset.wetness;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      apply({
                        watercolorBleed: preset.bleed,
                        watercolorSpread: preset.spread,
                        watercolorWetness: preset.wetness,
                      })
                    }
                    title={preset.description}
                    className={`px-1 py-1 rounded-lg text-[8.5px] font-medium border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-sky-400/20 border-sky-400/50 text-sky-300 font-bold shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-0.5">
            <div>
              <EditorSlider
                label="Bleed & Feather"
                value={curWatercolorBleed}
                onChange={(val) => apply({ watercolorBleed: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Tight border feather ↔ soft blooming paper bleed
              </div>
            </div>

            <div>
              <EditorSlider
                label="Wash Wetness"
                value={curWatercolorWetness}
                onChange={(val) => apply({ watercolorWetness: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Delicate translucent glaze ↔ saturated wet pool
              </div>
            </div>

            <div>
              <EditorSlider
                label="Edge Diffusion Spread"
                value={curWatercolorSpread}
                onChange={(val) => apply({ watercolorSpread: val })}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Turbulent fluid seepage into dry paper fibers
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calligraphy Nib Variables Panel (active when Calligraphy 1 or 2 is selected) */}
      {(curBrushType === 'calligraphy1' || curBrushType === 'calligraphy2') && (
        <div className="p-2.5 bg-purple-500/[0.04] border border-purple-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/10">
            <div className="flex items-center gap-1.5">
              <Feather size={11} className="text-purple-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-purple-300">
                Calligraphy Chisel Nib
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ nibAngle: curBrushType === 'calligraphy2' ? -45 : 45, nibWeight: 50 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset nib sliders to standard defaults"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <div className="text-[9px] font-medium text-zinc-400">Presets</div>
            <div className="grid grid-cols-2 gap-1">
              {CALLIGRAPHY_PRESETS.map((preset) => {
                const isActive = curNibAngle === preset.angle;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      apply({
                        nibAngle: preset.angle,
                        nibWeight: preset.weight,
                      })
                    }
                    title={preset.description}
                    className={`px-1.5 py-1 rounded-lg text-[8.5px] font-medium border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-400/20 border-purple-400/50 text-purple-300 font-bold shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-2 pt-0.5">
            <div>
              <EditorSlider
                label="Nib Chisel Angle"
                value={curNibAngle}
                onChange={(val) => apply({ nibAngle: val })}
                min={-90}
                max={90}
                defaultValue={curBrushType === 'calligraphy2' ? -45 : 45}
                unit="°"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Chisel nib rotation angle across horizontal plane
              </div>
            </div>

            <div>
              <EditorSlider
                label="Nib Width / Flatness"
                value={curNibWeight}
                onChange={(val) => apply({ nibWeight: val })}
                min={10}
                max={100}
                defaultValue={50}
                unit="%"
              />
              <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
                Chisel aspect ratio & hairline-to-broad ribbon contrast
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paint Brush Variables Panel (active when Paint Brush is selected) */}
      {curBrushType === 'brush' && (
        <div className="p-2.5 bg-blue-500/[0.04] border border-blue-500/20 rounded-xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-blue-500/10">
            <div className="flex items-center gap-1.5">
              <Paintbrush size={11} className="text-blue-400 shrink-0" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-blue-300">
                Paint Brush
              </span>
            </div>
            <button
              type="button"
              onClick={() => apply({ brushFeather: 0 })}
              className="flex items-center gap-1 text-[8.5px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
              title="Reset brush softness"
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>

          <div>
            <EditorSlider
              label="Edge Softness / Feather"
              value={curBrushFeather}
              onChange={(val) => apply({ brushFeather: val })}
              min={0}
              max={10}
              defaultValue={0}
              unit=" px"
            />
            <div className="text-[7.5px] text-zinc-500 mt-0.5 pl-0.5">
              0 px (crisp round tip) ↔ 10 px (soft airbrushed edge)
            </div>
          </div>
        </div>
      )}

      {/* 4. Closed Shape & Fill */}
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

