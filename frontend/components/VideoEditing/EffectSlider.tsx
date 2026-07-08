import React from 'react';

interface EffectSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

export const EffectSlider: React.FC<EffectSliderProps> = ({ label, value, onChange, min, max }) => (
  <div className="mb-2">
    <div className="flex items-center justify-between mb-0.5">
      <span className="text-[#999] text-[10px]">{label}</span>
      <span className="text-[#ccc] text-[10px]">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-[#3b82f6] h-1"
    />
  </div>
);
