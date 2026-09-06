/**
 * SpraySettingsSection.tsx
 * Specialized settings panel for the MS Paint-style Spray Paint / Airbrush tool:
 * Spray radius, droplet density (Mist / Balanced / Heavy Spatter), and flow opacity.
 */

import React from 'react';
import { SprayCan, Sparkles, Wind } from 'lucide-react';
import { Annotation, PenSettings } from './types';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

interface SpraySettingsSectionProps {
  settings: PenSettings;
  onChange: (next: Partial<PenSettings>) => void;
  selectedAnnotation?: Annotation | null;
  onUpdateSelected?: (updatedProps: Partial<Annotation>) => void;
}

const DENSITY_PRESETS = [
  { label: 'Mist', density: 6, icon: Wind },
  { label: 'Medium', density: 14, icon: SprayCan },
  { label: 'Heavy', density: 24, icon: Sparkles },
];

export const SpraySettingsSection: React.FC<SpraySettingsSectionProps> = ({
  settings,
  onChange,
  selectedAnnotation,
  onUpdateSelected,
}) => {
  const currentRadius = selectedAnnotation?.sprayRadius ?? settings.sprayRadius ?? 25;
  const currentDensity = selectedAnnotation?.sprayDensity ?? settings.sprayDensity ?? 14;

  const applyPatch = (patch: Partial<PenSettings>) => {
    onChange(patch);
    if (selectedAnnotation && onUpdateSelected) {
      const annPatch: Partial<Annotation> = {};
      if (patch.sprayRadius !== undefined) annPatch.sprayRadius = patch.sprayRadius;
      if (patch.sprayDensity !== undefined) annPatch.sprayDensity = patch.sprayDensity;
      onUpdateSelected(annPatch);
    }
  };

  return (
    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-3 shadow-md">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <SprayCan size={12} className="text-primary" />
          <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
            Spray Paint Options
            {selectedAnnotation?.brushType === 'spray' && (
              <span className="ml-1.5 text-[#22c55e] normal-case tracking-normal">
                · editing selected
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Spray Radius Slider */}
      <EditorSlider
        label="Spray Radius"
        value={currentRadius}
        onChange={(val) => applyPatch({ sprayRadius: val })}
        min={10}
        max={80}
        defaultValue={25}
        unit=" px"
      />

      {/* Spray Density / Droplet Flow */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-white/50">Droplet Density</div>
        <div className="grid grid-cols-3 gap-1">
          {DENSITY_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = currentDensity === preset.density;
            return (
              <button
                key={preset.density}
                type="button"
                onClick={() => applyPatch({ sprayDensity: preset.density })}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[9.5px] font-medium border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary/25 border-primary text-primary font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/10'
                }`}
              >
                <Icon size={11} />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

