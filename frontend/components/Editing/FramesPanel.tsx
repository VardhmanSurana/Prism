/**
 * FramesPanel.tsx
 * Renders border and frame styles.
 */

import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';

interface FramesPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

const FRAME_TYPES = [
  { id: 'none', name: 'None', desc: 'No frame' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Vintage white border' },
  { id: 'filmstrip', name: 'Film Strip', desc: 'Perforated film edges' },
  { id: 'matte', name: 'Matte', desc: 'Classic thick borders' },
  { id: 'rounded', name: 'Rounded', desc: 'Smooth curved corners' },
  { id: 'thinline', name: 'Thin Line', desc: 'Minimal fine line border' },
  { id: 'shadowbox', name: 'Shadow Box', desc: 'Floating with soft shadow' },
];

const PRESET_COLORS = [
  { hex: '#ffffff', name: 'White' },
  { hex: '#000000', name: 'Black' },
  { hex: '#fdf6e2', name: 'Cream' },
  { hex: '#1e293b', name: 'Slate' },
  { hex: '#8c1d1d', name: 'Burgundy' },
  { hex: '#0f3a2b', name: 'Forest' },
];

export const FramesPanel: React.FC<FramesPanelProps> = ({ adjustments, onChange }) => {
  const frame = adjustments.frame ?? { style: 'none', color: '#ffffff', thickness: 5 };

  const isDefault = useMemo(() => {
    return frame.style === 'none';
  }, [frame]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      frame: { style: 'none', color: '#ffffff', thickness: 5 },
    });
  };

  const handleStyleChange = (style: typeof FRAME_TYPES[0]['id']) => {
    onChange({
      ...adjustments,
      frame: { ...frame, style: style as any },
    });
  };

  const handleThicknessChange = (thickness: number) => {
    onChange({
      ...adjustments,
      frame: { ...frame, thickness },
    });
  };

  const handleColorChange = (color: string) => {
    onChange({
      ...adjustments,
      frame: { ...frame, color },
    });
  };

  const showColorPicker = frame.style === 'matte' || frame.style === 'thinline';
  const showThicknessSlider = frame.style !== 'none' && frame.style !== 'polaroid' && frame.style !== 'filmstrip' && frame.style !== 'rounded';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Borders & Frames
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors"
          >
            <RotateCcw size={9} /> Reset
          </button>
        )}
      </div>

      {/* ── Frames Grid ── */}
      <div className="px-4 pb-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Frame Style
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FRAME_TYPES.map(style => {
            const isActive = frame.style === style.id;
            return (
              <button
                key={style.id}
                onClick={() => handleStyleChange(style.id)}
                className={`py-2.5 px-3 rounded-xl text-left flex flex-col justify-between h-[64px] border transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-primary bg-primary/5 text-white'
                    : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-[10px] font-bold tracking-wide leading-none">{style.name}</span>
                <span className="text-[8px] text-white/20 font-medium leading-tight">{style.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Settings Section ── */}
      {frame.style !== 'none' && (
        <div className="px-4 pt-5 pb-6 space-y-5">
          {/* Thickness Slider */}
          {showThicknessSlider && (
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                  Border Thickness
                </label>
                <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                  {frame.thickness}%
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                  style={{
                    left: '0%',
                    width: `${frame.thickness}%`,
                    boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                  }}
                />
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={frame.thickness}
                  onChange={e => handleThicknessChange(Number(e.target.value))}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>
          )}

          {/* Color Picker */}
          {showColorPicker && (
            <div className="space-y-3">
              <label className="text-[11px] font-medium text-white/40 leading-none select-none">
                Border Color
              </label>

              {/* Presets + Custom Color picker */}
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(color => {
                  const isColorActive = frame.color.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex}
                      onClick={() => handleColorChange(color.hex)}
                      className={`w-6 h-6 rounded-lg border transition-all duration-200 cursor-pointer ${
                        isColorActive
                          ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-md shadow-black/40'
                          : 'border-white/10 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  );
                })}

                {/* Custom Color Input */}
                <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-white/5 hover:scale-105 transition-transform duration-200">
                  <input
                    type="color"
                    value={frame.color}
                    onChange={e => handleColorChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/10"
                    style={{ backgroundColor: frame.color }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Frame Info Alert */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[9px] text-white/20 leading-relaxed">
              👉 Note: Border layers expand the final dimensions at export time to preserve original photo pixels without cropping. The cropper screen will show a visual indicator.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
