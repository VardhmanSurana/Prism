import React from 'react';
import { ResizeOption } from './types';

interface BrowserResizerProps {
  resizeWidth: number | undefined;
  onResize: (value: number | undefined) => void;
}

export const BrowserResizer: React.FC<BrowserResizerProps> = ({ resizeWidth, onResize }) => {
  const options: ResizeOption[] = [
    { label: 'Original', value: undefined },
    { label: '1920px (FHD)', value: 1920 },
    { label: '1280px (HD)', value: 1280 },
    { label: '800px (Mobile)', value: 800 },
  ];

  return (
    <div className="mt-4 space-y-2.5">
      <h5 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Import Resizer Option</h5>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onResize(opt.value)}
            className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer text-center
              ${resizeWidth === opt.value
                ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-white/30 leading-relaxed mt-1">
        Resize reduces files larger than target width on ingestion, freeing device storage. Mutated copies go to library; originals are untouched.
      </p>
    </div>
  );
};