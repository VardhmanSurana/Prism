import React from 'react';
import { LassoState, DEFAULT_LASSO_STATE, LassoType, LassoOperation, invertMask, renderLassoPathToMask } from './lassoEngine';
import { MousePointer, Magnet, Pentagon, Sparkles, Layers, RotateCcw, Paintbrush, Sliders } from 'lucide-react';
import { Adjustments } from './filterEngine';

interface LassoPanelProps {
  state: LassoState;
  onChange: (s: LassoState) => void;
  adjustments: Adjustments;
  onAdjustmentsChange: (adj: Adjustments) => void;
  onConvertToInpaintMask?: (maskUrl: string) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const LassoPanel: React.FC<LassoPanelProps> = ({
  state = DEFAULT_LASSO_STATE,
  onChange,
  adjustments,
  onAdjustmentsChange,
  onConvertToInpaintMask,
  canvasWidth = 1920,
  canvasHeight = 1080,
}) => {
  const update = (patch: Partial<LassoState>) => onChange({ ...state, ...patch });

  const handleClear = () => {
    onChange({ ...state, points: [], isClosed: false });
  };

  const handleConvertToRegionalMask = () => {
    if (state.points.length < 3) return;
    const maskCanvas = renderLassoPathToMask(state.points, canvasWidth, canvasHeight, state.feather);
    const maskUrl = maskCanvas.toDataURL('image/png');

    const newRegion = {
      id: `lasso-${Date.now()}`,
      type: 'custom' as const,
      maskUrl,
      adjustments: { brightness: 0, contrast: 0, saturation: 0, blur: 0 },
    };

    onAdjustmentsChange({
      ...adjustments,
      regions: [...adjustments.regions, newRegion],
    });

    handleClear();
  };

  const handleConvertToInpaint = () => {
    if (state.points.length < 3) return;
    const maskCanvas = renderLassoPathToMask(state.points, canvasWidth, canvasHeight, state.feather);
    const maskUrl = maskCanvas.toDataURL('image/png');
    onConvertToInpaintMask?.(maskUrl);
    handleClear();
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white p-4 space-y-5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <MousePointer size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Lasso Selection Studio</h3>
        </div>
        <button
          onClick={handleClear}
          disabled={state.points.length === 0}
          className="text-white/40 hover:text-white transition-colors cursor-pointer disabled:opacity-20"
          title="Clear Selection"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Lasso Type Selector */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-white/60 uppercase">Lasso Tool Type</label>
        <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {(
            [
              { id: 'freehand', label: 'Freehand', icon: <MousePointer size={12} /> },
              { id: 'polygonal', label: 'Polygonal', icon: <Pentagon size={12} /> },
              { id: 'magnetic', label: 'Magnetic', icon: <Magnet size={12} /> },
            ] as const
          ).map(tool => (
            <button
              key={tool.id}
              onClick={() => update({ type: tool.id as LassoType, points: [], isClosed: false })}
              className={`py-2 text-[10px] font-bold uppercase rounded flex items-center justify-center gap-1.5 transition-all ${
                state.type === tool.id ? 'bg-primary/25 text-primary border border-primary/40' : 'text-white/40 hover:text-white'
              }`}
            >
              {tool.icon}
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selection Mode (New, Add, Subtract, Intersect) */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-white/60 uppercase">Selection Combine Mode</label>
        <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-lg border border-white/5 text-[10px]">
          {(
            [
              { id: 'new', label: 'New' },
              { id: 'add', label: 'Add (+)' },
              { id: 'subtract', label: 'Sub (-)' },
              { id: 'intersect', label: 'Intersect' },
            ] as const
          ).map(mode => (
            <button
              key={mode.id}
              onClick={() => update({ operation: mode.id as LassoOperation })}
              className={`py-1.5 font-semibold rounded transition-all ${
                state.operation === mode.id ? 'bg-white/15 text-white font-bold' : 'text-white/40 hover:text-white'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feathering Slider */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Edge Feather Radius</span>
          <span className="font-mono text-primary font-bold">{state.feather}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={state.feather}
          onChange={e => update({ feather: Number(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Actions & Mask Conversion */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Selection Actions</p>

        <button
          onClick={handleConvertToRegionalMask}
          disabled={state.points.length < 3}
          className="w-full py-2 rounded bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30"
        >
          <Layers size={12} />
          Convert to Regional Mask
        </button>

        <button
          onClick={handleConvertToInpaint}
          disabled={state.points.length < 3}
          className="w-full py-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30"
        >
          <Paintbrush size={12} />
          Convert to AI Inpaint Mask
        </button>
      </div>
    </div>
  );
};
