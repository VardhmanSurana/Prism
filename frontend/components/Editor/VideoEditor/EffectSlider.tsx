import React from 'react';
import { Slider } from '@/components/ui/Slider';

interface EffectSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Called once at the start of a drag/keyboard gesture — use for pushHistory. */
  onGestureStart?: () => void;
  min: number;
  max: number;
}

/**
 * EffectSlider - Renders effect slider.
 */
export const EffectSlider: React.FC<EffectSliderProps> = ({ label, value, onChange, onGestureStart, min, max }) => (
  <div className="mb-3">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-white/50 text-[10px] font-medium">{label}</span>
      <span className="text-white/70 text-[10px] font-mono tabular-nums">{value}</span>
    </div>
    <Slider value={value} onValueChange={onChange} onGestureStart={onGestureStart} min={min} max={max} step={1}>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb aria-label={label} />
    </Slider>
  </div>
);
