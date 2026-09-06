/**
 * EditorSlider.tsx
 * Unified Slider component for the Image Editor Studio matching the requested UI design.
 *
 * Features:
 *  - Clean typography: crisp label on left, bold yellow/gold mono value on right
 *  - Thin, elegant 2px track with solid white circular thumb
 *  - Custom track gradients for Temperature, Hue, Tint, etc.
 *  - Bipolar center-notch indicator for -100..+100 sliders
 *  - Double-click reset to default value
 */

import React, { useCallback } from 'react';

export interface EditorSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  icon?: React.ReactNode;
  disabled?: boolean;
  bipolar?: boolean;
  trackBackground?: string;
  hideFill?: boolean;
  className?: string;
}

export const EditorSlider: React.FC<EditorSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  unit = '',
  formatValue,
  icon,
  disabled = false,
  bipolar,
  trackBackground,
  hideFill,
  className = '',
}) => {
  const isBipolar = bipolar ?? (min < 0 && max > 0);

  // Handle double-click reset
  const handleReset = useCallback(() => {
    if (disabled) return;
    const resetVal = defaultValue !== undefined ? defaultValue : (isBipolar ? 0 : min);
    onChange(resetVal);
  }, [defaultValue, disabled, isBipolar, min, onChange]);

  // Format the displayed text
  const displayValue = formatValue
    ? formatValue(value)
    : isBipolar && value > 0
    ? `+${value}${unit ? ` ${unit.trim()}` : ''}`
    : `${value}${unit ? ` ${unit.trim()}` : ''}`;

  return (
    <div className={`space-y-1.5 select-none ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}>
      {/* ── Label on left, Bold Yellow Value on right ── */}
      <div className="flex justify-between items-baseline">
        <span
          onDoubleClick={handleReset}
          title={defaultValue !== undefined ? `Double-click to reset (${defaultValue}${unit})` : undefined}
          className="text-[12px] font-normal text-white/70 tracking-wide flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
        >
          {icon && <span className="text-[#FCBC00] shrink-0">{icon}</span>}
          <span>{label}</span>
        </span>
        <span
          onDoubleClick={handleReset}
          title={defaultValue !== undefined ? `Double-click to reset (${defaultValue}${unit})` : undefined}
          className="text-[12px] font-mono font-bold text-[#FCBC00] tabular-nums cursor-pointer hover:brightness-125 transition-all select-none"
        >
          {displayValue}
        </span>
      </div>

      {/* ── Slider Track with Clean White Thumb ── */}
      <div className="relative h-4 flex items-center">
        {/* Background track */}
        <div
          className="absolute w-full h-[2px] bg-white/10 rounded-full pointer-events-none"
          style={trackBackground ? { background: trackBackground, height: '4px' } : undefined}
        />

        {/* Center notch for bipolar sliders */}
        {isBipolar && !trackBackground && (
          <div className="absolute left-1/2 -translate-x-1/2 w-[1px] h-2 bg-white/20 rounded-full pointer-events-none z-[1]" />
        )}

        {/* Range input */}
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          disabled={disabled}
          className="adjustment-slider relative z-10 w-full cursor-pointer"
        />
      </div>
    </div>
  );
};
