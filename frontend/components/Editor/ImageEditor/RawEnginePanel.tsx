import React from 'react';
import { RawSettings, DEFAULT_RAW_SETTINGS, DemosaicAlgorithm } from './rawEngine';
import { Camera, Sun, ShieldAlert, Sparkles } from 'lucide-react';

interface RawEnginePanelProps {
  settings: RawSettings;
  onChange: (s: RawSettings) => void;
}

export const RawEnginePanel: React.FC<RawEnginePanelProps> = ({
  settings = DEFAULT_RAW_SETTINGS,
  onChange,
}) => {
  const update = (patch: Partial<RawSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white p-4 space-y-5">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Camera size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Camera RAW Studio</h3>
      </div>

      {/* Demosaicing Algorithm */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-white/60 uppercase">Sensor Demosaicing Algorithm</label>
        <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {(['amaze', 'ahd', 'rcd'] as DemosaicAlgorithm[]).map(algo => (
            <button
              key={algo}
              onClick={() => update({ algorithm: algo })}
              className={`py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                settings.algorithm === algo ? 'bg-primary/25 text-primary border border-primary/40' : 'text-white/40 hover:text-white'
              }`}
            >
              {algo}
            </button>
          ))}
        </div>
      </div>

      {/* Kelvin Temperature Slider */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Kelvin White Balance</span>
          <span className="font-mono text-amber-400 font-bold">{settings.kelvin}K</span>
        </div>
        <input
          type="range"
          min={2000}
          max={20000}
          step={50}
          value={settings.kelvin}
          onChange={e => update({ kelvin: Number(e.target.value) })}
          className="w-full h-1 bg-gradient-to-r from-blue-500 via-yellow-400 to-amber-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Tint Slider */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Tint (Green / Magenta)</span>
          <span className="font-mono text-pink-400 font-bold">{settings.tint > 0 ? `+${settings.tint}` : settings.tint}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={settings.tint}
          onChange={e => update({ tint: Number(e.target.value) })}
          className="w-full h-1 bg-gradient-to-r from-emerald-500 via-gray-600 to-fuchsia-500 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Highlight Recovery */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Highlight Recovery</span>
          <span className="font-mono text-primary font-bold">{settings.highlightRecovery}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.highlightRecovery}
          onChange={e => update({ highlightRecovery: Number(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Denoise AI */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Denoise AI (Wavelet)</span>
          <span className="font-mono text-primary font-bold">{settings.denoiseAi}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.denoiseAi}
          onChange={e => update({ denoiseAi: Number(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
};
