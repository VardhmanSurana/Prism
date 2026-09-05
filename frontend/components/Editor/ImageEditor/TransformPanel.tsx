import React from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Check } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { EditorSlider } from './ui/EditorSlider';

const ASPECT_RATIOS = [
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
  adjustments: Adjustments;
  onAdjustmentsChange: (adj: Adjustments) => void;
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
  adjustments,
  onAdjustmentsChange,
}) => {

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-[#0d0f14]">
      {/* Scrollable transform controls */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-5 space-y-8 custom-scrollbar">
        {/* Aspect ratio */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-4">Proportions</p>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIOS.map(ratio => {
              const active =
                (isNaN(currentRatio) && isNaN(ratio.value)) ||
                ratio.value === currentRatio;
              return (
                <button
                  key={ratio.label}
                  onClick={() => handleSetAspectRatio(ratio.value)}
                  className={`editor-btn editor-card-btn ${
                    active ? 'active' : ''
                  } px-3 py-2.5 text-xs font-bold text-center`}
                >
                  {ratio.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rotate & Flip */}
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-4">Orientation</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRotate(-90)}
                className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors 150ms ease, background-color 150ms ease"
                title="Rotate Left"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => handleRotate(90)}
                className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors 150ms ease, background-color 150ms ease"
                title="Rotate Right"
              >
                <RotateCw size={16} />
              </button>
              <button
                onClick={handleFlipH}
                className={`editor-btn editor-card-btn ${
                  flipH ? 'active' : ''
                } flex-1 h-12 flex items-center justify-center`}
                title="Flip Horizontal"
              >
                <FlipHorizontal size={16} />
              </button>
              <button
                onClick={handleFlipV}
                className={`editor-btn editor-card-btn ${
                  flipV ? 'active' : ''
                } flex-1 h-12 flex items-center justify-center`}
                title="Flip Vertical"
              >
                <FlipVertical size={16} />
              </button>
            </div>
          </div>

          {/* Straighten */}
          <div>
            <EditorSlider
              label="Straighten Angle"
              value={straightenAngle}
              onChange={handleStraighten}
              min={-45}
              max={45}
              step={0.1}
              defaultValue={0}
              unit="°"
              bipolar
            />
            
            {straightenAngle !== 0 && (
              <button
                onClick={() => handleStraighten(0)}
                className="mt-2 w-full text-[9px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              >
                Reset Level
              </button>
            )}
          </div>
        </div>

        {/* Geometry Corrections */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Geometry</p>
          <div className="space-y-3.5">
            {[
              { key: 'perspective' as const, label: 'Horizontal Perspective' },
              { key: 'verticalPerspective' as const, label: 'Vertical Perspective' },
              { key: 'distortion' as const, label: 'Lens Distortion' },
            ].map(({ key, label }) => (
              <EditorSlider
                key={key}
                label={label}
                value={adjustments[key]}
                onChange={val => onAdjustmentsChange({ ...adjustments, [key]: val })}
                min={-100}
                max={100}
                defaultValue={0}
                bipolar
              />
            ))}
          </div>
        </div>
      </div>

      {/* Crop Actions (Apply / Reset) at the bottom */}
      {(hasCropSelection || isImageCropped) && (
        <div className="p-4 border-t border-white/5 bg-[#0d0f14]/95 backdrop-blur-md shrink-0 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Selection</p>
          <div className="flex flex-col gap-2">
            {hasCropSelection && (
              <button
                onClick={handleApplyCrop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-[#050505] hover:brightness-110 transition-colors 150ms ease text-xs font-bold shadow-xl shadow-primary/20 cursor-pointer"
              >
                <Check size={14} strokeWidth={3} /> Apply Changes
              </button>
            )}
            {isImageCropped && (
              <button
                onClick={handleResetCrop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/5 text-white/40 hover:text-white hover:bg-white/5 transition-colors 150ms ease, background-color 150ms ease text-xs font-bold cursor-pointer"
              >
                Reset Canvas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
