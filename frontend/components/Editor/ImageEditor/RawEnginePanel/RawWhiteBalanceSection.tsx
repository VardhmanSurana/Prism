import React from 'react';
import { Sun, ChevronDown } from 'lucide-react';
import { RawSettings, RawWhitebalancePreset } from '../rawEngine';
import { EditorSlider } from '../ui/EditorSlider';

interface RawWhiteBalanceSectionProps {
  settings: RawSettings;
  isOpen: boolean;
  onToggle: () => void;
  update: (patch: Partial<RawSettings>) => void;
  onPresetSelect: (preset: RawWhitebalancePreset) => void;
}

const PRESET_OPTIONS: { key: RawWhitebalancePreset; label: string }[] = [
  { key: 'as_shot', label: 'As Shot' },
  { key: 'daylight', label: 'Daylight' },
  { key: 'cloudy', label: 'Cloudy' },
  { key: 'shade', label: 'Shade' },
  { key: 'tungsten', label: 'Tungsten' },
  { key: 'fluorescent', label: 'Fluorescent' },
  { key: 'flash', label: 'Flash' },
  { key: 'custom', label: 'Custom' },
];

export const RawWhiteBalanceSection: React.FC<RawWhiteBalanceSectionProps> = ({
  settings,
  isOpen,
  onToggle,
  update,
  onPresetSelect,
}) => {
  return (
    <div className="bg-[#12141a] rounded-xl border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 cursor-pointer group/sec text-left"
      >
        <div className="flex items-center gap-2">
          <Sun size={12} className="text-amber-400" />
          <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
            White Balance (Kelvin)
          </span>
        </div>
        <ChevronDown
          size={12}
          className={`text-white/30 group-hover/sec:text-white/60 transition-transform ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3.5 space-y-4 border-t border-white/5 pt-3 animate-in fade-in duration-150">
          {/* WB Preset Pills */}
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_OPTIONS.map(({ key, label }) => {
              const isSelected = settings.wbPreset === key;
              return (
                <button
                  key={key}
                  onClick={() => onPresetSelect(key)}
                  className={`editor-btn editor-chip-btn ${
                    isSelected ? 'active' : ''
                  } py-1.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider truncate`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Color Temperature (Kelvin) Slider */}
          <EditorSlider
            label="Color Temperature"
            value={settings.kelvin}
            onChange={val => update({ kelvin: val, wbPreset: 'custom' })}
            min={2000}
            max={20000}
            step={50}
            defaultValue={5500}
            unit=" K"
            trackBackground="linear-gradient(to right, #38bdf8 0%, #a5f3fc 15%, #fef08a 35%, #fbbf24 55%, #f97316 80%, #ea580c 100%)"
          />

          {/* Tint Slider */}
          <EditorSlider
            label="Tint (Green / Magenta)"
            value={settings.tint}
            onChange={val => update({ tint: val, wbPreset: 'custom' })}
            min={-100}
            max={100}
            defaultValue={0}
            trackBackground="linear-gradient(to right, #10b981 0%, #4b5563 50%, #ec4899 100%)"
            bipolar
          />
        </div>
      )}
    </div>
  );
};

