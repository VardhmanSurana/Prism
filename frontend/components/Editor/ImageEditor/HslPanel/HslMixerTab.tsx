/**
 * HslMixerTab.tsx
 * 8-band color mixer with per-band H/S/L sliders.
 */
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { HslAdjustments, HslBand } from '../filterEngine';
import { EditorSlider } from '../ui/EditorSlider';
import { BANDS, SLIDERS, BandMeta } from './bands';

export interface HslMixerTabProps {
  hsl: HslAdjustments;
  activeBand: HslBand;
  setActiveBand: (b: HslBand) => void;
  isHslModified: boolean;
  isBandModified: (b: HslBand) => boolean;
  onSliderChange: (key: 'hue' | 'saturation' | 'luminance', value: number) => void;
  onResetBand: () => void;
  onResetAll: () => void;
}

export const HslMixerTab: React.FC<HslMixerTabProps> = (p) => {
  const activeMeta: BandMeta = BANDS.find(b => b.id === p.activeBand)!;
  const activeBaseHue = activeMeta.baseHue ?? 0;
  const currentBand = p.hsl[p.activeBand];
  const currentEffectiveHue = (activeBaseHue + (currentBand.hue || 0) + 360) % 360;
  const dynamicActiveColor = `hsl(${currentEffectiveHue}, 100%, 50%)`;

  return (
    <div className="pt-3">
      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-white/90 tracking-tight select-none">Color Band</span>
        <div className="flex items-center gap-2.5">
          {p.isBandModified(p.activeBand) && (
            <button
              onClick={p.onResetBand}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Reset active color band"
            >
              <RotateCcw size={10} /> Reset Band
            </button>
          )}
          {p.isHslModified && (
            <button
              onClick={p.onResetAll}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
              title="Reset all 8 color bands"
            >
              Reset All
            </button>
          )}
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center justify-between py-1">
          {BANDS.map(band => {
            const isActive = p.activeBand === band.id;
            const isModified = p.isBandModified(band.id);
            const bandEffectiveHue = (band.baseHue + (p.hsl[band.id]?.hue || 0) + 360) % 360;
            const bandDisplayColor = isModified ? `hsl(${bandEffectiveHue}, 100%, 50%)` : band.color;

            return (
              <div key={band.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => p.setActiveBand(band.id)}
                    className="relative flex items-center justify-center focus:outline-none cursor-pointer active:scale-95 transition-transform"
                    title={band.name}
                  >
                    {isActive ? (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-white/90 ring-offset-2 ring-offset-[#0d0f14] transition-all">
                        <div className="w-4 h-4 rounded-full shadow-sm transition-colors duration-150" style={{ backgroundColor: dynamicActiveColor }} />
                      </div>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full shadow-sm hover:scale-115 transition-transform cursor-pointer"
                        style={{ backgroundColor: bandDisplayColor }}
                      />
                    )}
                    {isModified && !isActive && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-[#0d0f14]"
                        style={{ backgroundColor: bandDisplayColor }}
                      />
                    )}
                  </button>
                </div>
                <div className="h-4 flex items-center justify-center">
                  {isActive && (
                    <span className="text-[10.5px] font-semibold text-white/90 select-none tracking-tight animate-in fade-in duration-150">
                      {band.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4 border-t border-white/5 pt-4">
        {SLIDERS.map(slider => {
          let trackBg: string | undefined;
          if (slider.key === 'hue') {
            trackBg = `linear-gradient(to right,
              hsl(${(activeBaseHue - 180 + 360) % 360}, 100%, 50%),
              hsl(${(activeBaseHue - 90 + 360) % 360}, 100%, 50%),
              hsl(${activeBaseHue}, 100%, 50%),
              hsl(${(activeBaseHue + 90) % 360}, 100%, 50%),
              hsl(${(activeBaseHue + 180) % 360}, 100%, 50%)
            )`;
          } else if (slider.key === 'saturation') {
            trackBg = `linear-gradient(to right, #4b5563, ${dynamicActiveColor})`;
          } else if (slider.key === 'luminance') {
            trackBg = `linear-gradient(to right, #000000, ${dynamicActiveColor}, #ffffff)`;
          }

          return (
            <EditorSlider
              key={slider.key}
              label={slider.label}
              value={currentBand[slider.key]}
              onChange={val => p.onSliderChange(slider.key, val)}
              min={slider.min}
              max={slider.max}
              defaultValue={0}
              unit={slider.key === 'hue' ? '°' : '%'}
              bipolar
              trackBackground={trackBg}
            />
          );
        })}
      </div>

      <div className="mx-4 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <p className="text-[10px] text-white/40 leading-relaxed">
          Targeted HSL adjustments isolate and refine specific color frequencies without altering surrounding tonalities.
        </p>
      </div>
    </div>
  );
};
