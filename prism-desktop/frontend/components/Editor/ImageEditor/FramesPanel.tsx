/**
 * FramesPanel.tsx
 * Renders border and frame styles, atmospheric effects (grain, warmth, vignette),
 * retro light leaks (customizable colors/positions), and canvas transform controls.
 */

import React, { useMemo, useCallback, useRef } from 'react';
import { useRafThrottledValue } from './useRafThrottledValue';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Grid,
  Sun,
  Flame,
  Aperture,
  Compass,
} from 'lucide-react';
import { Adjustments } from './filterEngine';
import { resolveUrl } from '@/constants';

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

const LEAKS = [
  { id: 'warm-left', name: 'Warm Left' },
  { id: 'cool-top', name: 'Cool Top' },
  { id: 'rainbow-corner', name: 'Rainbow' },
  { id: 'soft-glow', name: 'Soft Glow' },
  { id: 'sunset-bleed', name: 'Sunset Bleed' },
  { id: 'vintage-haze', name: 'Vintage Haze' },
];

const LEAK_COLORS = [
  { hex: '#fb923c', name: 'Amber' },
  { hex: '#38bdf8', name: 'Sky Blue' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#fde047', name: 'Yellow' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#d97706', name: 'Orange' },
  { hex: '#10b881', name: 'Emerald' },
];

const LEAK_POSITIONS = [
  { value: 'left', label: 'Left Edge' },
  { value: 'right', label: 'Right Edge' },
  { value: 'top', label: 'Top Edge' },
  { value: 'bottom', label: 'Bottom Edge' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'center', label: 'Center Glow' },
  { value: 'top-left', label: 'Top Left' },
];

const LEAK_PREVIEW_GRADIENTS: Record<string, string> = {
  'warm-left': 'linear-gradient(to right, rgba(251, 146, 60, 0.6) 0%, rgba(251, 146, 60, 0) 100%)',
  'cool-top': 'linear-gradient(to bottom, rgba(56, 189, 248, 0.6) 0%, rgba(56, 189, 248, 0) 100%)',
  'rainbow-corner': 'radial-gradient(circle at top right, rgba(236, 72, 153, 0.6) 0%, rgba(59, 130, 246, 0.4) 40%, transparent 100%)',
  'soft-glow': 'radial-gradient(circle at center, rgba(253, 224, 71, 0.6) 0%, transparent 70%)',
  'sunset-bleed': 'radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.6) 0%, rgba(249, 115, 22, 0.4) 50%, transparent 100%)',
  'vintage-haze': 'linear-gradient(135deg, rgba(217, 119, 6, 0.6) 0%, rgba(16, 185, 129, 0.3) 50%, transparent 100%)',
};

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
  const frame = adjustments.frame ?? { style: 'none', color: '#ffffff', thickness: 5 };
  const grain = adjustments.grain ?? { amount: 0, size: 'medium', colored: false };
  const lightLeak = adjustments.lightLeak ?? { preset: null, opacity: 50, color: undefined, position: undefined };
  const temperature = adjustments.temperature ?? 0;
  const vignette = adjustments.vignette ?? 0;

  // Throttle slider updates to keep drag smooth.
  // The UI remains controlled by these local throttled values.
  const { value: thicknessUI, setRafValue: setThicknessUI } = useRafThrottledValue<number>(frame.thickness);
  const { value: temperatureUI, setRafValue: setTemperatureUI } = useRafThrottledValue<number>(temperature);
  const { value: vignetteUI, setRafValue: setVignetteUI } = useRafThrottledValue<number>(vignette);
  const { value: grainAmountUI, setRafValue: setGrainAmountUI } = useRafThrottledValue<number>(grain.amount);
  const { value: lightLeakOpacityUI, setRafValue: setLightLeakOpacityUI } = useRafThrottledValue<number>(lightLeak.opacity);

  const lastCommitRef = useRef({
    thickness: frame.thickness,
    temperature,
    vignette,
    grainAmount: grain.amount,
    lightLeakOpacity: lightLeak.opacity,
  });

  // If parent updates external values (e.g. reset), sync UI immediately.
  if (lastCommitRef.current.thickness !== frame.thickness) {
    lastCommitRef.current.thickness = frame.thickness;
    setThicknessUI(frame.thickness);
  }
  if (lastCommitRef.current.temperature !== temperature) {
    lastCommitRef.current.temperature = temperature;
    setTemperatureUI(temperature);
  }
  if (lastCommitRef.current.vignette !== vignette) {
    lastCommitRef.current.vignette = vignette;
    setVignetteUI(vignette);
  }
  if (lastCommitRef.current.grainAmount !== grain.amount) {
    lastCommitRef.current.grainAmount = grain.amount;
    setGrainAmountUI(grain.amount);
  }
  if (lastCommitRef.current.lightLeakOpacity !== lightLeak.opacity) {
    lastCommitRef.current.lightLeakOpacity = lightLeak.opacity;
    setLightLeakOpacityUI(lightLeak.opacity);
  }

  const commitThickness = useCallback((next: number) => {
    onChange({
      ...adjustments,
      frame: { ...frame, thickness: next },
    });
  }, [onChange, adjustments, frame]);

  const commitTemperature = useCallback((next: number) => {
    onChange({
      ...adjustments,
      temperature: next,
    });
  }, [onChange, adjustments]);

  const commitVignette = useCallback((next: number) => {
    onChange({
      ...adjustments,
      vignette: next,
    });
  }, [onChange, adjustments]);

  const commitGrainAmount = useCallback((next: number) => {
    onChange({
      ...adjustments,
      grain: { ...grain, amount: next },
    });
  }, [onChange, adjustments, grain]);

  const commitLightLeakOpacity = useCallback((next: number) => {
    onChange({
      ...adjustments,
      lightLeak: { ...lightLeak, opacity: next },
    });
  }, [onChange, adjustments, lightLeak]);

  const previewUrl = useMemo(() => {
    if (!imageSrc) return '';
    const resolved = resolveUrl(imageSrc);
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}previewKey=${Date.now()}`;
  }, [imageSrc]);

  const isDefault = useMemo(() => {
    return (
      frame.style === 'none' &&
      grain.amount === 0 &&
      lightLeak.preset === null &&
      temperature === 0 &&
      vignette === 0
    );
  }, [frame, grain, lightLeak, temperature, vignette]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      frame: { style: 'none', color: '#ffffff', thickness: 5 },
      grain: { amount: 0, size: 'medium', colored: false },
      lightLeak: { preset: null, opacity: 50, color: undefined, position: undefined },
      temperature: 0,
      vignette: 0,
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

  const handleGrainChange = (updates: Partial<typeof grain>) => {
    onChange({
      ...adjustments,
      grain: { ...grain, ...updates },
    });
  };

  const handleLeakChange = (updates: Partial<typeof lightLeak>) => {
    onChange({
      ...adjustments,
      lightLeak: { ...lightLeak, ...updates },
    });
  };

  const handleTemperatureChange = (temp: number) => {
    onChange({
      ...adjustments,
      temperature: temp,
    });
  };

  const handleVignetteChange = (vig: number) => {
    onChange({
      ...adjustments,
      vignette: vig,
    });
  };

  const showColorPicker = frame.style === 'matte' || frame.style === 'thinline';
  const showThicknessSlider =
    frame.style !== 'none' &&
    frame.style !== 'polaroid' &&
    frame.style !== 'filmstrip' &&
    frame.style !== 'rounded';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Frames & Atmosphere
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors"
          >
            <RotateCcw size={9} /> Reset Panel
          </button>
        )}
      </div>

      {/* ── Canvas Transform Controls (Rotation/Mirroring) ── */}
      <div className="px-4 py-4 border-b border-white/5 bg-white/[0.01]">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3 flex items-center gap-1.5">
          <Compass size={10} /> Canvas Transform
        </p>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleRotate(-90)}
            className="py-2 px-1 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 text-white/80 hover:text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
            title="Rotate Left 90°"
          >
            <RotateCcw size={14} />
            <span className="text-[8px] font-bold uppercase tracking-wide">Left</span>
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="py-2 px-1 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 text-white/80 hover:text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
            title="Rotate Right 90°"
          >
            <RotateCw size={14} />
            <span className="text-[8px] font-bold uppercase tracking-wide">Right</span>
          </button>
          <button
            onClick={handleFlipH}
            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              flipH
                ? 'border-primary bg-primary/10 text-white'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-white/80 hover:text-white'
            }`}
            title="Mirror Horizontally"
          >
            <FlipHorizontal size={14} />
            <span className="text-[8px] font-bold uppercase tracking-wide">Horiz</span>
          </button>
          <button
            onClick={handleFlipV}
            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              flipV
                ? 'border-primary bg-primary/10 text-white'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-white/80 hover:text-white'
            }`}
            title="Mirror Vertically"
          >
            <FlipVertical size={14} />
            <span className="text-[8px] font-bold uppercase tracking-wide">Vert</span>
          </button>
        </div>
      </div>

      {/* ── Frames Grid ── */}
      <div className="px-4 py-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4 flex items-center gap-1.5">
          <Grid size={10} /> Border Frame Style
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FRAME_TYPES.map(style => {
            const isActive = frame.style === style.id;
            return (
              <button
                key={style.id}
                onClick={() => handleStyleChange(style.id)}
                className={`py-2.5 px-3 rounded-xl text-left flex flex-col justify-between h-[56px] border transition-all duration-200 cursor-pointer ${
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

        {frame.style !== 'none' && (
          <div className="mt-4 space-y-4">
            {/* Thickness Slider */}
            {showThicknessSlider && (
              <div className="group/item">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-[10px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                    Border Thickness
                  </label>
                  <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                    {frame.thickness}%
                  </span>
                </div>
              <div className="relative h-4 flex items-center">
                  <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                  <div
                    className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                    style={{
                      left: '0%',
                      width: `${frame.thickness * 5}%`,
                      boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                    }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={thicknessUI}
                    onChange={e => setThicknessUI(Number(e.target.value))}
                    onPointerUp={() => commitThickness(thicknessUI)}
                    onMouseUp={() => commitThickness(thicknessUI)}
                    className="adjustment-slider slider-thumb-premium"
                  />
                </div>
              </div>
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

      {/* ── Atmospheric Sliders (Warmth, Vignette, Grain) ── */}
      <div className="px-4 py-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4 flex items-center gap-1.5">
          <Sun size={10} /> Atmospheric Adjustments
        </p>
        <div className="space-y-4">
          {/* Warmth (Temperature) */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[10px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Warmth (Color Temp)
              </label>
              <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                {temperature > 0 ? `+${temperature}` : temperature}
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: temperature >= 0 ? '50%' : `${50 + (temperature / 2)}%`,
                  width: `${Math.abs(temperature) / 2}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={-100}
                max={100}
                value={temperature}
                onChange={e => handleTemperatureChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {/* Vignette */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[10px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Edge Vignette
              </label>
              <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                {vignette > 0 ? `+${vignette}` : vignette}
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: vignette >= 0 ? '50%' : `${50 + (vignette / 2)}%`,
                  width: `${Math.abs(vignette) / 2}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={-100}
                max={100}
                value={vignette}
                onChange={e => handleVignetteChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {/* Analog Grain Amount */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[10px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Analog Film Grain
              </label>
              <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                {grain.amount}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${grain.amount}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={grain.amount}
                onChange={e => handleGrainChange({ amount: Number(e.target.value) })}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {grain.amount > 0 && (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Grain Size */}
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-medium text-white/40">Grain Size</span>
                <div className="flex bg-white/[0.02] border border-white/5 rounded-lg p-0.5">
                  {(['fine', 'medium', 'coarse'] as const).map(size => {
                    const isActive = grain.size === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleGrainChange({ size })}
                        className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colored Grain Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-medium text-white/40">Colored Grain</span>
                <button
                  onClick={() => handleGrainChange({ colored: !grain.colored })}
                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none cursor-pointer ${
                    grain.colored ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform duration-300 ${
                      grain.colored ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Retro Light Leaks ── */}
      <div className="px-4 py-5 pb-8">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4 flex items-center gap-1.5">
          <Flame size={10} /> Retro Light Leaks
        </p>

        {/* Leaks Grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          <button
            onClick={() => handleLeakChange({ preset: null })}
            className={`group/leak relative aspect-square rounded-xl overflow-hidden border transition-all duration-200 flex flex-col items-center justify-center p-2 cursor-pointer ${
              lightLeak.preset === null
                ? 'border-primary ring-2 ring-primary/20 scale-105 bg-primary/5'
                : 'border-white/5 hover:border-white/20 bg-black/40 text-white/40 hover:text-white/60'
            }`}
          >
            {imageSrc ? (
              <img
                src={previewUrl}
                alt="None"
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/leak:opacity-60 transition-opacity"
                crossOrigin="anonymous"
              />
            ) : null}
            <span className="relative z-10 text-[8px] font-bold uppercase tracking-wider leading-none">None</span>
          </button>
          {LEAKS.map(leak => {
            const isActive = lightLeak.preset === leak.id;
            return (
              <button
                key={leak.id}
                onClick={() => handleLeakChange({ preset: leak.id })}
                className={`group/leak relative aspect-square rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-end p-2 cursor-pointer ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-lg shadow-black/40'
                    : 'border-white/5 hover:border-white/20 bg-black/40'
                }`}
              >
                {imageSrc ? (
                  <img
                    src={previewUrl}
                    alt={leak.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                    crossOrigin="anonymous"
                  />
                ) : null}
                <div
                  className="absolute inset-0 z-0 pointer-events-none"
                  style={{ background: LEAK_PREVIEW_GRADIENTS[leak.id] }}
                />
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-glow" />
                  </div>
                )}
                <span className="relative z-10 text-[9px] font-bold leading-none tracking-tight text-white/80 group-hover/leak:text-white transition-colors truncate w-full">
                  {leak.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Customizable Leak Overlays (Position & Colors) */}
        {lightLeak.preset && (
          <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Leak Intensity Slider */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[10px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                  Leak Intensity
                </label>
                <span className="text-[9px] font-mono text-primary font-bold tabular-nums">
                  {lightLeak.opacity}%
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                  style={{
                    left: '0%',
                    width: `${lightLeak.opacity}%`,
                    boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                  }}
                />
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={lightLeak.opacity}
                  onChange={e => handleLeakChange({ opacity: Number(e.target.value) })}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>

            {/* Custom Color Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-white/40 leading-none select-none">
                Custom Color Overlay
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Default/Reset Color button */}
                <button
                  onClick={() => handleLeakChange({ color: undefined })}
                  className={`w-5.5 h-5.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                    lightLeak.color === undefined
                      ? 'border-primary ring-2 ring-primary/20 scale-110 bg-white/10 text-white font-bold'
                      : 'border-white/10 bg-black/30 hover:scale-105 text-white/30 hover:text-white/60'
                  }`}
                  title="Default Preset Color"
                >
                  <span className="text-[7px] leading-none uppercase">Def</span>
                </button>

                {LEAK_COLORS.map(color => {
                  const isColorActive = lightLeak.color?.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex}
                      onClick={() => handleLeakChange({ color: color.hex })}
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
                    value={lightLeak.color || '#fb923c'}
                    onChange={e => handleLeakChange({ color: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/10"
                    style={{ backgroundColor: lightLeak.color || '#fb923c' }}
                  />
                </div>
              </div>
            </div>

            {/* Position Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-white/40 leading-none select-none">
                Overlay Position
              </label>
              <div className="relative group">
                <select
                  value={lightLeak.position || ''}
                  onChange={e =>
                    handleLeakChange({
                      position: (e.target.value === '' ? undefined : e.target.value) as any,
                    })
                  }
                  className="w-full appearance-none bg-[#111] border border-white/10 text-white/90 text-xs rounded-xl pl-3 pr-10 py-2 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer group-hover:bg-[#161616]"
                >
                  <option value="" className="bg-[#111] text-white/50 py-2">
                    Default Position
                  </option>
                  {LEAK_POSITIONS.map(pos => (
                    <option key={pos.value} value={pos.value} className="bg-[#111] text-white py-2">
                      {pos.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/60 transition-colors">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 1L5 5L9 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
