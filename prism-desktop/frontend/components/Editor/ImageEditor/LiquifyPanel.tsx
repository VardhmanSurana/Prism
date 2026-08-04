import React from 'react';
import { Smile, Sparkles, Move, RotateCcw } from 'lucide-react';

export type LiquifyToolMode = 'warp' | 'pucker' | 'bloat' | 'smooth' | 'reconstruct';

export interface FaceLiquifySettings {
  eyeSize: number; // -100 -> 100
  eyeDistance: number; // -100 -> 100
  noseWidth: number; // -100 -> 100
  lipHeight: number; // -100 -> 100
  chinShape: number; // -100 -> 100
}

export interface LiquifySettings {
  mode: LiquifyToolMode;
  brushSize: number;
  pressure: number;
  face: FaceLiquifySettings;
}

export const DEFAULT_LIQUIFY_SETTINGS: LiquifySettings = {
  mode: 'warp',
  brushSize: 80,
  pressure: 50,
  face: {
    eyeSize: 0,
    eyeDistance: 0,
    noseWidth: 0,
    lipHeight: 0,
    chinShape: 0,
  },
};

interface LiquifyPanelProps {
  settings: LiquifySettings;
  onChange: (s: LiquifySettings) => void;
  onResetMesh: () => void;
}

export const LiquifyPanel: React.FC<LiquifyPanelProps> = ({
  settings = DEFAULT_LIQUIFY_SETTINGS,
  onChange,
  onResetMesh,
}) => {
  const update = (patch: Partial<LiquifySettings>) => onChange({ ...settings, ...patch });
  const updateFace = (patch: Partial<FaceLiquifySettings>) =>
    onChange({ ...settings, face: { ...settings.face, ...patch } });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white p-4 space-y-5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Smile size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Liquify & Face Reshape</h3>
        </div>
        <button
          onClick={onResetMesh}
          className="text-white/40 hover:text-white transition-colors cursor-pointer"
          title="Reset Mesh"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Mesh Tool Modes */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-white/60 uppercase">Mesh Tool</label>
        <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {(
            [
              { id: 'warp', label: 'Warp' },
              { id: 'pucker', label: 'Pucker' },
              { id: 'bloat', label: 'Bloat' },
              { id: 'smooth', label: 'Smooth' },
              { id: 'reconstruct', label: 'Restore' },
            ] as const
          ).map(tool => (
            <button
              key={tool.id}
              onClick={() => update({ mode: tool.id as LiquifyToolMode })}
              className={`py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                settings.mode === tool.id ? 'bg-primary/25 text-primary border border-primary/40' : 'text-white/40 hover:text-white'
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brush Size & Pressure */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/60">
            <span>Brush Size</span>
            <span className="font-mono">{settings.brushSize}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            value={settings.brushSize}
            onChange={e => update({ brushSize: Number(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/60">
            <span>Pressure</span>
            <span className="font-mono">{settings.pressure}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={settings.pressure}
            onChange={e => update({ pressure: Number(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Face-Aware Reshape Sliders */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white/70 border-b border-white/5 pb-2">
          <Sparkles size={11} className="text-primary" />
          Face-Aware Reshape
        </div>

        {[
          { key: 'eyeSize' as const, label: 'Eye Size' },
          { key: 'eyeDistance' as const, label: 'Eye Distance' },
          { key: 'noseWidth' as const, label: 'Nose Width' },
          { key: 'lipHeight' as const, label: 'Lip Height' },
          { key: 'chinShape' as const, label: 'Chin Shape' },
        ].map(item => (
          <div key={item.key} className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/60">
              <span>{item.label}</span>
              <span className="font-mono">{settings.face[item.key] > 0 ? `+${settings.face[item.key]}` : settings.face[item.key]}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={settings.face[item.key]}
              onChange={e => updateFace({ [item.key]: Number(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
