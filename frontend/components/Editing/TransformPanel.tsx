import React, { useState } from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Check, Sparkles, Loader2 } from 'lucide-react';
import { ReactCropperElement } from 'react-cropper';
import { API_BASE } from '../../constants';

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
  photoId?: number | string;
  cropperRef: React.RefObject<ReactCropperElement>;
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
  photoId,
  cropperRef,
}) => {
  const [isSmartCropping, setIsSmartCropping] = useState(false);

  const handleSmartCrop = async () => {
    if (!photoId || !cropperRef.current) return;
    setIsSmartCropping(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/smart-crop/${photoId}`);
      if (res.ok) {
        const data = await res.json();
        const cropper = cropperRef.current.cropper;
        
        // Get natural image data
        const imageData = cropper.getImageData();
        
        // Convert percentage/absolute pixels to cropper's internal canvas scale
        // The API returns pixels relative to original image size
        const scale = imageData.width / imageData.naturalWidth;
        
        cropper.setCropBoxData({
          left:   data.x * scale + imageData.left,
          top:    data.y * scale + imageData.top,
          width:  data.width * scale,
          height: data.height * scale,
        });
      }
    } catch (e) {
      console.error("Smart crop failed", e);
    } finally {
      setIsSmartCropping(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">

      {/* AI Tools */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Intelligent Tools</p>
        <button
          onClick={handleSmartCrop}
          disabled={isSmartCropping || !photoId}
          className="group w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {isSmartCropping ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />}
          AI Smart Crop
        </button>
      </div>

      {/* Crop Actions (Apply / Reset) */}
      {(hasCropSelection || isImageCropped) && (
        <div className="space-y-3 p-4 glass-card animate-in fade-in zoom-in-95 duration-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Selection</p>
          <div className="flex flex-col gap-2">
            {hasCropSelection && (
              <button
                onClick={handleApplyCrop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-[#050505] hover:brightness-110 transition-all text-xs font-bold shadow-xl shadow-primary/20 cursor-pointer"
              >
                <Check size={14} strokeWidth={3} /> Apply Changes
              </button>
            )}
            {isImageCropped && (
              <button
                onClick={handleResetCrop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/5 text-white/40 hover:text-white hover:bg-white/5 transition-all text-xs font-bold cursor-pointer"
              >
                Reset Canvas
              </button>
            )}
          </div>
        </div>
      )}

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
                className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition-all border ${
                  active
                    ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                    : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5'
                }`}
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
              className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
              title="Rotate Left"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => handleRotate(90)}
              className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
              title="Rotate Right"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleFlipH}
              className={`flex-1 h-12 flex items-center justify-center rounded-xl border transition-all ${
                flipH
                  ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                  : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              title="Flip Horizontal"
            >
              <FlipHorizontal size={16} />
            </button>
            <button
              onClick={handleFlipV}
              className={`flex-1 h-12 flex items-center justify-center rounded-xl border transition-all ${
                flipV
                  ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                  : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              title="Flip Vertical"
            >
              <FlipVertical size={16} />
            </button>
          </div>
        </div>

        {/* Straighten */}
        <div>
          <div className="flex justify-between items-baseline mb-4">
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Straighten</p>
             <span className={`text-[11px] font-mono tabular-nums font-bold transition-all duration-300 ${
               straightenAngle !== 0 ? 'text-primary scale-110' : 'text-white/20'
             }`}>
               {straightenAngle > 0 ? `+${straightenAngle.toFixed(1)}°` : `${straightenAngle.toFixed(1)}°`}
             </span>
          </div>
          
          <div className="relative h-4 flex items-center group/slider">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
              style={{
                left:  `${Math.min(50, ((straightenAngle + 45) / 90) * 100)}%`,
                width: `${Math.abs(((straightenAngle + 45) / 90) * 100 - 50)}%`,
                background: `rgba(var(--color-primary), ${straightenAngle !== 0 ? 0.8 : 0.2})`,
                boxShadow: straightenAngle !== 0 ? `0 0 8px rgba(var(--color-primary), 0.3)` : 'none',
              }}
            />
            <input
              type="range"
              min={-45}
              max={45}
              step={0.1}
              value={straightenAngle}
              onChange={e => handleStraighten(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
          
          {straightenAngle !== 0 && (
            <button
              onClick={() => handleStraighten(0)}
              className="mt-3 w-full text-[9px] font-bold uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
            >
              Reset Level
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
