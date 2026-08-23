/**
 * FramesPanel.tsx
 * Renders border and frame styles (Polaroid, Film Strip, Matte, Rounded, Thin Line, Shadow Box)
 * with color/thickness customization and canvas orientation transform controls.
 */

import React, { useMemo, useCallback, useRef } from 'react';
import { useRafThrottledValue } from './useRafThrottledValue';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Grid,
} from 'lucide-react';
import { Adjustments, DEFAULT_FRAME } from './filterEngine';
import { resolveUrl } from '@/constants';
import { EditorSlider } from './ui/EditorSlider';

interface FramesPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
  handleRotate: (degree: number) => void;
  handleFlipH: () => void;
  handleFlipV: () => void;
  flipH: boolean;
  flipV: boolean;
  imageSrc?: string;
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

export const FramesPanel: React.FC<FramesPanelProps> = ({
  adjustments,
  onChange,
  handleRotate,
  handleFlipH,
  handleFlipV,
  flipH,
  flipV,
  imageSrc,
}) => {
  const frame = adjustments.frame ?? { ...DEFAULT_FRAME };

  const { value: thicknessUI, setRafValue: setThicknessUI } = useRafThrottledValue<number>(frame.thickness);

  const lastCommitRef = useRef({
    thickness: frame.thickness,
  });

  if (lastCommitRef.current.thickness !== frame.thickness) {
    lastCommitRef.current.thickness = frame.thickness;
    setThicknessUI(frame.thickness);
  }

  const commitThickness = useCallback((next: number) => {
    onChange({
      ...adjustments,
      frame: { ...frame, thickness: next },
    });
  }, [onChange, adjustments, frame]);

  const previewUrl = useMemo(() => {
    if (!imageSrc) return '';
    const resolved = resolveUrl(imageSrc);
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}previewKey=${Date.now()}`;
  }, [imageSrc]);

  const isDefault = useMemo(() => {
    return frame.style === 'none';
  }, [frame]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      frame: { ...DEFAULT_FRAME },
    });
  };

  const handleFrameStyleSelect = (styleId: any) => {
    onChange({
      ...adjustments,
      frame: {
        ...frame,
        style: styleId,
      },
    });
  };

  const handleColorChange = (hex: string) => {
    onChange({
      ...adjustments,
      frame: {
        ...frame,
        color: hex,
      },
    });
  };

  const showThicknessSlider = ['matte', 'rounded', 'thinline', 'shadowbox'].includes(frame.style);
  const showColorPicker = ['matte', 'rounded', 'thinline', 'shadowbox', 'polaroid'].includes(frame.style);

  return (
    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar text-white pb-6 select-none">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Frames & Borders
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors cursor-pointer"
          >
            <RotateCcw size={9} /> Reset
          </button>
        )}
      </div>

      {/* ── Transform (Rotate & Flip) Section ── */}
      <div className="px-4 pb-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3 flex items-center gap-1.5">
          <Grid size={10} /> Orientation
        </p>

        <div className="grid grid-cols-4 gap-1.5 bg-white/[0.02] border border-white/5 rounded-xl p-1.5">
          <button
            onClick={() => handleRotate(-90)}
            className="editor-btn editor-chip-btn py-1.5 flex flex-col items-center justify-center gap-1 hover:text-primary transition-colors cursor-pointer"
            title="Rotate 90° CCW"
          >
            <RotateCcw size={13} />
            <span className="text-[8px] font-semibold tracking-wider">90° CCW</span>
          </button>

          <button
            onClick={() => handleRotate(90)}
            className="editor-btn editor-chip-btn py-1.5 flex flex-col items-center justify-center gap-1 hover:text-primary transition-colors cursor-pointer"
            title="Rotate 90° CW"
          >
            <RotateCw size={13} />
            <span className="text-[8px] font-semibold tracking-wider">90° CW</span>
          </button>

          <button
            onClick={handleFlipH}
            className={`editor-btn editor-chip-btn py-1.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              flipH ? 'active text-primary' : 'hover:text-primary'
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal size={13} />
            <span className="text-[8px] font-semibold tracking-wider">Flip H</span>
          </button>

          <button
            onClick={handleFlipV}
            className={`editor-btn editor-chip-btn py-1.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              flipV ? 'active text-primary' : 'hover:text-primary'
            }`}
            title="Flip Vertical"
          >
            <FlipVertical size={13} />
            <span className="text-[8px] font-semibold tracking-wider">Flip V</span>
          </button>
        </div>
      </div>

      {/* ── Frame Types Grid ── */}
      <div className="px-4 py-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          Border & Frame Styles
        </p>

        <div className="grid grid-cols-2 gap-2">
          {FRAME_TYPES.map(f => {
            const isActive = frame.style === f.id;
            return (
              <button
                key={f.id}
                onClick={() => handleFrameStyleSelect(f.id)}
                className={`group/frame relative aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-end p-2.5 cursor-pointer text-left ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/20 scale-[1.02] shadow-lg shadow-black/60 bg-black/60'
                    : 'border-white/5 hover:border-white/20 bg-black/40'
                }`}
              >
                {/* Live Miniature Frame Mockup */}
                <div className="absolute inset-2 mb-6 flex items-center justify-center pointer-events-none">
                  {f.id === 'none' && (
                    <div className="w-full h-full border border-dashed border-white/10 rounded flex items-center justify-center">
                      <span className="text-[9px] text-white/20">No Border</span>
                    </div>
                  )}

                  {f.id === 'polaroid' && (
                    <div className="w-full h-full bg-white p-1 pb-3 rounded-[2px] shadow flex flex-col">
                      <div className="flex-1 bg-zinc-800 rounded-[1px] overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        )}
                      </div>
                    </div>
                  )}

                  {f.id === 'filmstrip' && (
                    <div className="w-full h-full bg-black border-y-2 border-dashed border-white/40 p-1 flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-800 overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        )}
                      </div>
                    </div>
                  )}

                  {f.id === 'matte' && (
                    <div className="w-full h-full bg-zinc-200 p-2 shadow flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-800 overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        )}
                      </div>
                    </div>
                  )}

                  {f.id === 'rounded' && (
                    <div className="w-full h-full p-1 bg-white rounded-xl shadow flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-800 rounded-lg overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        )}
                      </div>
                    </div>
                  )}

                  {f.id === 'thinline' && (
                    <div className="w-full h-full border border-white p-1 flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-800 overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        )}
                      </div>
                    </div>
                  )}

                  {f.id === 'shadowbox' && (
                    <div className="w-[85%] h-[85%] bg-zinc-800 shadow-2xl shadow-black border border-white/20 overflow-hidden">
                      {previewUrl && (
                        <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                      )}
                    </div>
                  )}
                </div>

                {/* Title & Description */}
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-white/90 group-hover/frame:text-white leading-tight">
                    {f.name}
                  </p>
                  <p className="text-[8px] text-white/40 group-hover/frame:text-white/60 leading-none truncate mt-0.5">
                    {f.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Frame Customization (Thickness & Color) */}
        {frame.style !== 'none' && (
          <div className="mt-4 space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Thickness Slider */}
            {showThicknessSlider && (
              <EditorSlider
                label="Border Thickness"
                value={thicknessUI}
                onChange={val => {
                  setThicknessUI(val);
                  commitThickness(val);
                }}
                min={1}
                max={20}
                defaultValue={5}
                unit="%"
              />
            )}

            {/* Color Picker */}
            {showColorPicker && (
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-white/40 leading-none select-none">
                  Border Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map(color => {
                    const isColorActive = frame.color.toLowerCase() === color.hex.toLowerCase();
                    return (
                      <button
                        key={color.hex}
                        onClick={() => handleColorChange(color.hex)}
                        className={`w-5.5 h-5.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          isColorActive
                            ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0a0a0a] scale-110 shadow-md shadow-black/40'
                            : 'hover:scale-105 hover:ring-1 hover:ring-white/20'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    );
                  })}

                  {/* Custom Color Input */}
                  <div className="relative w-5.5 h-5.5 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-white/5 hover:scale-105 transition-transform duration-200">
                    <input
                      type="color"
                      value={frame.color}
                      onChange={e => handleColorChange(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/10"
                      style={{ backgroundColor: frame.color }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
