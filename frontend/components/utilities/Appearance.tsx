import React from 'react';
import { useGalleryLayout, RowHeight, PhotoDensity } from '../../hooks/useGalleryLayout';

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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Gallery Layout */}
      <section className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8">
        <div className="mb-8">
          <h3 className="font-serif italic text-white text-xl leading-tight">
            Gallery Layout
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Control the size and density of your photo grid
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Row Height */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-gray-500 mb-6">
              Row Height
            </p>
            <div className="grid grid-cols-3 gap-3">
              {ROW_HEIGHT_OPTIONS.map((opt) => {
                const isActive = settings.rowHeight === opt.value;
                const lineCount = opt.value === 'compact' ? 4 : opt.value === 'default' ? 3 : 2;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRowHeight(opt.value)}
                    className={`flex flex-col items-center p-4 rounded-2xl border transition-all duration-500 h-32 justify-center gap-3 ${
                      isActive
                        ? 'border-primary bg-primary/[0.08] shadow-[0_0_20px_rgba(var(--color-primary),0.1)]'
                        : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Mini row preview */}
                    <div className="w-12 h-8 flex flex-col justify-center gap-1.5">
                      {Array.from({ length: lineCount }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-full transition-all duration-500 ${
                            isActive ? 'bg-primary' : 'bg-white/10'
                          }`}
                          style={{ 
                            height: opt.value === 'compact' ? '2px' : opt.value === 'default' ? '4px' : '6px',
                            opacity: 1 - (i * (1/lineCount) * 0.5)
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600 mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Density */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-gray-500 mb-6">
              Photo Density
            </p>
            <div className="grid grid-cols-3 gap-3">
              {DENSITY_OPTIONS.map((opt) => {
                const isActive = settings.photoDensity === opt.value;
                const count = opt.value === 'relaxed' ? 3 : opt.value === 'default' ? 4 : 5;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPhotoDensity(opt.value)}
                    className={`flex flex-col items-center p-4 rounded-2xl border transition-all duration-500 h-32 justify-center gap-3 ${
                      isActive
                        ? 'border-primary bg-primary/[0.08] shadow-[0_0_20px_rgba(var(--color-primary),0.1)]'
                        : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Mini grid preview */}
                    <div className="w-12 h-8 flex items-center justify-center gap-1">
                      {Array.from({ length: count }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-sm transition-all duration-500 ${
                            isActive ? 'bg-primary shadow-[0_0_5px_rgba(var(--color-primary),0.4)]' : 'bg-white/10'
                          }`}
                          style={{ 
                            width: `${(48 / count) - 4}px`,
                            aspectRatio: '1/1',
                            opacity: 1 - (i * (1/count) * 0.5)
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600 mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
