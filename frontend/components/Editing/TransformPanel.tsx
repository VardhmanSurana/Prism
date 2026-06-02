import React from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Check } from 'lucide-react';

export const ASPECT_RATIOS = [
  { label: 'Free',  value: NaN       },
  { label: '1:1',   value: 1         },
  { label: '3:2',   value: 3 / 2     },
  { label: '4:3',   value: 4 / 3     },
  { label: '4:5',   value: 4 / 5     },
  { label: '16:9',  value: 16 / 9    },
  { label: '9:16',  value: 9 / 16    },
];

interface TransformPanelProps {
  hasCropSelection: boolean;
  isImageCropped: boolean;
  handleApplyCrop: () => void;
  handleResetCrop: () => void;
  currentRatio: number;
  handleSetAspectRatio: (ratio: number) => void;
  handleRotate: (degree: number) => void;
  straightenAngle: number;
  handleStraighten: (angle: number) => void;
  flipH: boolean;
  flipV: boolean;
  handleFlipH: () => void;
  handleFlipV: () => void;
}

export const TransformPanel: React.FC<TransformPanelProps> = ({
  hasCropSelection,
  isImageCropped,
  handleApplyCrop,
  handleResetCrop,
  currentRatio,
  handleSetAspectRatio,
  handleRotate,
  straightenAngle,
  handleStraighten,
  flipH,
  flipV,
  handleFlipH,
  handleFlipV,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

      {/* Crop Actions (Apply / Reset) */}
      {(hasCropSelection || isImageCropped) && (
        <div className="space-y-2 pb-4 border-b border-white/5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">Crop Actions</p>
          <div className="flex flex-col gap-2">
            {hasCropSelection && (
              <button
                onClick={handleApplyCrop}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-white hover:opacity-90 transition-all text-xs font-semibold shadow-lg shadow-primary/25 cursor-pointer animate-fade-in"
              >
                <Check size={13} strokeWidth={2.5} /> Apply Crop
              </button>
            )}
            {isImageCropped && (
              <button
                onClick={handleResetCrop}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs font-medium cursor-pointer"
              >
                Reset Image
              </button>
            )}
          </div>
        </div>
      )}

      {/* Aspect ratio */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Aspect Ratio</p>
        <div className="flex flex-col gap-1.5">
          {ASPECT_RATIOS.map(ratio => {
            const active =
              (isNaN(currentRatio) && isNaN(ratio.value)) ||
              ratio.value === currentRatio;
            return (
              <button
                key={ratio.label}
                onClick={() => handleSetAspectRatio(ratio.value)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border ${
                  active
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-white/[0.03] border-transparent text-white/40 hover:text-white hover:bg-white/8'
                }`}
              >
                {ratio.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rotate */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Rotate</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleRotate(-90)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-transparent text-white/40 hover:text-white hover:bg-white/8 transition-colors text-xs font-medium"
          >
            <RotateCcw size={13} /> Left
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-transparent text-white/40 hover:text-white hover:bg-white/8 transition-colors text-xs font-medium"
          >
            <RotateCw size={13} /> Right
          </button>
        </div>
      </div>

      {/* Straighten */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Straighten</p>
        <div className="mb-2 flex justify-between items-baseline">
          <span className="text-[10px] text-white/35">−45°</span>
          <span className={`text-[11px] tabular-nums font-medium transition-colors ${
            straightenAngle !== 0 ? 'text-primary' : 'text-white/25'
          }`}>
            {straightenAngle > 0 ? `+${straightenAngle}°` : `${straightenAngle}°`}
          </span>
          <span className="text-[10px] text-white/35">+45°</span>
        </div>
        <div className="relative h-[14px] flex items-center">
          {/* Centre fill */}
          <div
            className="absolute h-[2px] rounded-full pointer-events-none"
            style={{
              left:  `${Math.min(50, ((straightenAngle + 45) / 90) * 100)}%`,
              width: `${Math.abs(((straightenAngle + 45) / 90) * 100 - 50)}%`,
              background: `rgba(var(--color-primary), ${straightenAngle !== 0 ? 0.75 : 0.25})`,
              transition: 'width 40ms linear, left 40ms linear',
            }}
          />
          <input
            type="range"
            min={-45}
            max={45}
            step={0.5}
            value={straightenAngle}
            onChange={e => handleStraighten(Number(e.target.value))}
            className="adjustment-slider"
          />
        </div>
        {straightenAngle !== 0 && (
          <button
            onClick={() => handleStraighten(0)}
            className="mt-2 w-full text-[10px] text-white/25 hover:text-white/60 transition-colors"
          >
            Reset straighten
          </button>
        )}
      </div>

      {/* Flip */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Flip</p>
        <div className="flex gap-2">
          <button
            onClick={handleFlipH}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border transition-all text-xs font-medium ${
              flipH
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-white/[0.03] border-transparent text-white/40 hover:text-white hover:bg-white/8'
            }`}
          >
            <FlipHorizontal size={13} /> Horizontal
          </button>
          <button
            onClick={handleFlipV}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border transition-all text-xs font-medium ${
              flipV
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-white/[0.03] border-transparent text-white/40 hover:text-white hover:bg-white/8'
            }`}
          >
            <FlipVertical size={13} /> Vertical
          </button>
        </div>
      </div>

    </div>
  );
};
