import React from 'react';
import { Sliders, ChevronDown } from 'lucide-react';
import { RawSettings } from '../rawEngine';
import { EditorSlider } from '../ui/EditorSlider';

interface RawExposureSectionProps {
  settings: RawSettings;
  isOpen: boolean;
  onToggle: () => void;
  update: (patch: Partial<RawSettings>) => void;
}

export const RawExposureSection: React.FC<RawExposureSectionProps> = ({
  settings,
  isOpen,
  onToggle,
  update,
}) => {
  return (
    <div className="bg-[#12141a] rounded-xl border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 cursor-pointer group/sec text-left"
      >
        <div className="flex items-center gap-2">
          <Sliders size={12} className="text-primary" />
          <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
            Dynamic Range & Exposure
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
        <div className="px-3 pb-3.5 space-y-3.5 border-t border-white/5 pt-3 animate-in fade-in duration-150">
          {/* Raw EV Exposure Slider */}
          <EditorSlider
            label="Exposure (EV Compensation)"
            value={settings.exposure}
            onChange={val => update({ exposure: val })}
            min={-5.0}
            max={5.0}
            step={0.05}
            defaultValue={0}
            formatValue={val => (val > 0 ? `+${val.toFixed(2)} EV` : `${val.toFixed(2)} EV`)}
            bipolar
          />

          {/* Highlight Recovery */}
          <EditorSlider
            label="Highlight Recovery"
            value={settings.highlightRecovery}
            onChange={val => update({ highlightRecovery: val })}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
          />

          {/* Shadow Dynamic Range Boost */}
          <EditorSlider
            label="Shadow Lift"
            value={settings.shadowBoost}
            onChange={val => update({ shadowBoost: val })}
            min={-100}
            max={100}
            defaultValue={0}
            unit="%"
            bipolar
          />

          {/* Whites */}
          <EditorSlider
            label="Whites"
            value={settings.whites}
            onChange={val => update({ whites: val })}
            min={-100}
            max={100}
            defaultValue={0}
            bipolar
          />

          {/* Blacks */}
          <EditorSlider
            label="Blacks"
            value={settings.blacks}
            onChange={val => update({ blacks: val })}
            min={-100}
            max={100}
            defaultValue={0}
            bipolar
          />
        </div>
      )}
    </div>
  );
};

