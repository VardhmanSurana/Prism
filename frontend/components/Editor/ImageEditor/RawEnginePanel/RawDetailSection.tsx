import React from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { RawSettings, DemosaicAlgorithm } from '../rawEngine';
import { EditorSlider } from '../ui/EditorSlider';

interface RawDetailSectionProps {
  settings: RawSettings;
  isOpen: boolean;
  onToggle: () => void;
  update: (patch: Partial<RawSettings>) => void;
}

const ALGORITHMS: DemosaicAlgorithm[] = ['amaze', 'ahd', 'rcd'];

export const RawDetailSection: React.FC<RawDetailSectionProps> = ({
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
          <Sparkles size={12} className="text-cyan-400" />
          <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
            Sensor Demosaicing & Denoise
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
          {/* Demosaicing Algorithm */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/40 uppercase">
              Bayer CFA Demosaic Method
            </label>
            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              {ALGORITHMS.map(algo => (
                <button
                  key={algo}
                  onClick={() => update({ algorithm: algo })}
                  className={`editor-btn editor-chip-btn ${
                    settings.algorithm === algo ? 'active' : ''
                  } py-1.5 text-[10px] font-bold uppercase`}
                >
                  {algo === 'amaze' ? 'AMaZE' : algo.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Wavelet Luminance Denoise */}
          <EditorSlider
            label="Luminance Wavelet Denoise"
            value={settings.denoiseAi}
            onChange={val => update({ denoiseAi: val })}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
          />

          {/* Chrominance Denoise */}
          <EditorSlider
            label="Color Noise Reduction (Chroma)"
            value={settings.chromaDenoise}
            onChange={val => update({ chromaDenoise: val })}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
          />

          {/* RAW Micro-contrast Clarity */}
          <EditorSlider
            label="RAW Micro-Contrast"
            value={settings.rawClarity}
            onChange={val => update({ rawClarity: val })}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
          />
        </div>
      )}
    </div>
  );
};

