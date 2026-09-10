import React, { useState } from 'react';
import { useGalleryLayout, ImageGrouping } from '../../hooks/useGalleryLayout';
import { useTelemetry } from '../../hooks/useTelemetry';
import { Palette, Check, Sliders, Grid, Calendar, Layers } from 'lucide-react';
import { Switch } from '../ui';

// ponytail: simplified appearance studio, standardized on signature Prism Dark Glass theme
const IMAGE_GROUPING_OPTIONS: { value: ImageGrouping; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'All Photos', description: 'Continuous fluid grid without date section headers', icon: <Grid size={16} /> },
  { value: 'months', label: 'Months Grouping', description: 'Group photos chronologically by month', icon: <Calendar size={16} /> },
  { value: 'years', label: 'Years Grouping', description: 'High-level annual view for multi-year libraries', icon: <Layers size={16} /> },
];

const SAMPLE_IMAGES = [
  { id: 'nature', url: '/sample_images/nature.png', label: 'Nature' },
  { id: 'pet', url: '/sample_images/pet.png', label: 'Pet' },
  { id: 'woman', url: '/sample_images/woman.png', label: 'Portrait' },
];

/**
 * Appearance settings: gallery grouping, corner radius and live preview.
 */
export const Appearance: React.FC = () => {
  const { settings, setImageGrouping, setCornerRadius } = useGalleryLayout();
  const { logAction } = useTelemetry();
  const [prevRadius, setPrevRadius] = useState(settings.cornerRadius > 0 ? settings.cornerRadius : 8);
  const [selectedSample, setSelectedSample] = useState('/sample_images/nature.png');

  return (
    <div className="relative space-y-10 max-w-5xl mx-auto pb-12">
      {/* Background Ambient Glow */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="relative backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                <Palette size={22} />
              </div>
              <h1 className="text-2xl md:text-3xl font-serif text-white tracking-tight">
                Appearance Studio
              </h1>
            </div>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Customize gallery layout grouping and fine-tune image card corner radiuses with live preview.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-zinc-300">Theme:</span>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Prism Dark Glass</span>
          </div>
        </div>
      </div>

      {/* Gallery Customization Engine */}
      <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-serif text-white flex items-center gap-2">
              <Sliders size={18} className="text-emerald-400" />
              Gallery Customization Engine
            </h2>
            <p className="text-xs text-zinc-400">
              Fine-tune grouping hierarchy and corner radiuses for your photo library.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Image grouping */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">Image View Mode (Grouping)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {IMAGE_GROUPING_OPTIONS.map((opt) => {
                const isActive = settings.imageGrouping === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      logAction('Appearance', 'image_grouping', { value: opt.value });
                      setImageGrouping(opt.value);
                    }}
                    className={`flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-200 border backdrop-blur-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                        : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/50'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-white">
                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-emerald-950/60 text-emerald-300' : 'bg-white/5 text-emerald-300'}`}>
                          {opt.icon}
                        </div>
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </div>
                      {isActive && (
                        <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className={`text-xs leading-relaxed ${isActive ? 'text-emerald-200/90' : 'text-zinc-400'}`}>{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Corner Roundness Studio */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Custom Corner Roundness Studio</h3>
                <p className="text-xs text-zinc-400 mt-1">Adjust corner radiuses for gallery image cards and thumbnail tiles.</p>
              </div>
              <Switch
                label=""
                checked={settings.cornerRadius > 0}
                onToggle={() => {
                  if (settings.cornerRadius > 0) {
                    setCornerRadius(0);
                  } else {
                    setCornerRadius(prevRadius);
                  }
                }}
                ariaLabel="Toggle rounded corners"
              />
            </div>

            {/* Real-time Visual Preview Tile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <img 
                  src={selectedSample} 
                  alt="Live corner radius preview photo"
                  className="w-20 h-20 object-cover shadow-lg shadow-emerald-500/20 border border-white/30 transition-[border-radius] duration-200 ease-out"
                  style={{ borderRadius: `${settings.cornerRadius}px` }}
                />
                <span className="text-[10px] font-mono text-zinc-400">Live Card</span>
              </div>
              
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">Sample Image:</span>
                    <div className="flex gap-1.5">
                      {SAMPLE_IMAGES.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setSelectedSample(img.url)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                            selectedSample === img.url
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                              : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent'
                          }`}
                        >
                          {img.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-zinc-300">
                    <span className="font-bold text-emerald-400">{settings.cornerRadius}px</span>
                  </div>
                </div>

                <input
                  type="range"
                  id="corner-radius-input"
                  name="cornerRadius"
                  aria-label="Custom corner roundness radius"
                  min={0}
                  max={32}
                  disabled={settings.cornerRadius === 0}
                  value={settings.cornerRadius}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCornerRadius(val);
                    if (val > 0) setPrevRadius(val);
                  }}
                  className="w-full h-2 appearance-none bg-zinc-800 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                />
                <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>0px (Sharp)</span>
                  <span>8px</span>
                  <span>16px</span>
                  <span>32px (Pill)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
