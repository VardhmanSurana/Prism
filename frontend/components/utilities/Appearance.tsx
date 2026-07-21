import React from 'react';
import { useGalleryLayout, RowHeight, PhotoDensity } from '../../hooks/useGalleryLayout';
import { Palette } from 'lucide-react';


const ROW_HEIGHT_OPTIONS: { value: RowHeight; label: string; desc: string }[] = [
  { value: 'compact', label: 'Compact', desc: '200px rows' },
  { value: 'default', label: 'Default', desc: '280px rows' },
  { value: 'spacious', label: 'Spacious', desc: '360px rows' },
];

const DENSITY_OPTIONS: { value: PhotoDensity; label: string; desc: string }[] = [
  { value: 'relaxed', label: 'Relaxed', desc: '3 photos/row' },
  { value: 'default', label: 'Default', desc: '4 photos/row' },
  { value: 'compact', label: 'Compact', desc: '5 photos/row' },
];

export const Appearance: React.FC = () => {
  const { settings, setRowHeight, setPhotoDensity } = useGalleryLayout();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
      {/* Left Column: Title & Description */}
      <div className="lg:col-span-1 pr-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={16} className="text-[#5e6ad2]" />
          <h4 className="font-serif italic text-white text-xl leading-tight">
            Gallery Layout Config
          </h4>
        </div>
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          Customize the density and sizing dimensions of your media timeline grid viewport. Changes are preserved and applied in real time to your active gallery view.
        </p>
      </div>

      {/* Right Column: Interactive cards */}
      <div className="lg:col-span-2 space-y-6 bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Row Height */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-500 mb-4">
              Row Sizing Height
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {ROW_HEIGHT_OPTIONS.map((opt) => {
                const isActive = settings.rowHeight === opt.value;
                const lineCount = opt.value === 'compact' ? 4 : opt.value === 'default' ? 3 : 2;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRowHeight(opt.value)}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-350 h-32 justify-center gap-3 active:scale-[0.98] ${
                      isActive
                        ? 'border-[#5e6ad2] bg-[#5e6ad2]/[0.04] shadow-[0_0_15px_rgba(94,106,210,0.15)]'
                        : 'border-white/[0.05] bg-white/[0.005] hover:border-white/[0.1] hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Mini row preview */}
                    <div className="w-10 h-7 flex flex-col justify-center gap-1.5 select-none">
                      {Array.from({ length: lineCount }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-full transition-all duration-300 ${
                            isActive ? 'bg-[#828fff]' : 'bg-white/10'
                          }`}
                          style={{ 
                            height: opt.value === 'compact' ? '2px' : opt.value === 'default' ? '3px' : '5px',
                            opacity: 1 - (i * (1/lineCount) * 0.4)
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-[8px] font-mono text-gray-600 mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Density */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-500 mb-4">
              Grid Photo Density
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {DENSITY_OPTIONS.map((opt) => {
                const isActive = settings.photoDensity === opt.value;
                const count = opt.value === 'relaxed' ? 3 : opt.value === 'default' ? 4 : 5;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPhotoDensity(opt.value)}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-350 h-32 justify-center gap-3 active:scale-[0.98] ${
                      isActive
                        ? 'border-[#5e6ad2] bg-[#5e6ad2]/[0.04] shadow-[0_0_15px_rgba(94,106,210,0.15)]'
                        : 'border-white/[0.05] bg-white/[0.005] hover:border-white/[0.1] hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Mini grid preview */}
                    <div className="w-10 h-7 flex items-center justify-center gap-1 select-none">
                      {Array.from({ length: count }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-sm transition-all duration-300 ${
                            isActive ? 'bg-[#828fff] shadow-[0_0_4px_rgba(130,143,255,0.4)]' : 'bg-white/10'
                          }`}
                          style={{ 
                            width: `${(40 / count) - 3}px`,
                            aspectRatio: '1/1',
                            opacity: 1 - (i * (1/count) * 0.4)
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-[8px] font-mono text-gray-600 mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



