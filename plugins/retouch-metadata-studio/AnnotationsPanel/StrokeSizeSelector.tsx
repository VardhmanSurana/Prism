/**
 * StrokeSizeSelector.tsx
 * MS Paint-style stroke weight selector:
 * 4 quick-select thickness chips with visual stroke lines (Fine 2px, Medium 6px, Bold 16px, Broad 36px)
 * plus a full-range continuous slider from 1px to 80px.
 */

import React from 'react';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

interface StrokeSizeSelectorProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

const PRESET_SIZES = [
  { label: 'Fine', size: 2, heightPx: 2 },
  { label: 'Medium', size: 6, heightPx: 4 },
  { label: 'Bold', size: 16, heightPx: 8 },
  { label: 'Broad', size: 36, heightPx: 14 },
];

export const StrokeSizeSelector: React.FC<StrokeSizeSelectorProps> = ({
  label = 'Stroke Size',
  value,
  onChange,
  min = 1,
  max = 80,
}) => {
  return (
    <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl shadow-md">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
            {label}
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold text-primary">
          {Math.round(value)} px
        </span>
      </div>

      {/* 4 MS Paint Classic Size Presets */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        {PRESET_SIZES.map((preset) => {
          const isActive = Math.round(value) === preset.size;
          return (
            <button
              key={preset.size}
              type="button"
              onClick={() => onChange(preset.size)}
              title={`${preset.label} (${preset.size}px)`}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary/25 border-primary text-white shadow-sm ring-1 ring-primary/40'
                  : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.07] hover:border-white/10'
              }`}
            >
              {/* Visual stroke bar preview */}
              <div className="w-full flex items-center justify-center h-4 mb-1">
                <span
                  className={`w-4/5 rounded-full ${
                    isActive ? 'bg-primary' : 'bg-zinc-400 group-hover:bg-white'
                  }`}
                  style={{ height: `${preset.heightPx}px` }}
                />
              </div>
              <span className="text-[8px] font-semibold tracking-tight">{preset.label}</span>
              <span className="text-[7.5px] text-zinc-500">{preset.size}px</span>
            </button>
          );
        })}
      </div>

      {/* Continuous Slider (1px - 80px) */}
      <div className="pt-1">
        <EditorSlider
          label="Custom Width"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          defaultValue={6}
          unit=" px"
        />
      </div>
    </div>
  );
};

