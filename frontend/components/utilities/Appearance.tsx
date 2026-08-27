import React, { useState } from 'react';
import { useGalleryLayout, GalleryStyle, ImageGrouping } from '../../hooks/useGalleryLayout';
import { useTelemetry } from '../../hooks/useTelemetry';
import { Palette, Check, Lock, Sparkles, Sliders, Grid, Calendar, Layers, Search, Eye, X, ShieldCheck } from 'lucide-react';
import { Switch } from '../ui';

interface ThemeOption {
  value: GalleryStyle;
  label: string;
  subtitle: string;
  description: string;
  available: boolean;
  accentColor: string;
  tags: string[];
}

const GALLERY_STYLE_OPTIONS: ThemeOption[] = [
  {
    value: 'prism',
    label: 'Prism Dark Glass',
    subtitle: 'Signature Obsidian & Ambient Glow',
    description: 'Deep obsidian canvas featuring dynamic ambient glows, translucent glassmorphism cards, and customizable corner roundness.',
    available: true,
    accentColor: '#10b981',
    tags: ['Glassmorphism', 'Ambient Glow', 'Custom Rounding']
  },
  {
    value: 'google',
    label: 'Google Photos',
    subtitle: 'Material 3 Dark Experience',
    description: 'Material 3 inspired dark interface featuring a top floating search pill, smart category chips, and clean standardized tiles.',
    available: true,
    accentColor: '#8ab4f8',
    tags: ['Material 3 Search', 'Category Chips', 'Clean Grid']
  },
  {
    value: 'apple',
    label: 'Apple Photos',
    subtitle: 'iPadOS 18 Translucent Glass Sidebar',
    description: 'Apple Photos iPadOS 18 layout featuring Pinned & Utilities collections, iOS Blue highlights, and floating bottom segment controls.',
    available: true,
    accentColor: '#0a84ff',
    tags: ['iPadOS 18 Sidebar', 'Pinned & Utilities', 'iOS Blue Accent', 'Floating Segment Bar']
  }
];

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
 * Appearance settings: gallery style, image grouping, corner radius and live preview.
 */
export const Appearance: React.FC = () => {
  const { settings, setGalleryStyle, setImageGrouping, setCornerRadius } = useGalleryLayout();
  const { logAction } = useTelemetry();
  const isPrism = settings.galleryStyle === 'prism';
  const [prevRadius, setPrevRadius] = useState(settings.cornerRadius > 0 ? settings.cornerRadius : 8);
  const [selectedSample, setSelectedSample] = useState('/sample_images/nature.png');
  const [previewModalTheme, setPreviewModalTheme] = useState<GalleryStyle | null>(null);

  /**
   * Renders a miniature gallery preview for a given theme style.
   * @param style - Gallery style to preview.
   * @returns JSX preview element.
   */
  const renderThemePreview = (style: GalleryStyle) => {
    switch (style) {
      case 'prism':
        return (
          <div className="w-full h-36 rounded-xl bg-[#090b10] border border-emerald-500/30 p-2.5 mb-4 relative overflow-hidden flex flex-col justify-between shadow-inner transition-transform duration-300 group-hover:scale-[1.01]">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />
            
            {/* Header bar */}
            <div className="flex items-center justify-between backdrop-blur-md bg-white/[0.05] border border-white/10 px-2 py-1 rounded-lg z-10">
              <div className="flex items-center gap-1 text-[9px] font-serif text-white italic">
                <Sparkles size={10} className="text-emerald-400" />
                <span>Prism Gallery</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] text-zinc-400 font-mono">
                <Search size={8} />
                <span>Filter photos...</span>
              </div>
            </div>

            {/* Real Photo Grid inside Prism Glass Cards */}
            <div className="grid grid-cols-3 gap-1.5 my-1 z-10">
              <div className="relative h-14 rounded-lg overflow-hidden border border-emerald-500/40 shadow-md">
                <img src="/sample_images/nature.png" alt="Nature" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-emerald-500/10" />
              </div>
              <div className="relative h-14 rounded-lg overflow-hidden border border-emerald-500/40 shadow-md">
                <img src="/sample_images/pet.png" alt="Pet" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-emerald-500/10" />
              </div>
              <div className="relative h-14 rounded-lg overflow-hidden border border-emerald-500/40 shadow-md">
                <img src="/sample_images/woman.png" alt="Portrait" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-emerald-500/10" />
              </div>
            </div>

            {/* Layout footer */}
            <div className="flex items-center justify-between text-[8px] font-mono text-emerald-400 z-10">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Glassmorphic Theme</span>
              <span className="text-zinc-400">Custom Radius</span>
            </div>
          </div>
        );

      case 'google':
        return (
          <div className="w-full h-36 rounded-xl bg-[#131314] border border-white/10 p-2.5 mb-4 relative overflow-hidden flex flex-col justify-between transition-transform duration-300 group-hover:scale-[1.01]">
            {/* Google Search Pill */}
            <div className="bg-[#1e1f22] border border-white/10 px-2 py-1 rounded-full flex items-center justify-between text-[8px] text-zinc-300">
              <div className="flex items-center gap-1">
                <Search size={9} className="text-blue-400" />
                <span className="font-sans font-medium text-zinc-300">Search your photos</span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[7px] font-bold">G</div>
            </div>

            {/* Material 3 Category Pill Chips */}
            <div className="flex items-center gap-1 my-0.5">
              <span className="px-1.5 py-0.5 rounded-full bg-[#28292c] text-blue-300 text-[7px] font-medium border border-blue-400/30">Favorites</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#1e1f22] text-zinc-400 text-[7px]">Videos</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#1e1f22] text-zinc-400 text-[7px]">Screenshots</span>
            </div>

            {/* Material 3 Photo Grid */}
            <div className="grid grid-cols-3 gap-1">
              <div className="h-12 rounded-lg overflow-hidden border border-white/10">
                <img src="/sample_images/nature.png" alt="Nature" className="w-full h-full object-cover" />
              </div>
              <div className="h-12 rounded-lg overflow-hidden border border-white/10">
                <img src="/sample_images/pet.png" alt="Pet" className="w-full h-full object-cover" />
              </div>
              <div className="h-12 rounded-lg overflow-hidden border border-white/10">
                <img src="/sample_images/woman.png" alt="Portrait" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[8px] font-sans text-blue-400 font-medium">
              <span>Material 3 Dark Mode</span>
              <span className="text-zinc-500">Auto Chips</span>
            </div>
          </div>
        );

      case 'apple':
        return (
          <div className="w-full h-36 rounded-xl bg-[#000000] border border-white/10 p-2.5 mb-4 relative overflow-hidden flex flex-col justify-between transition-transform duration-300 group-hover:scale-[1.01]">
            {/* iCloud Translucent Top Segment Nav */}
            <div className="backdrop-blur-md bg-white/10 border border-white/10 px-1 py-0.5 rounded-md flex items-center justify-around text-[7px] text-zinc-300 font-sans font-medium">
              <span className="px-1.5 py-0.5 bg-white/20 text-white rounded font-bold">Years</span>
              <span className="text-zinc-400">Months</span>
              <span className="text-zinc-400">Days</span>
              <span className="text-zinc-400">All Photos</span>
            </div>

            {/* Apple iCloud Mosaic Photo Grid */}
            <div className="grid grid-cols-3 gap-1 my-0.5">
              <div className="h-12 rounded-md overflow-hidden border border-white/10">
                <img src="/sample_images/nature.png" alt="Nature" className="w-full h-full object-cover" />
              </div>
              <div className="h-12 rounded-md overflow-hidden border border-white/10">
                <img src="/sample_images/pet.png" alt="Pet" className="w-full h-full object-cover" />
              </div>
              <div className="h-12 rounded-md overflow-hidden border border-white/10">
                <img src="/sample_images/woman.png" alt="Portrait" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Floating iOS Bottom Tab Bar */}
            <div className="backdrop-blur-md bg-white/10 border border-white/10 rounded-full px-3 py-0.5 flex justify-between items-center text-[7px] font-medium">
              <span className="text-rose-400 font-bold">Library</span>
              <span className="text-zinc-400">Memories</span>
              <span className="text-zinc-400">Search</span>
            </div>
          </div>
        );
    }
  };

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
              Compare gallery layout styles with realistic UI previews, live photo sample controls, and custom corner roundness.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-zinc-300">Active Theme:</span>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">{settings.galleryStyle}</span>
          </div>
        </div>
      </div>

      {/* Section 1: Gallery Theme Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            Gallery Theme Options & Live Previews
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Select a theme card to apply</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {GALLERY_STYLE_OPTIONS.map((opt) => {
            const isActive = settings.galleryStyle === opt.value;
            return (
              <div
                key={opt.value}
                className={`group relative text-left rounded-2xl p-5 backdrop-blur-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                  !opt.available
                    ? 'opacity-50 bg-black/30 border-white/[0.05]'
                    : isActive
                      ? 'bg-emerald-500/[0.07] border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.12)]'
                      : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                {/* Realistic Theme UI Preview Box */}
                {renderThemePreview(opt.value)}

                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base text-white group-hover:text-emerald-300 transition-colors">
                        {opt.label}
                      </span>
                      {isActive ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                          <Check size={14} />
                        </div>
                      ) : !opt.available ? (
                        <span className="text-[10px] font-mono uppercase bg-white/10 text-zinc-400 px-2 py-0.5 rounded">Coming Soon</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 font-medium">{opt.subtitle}</div>
                    <p className={`text-xs leading-relaxed pt-1 ${isActive ? 'text-emerald-200/90' : 'text-zinc-400'}`}>
                      {opt.description}
                    </p>
                  </div>

                  {/* Feature Tags List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap gap-1">
                      {opt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (opt.available) {
                            logAction('Appearance', 'theme_change', { from: settings.galleryStyle, to: opt.value });
                            setGalleryStyle(opt.value);
                          }
                        }}
                        disabled={!opt.available}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                          isActive
                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20 font-bold'
                            : !opt.available
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                        }`}
                      >
                        {isActive ? '✓ Active Theme' : opt.available ? 'Apply Theme' : 'Locked'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewModalTheme(opt.value)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-colors"
                        title="View Detailed Layout Breakdown"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Gallery Page Customization */}
      <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-serif text-white flex items-center gap-2">
              <Sliders size={18} className="text-emerald-400" />
              Gallery Customization Engine
            </h2>
            <p className="text-xs text-zinc-400">
              Fine-tune grouping hierarchy and corner radiuses for your active gallery theme.
            </p>
          </div>
          {!isPrism && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Lock size={12} />
              <span>Locked for {settings.galleryStyle}</span>
            </div>
          )}
        </div>

        {!isPrism && (
          <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Lock size={16} className="shrink-0 text-amber-400" />
              <span>Customizations below are locked for the current theme. Select <strong>Prism Dark Glass</strong> theme above to unlock.</span>
            </div>
            <button
              type="button"
              onClick={() => setGalleryStyle('prism')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-mono text-xs font-bold shrink-0 hover:bg-emerald-400 transition-colors"
            >
              Switch to Prism
            </button>
          </div>
        )}

        <div className={!isPrism ? 'opacity-40 pointer-events-none space-y-8' : 'space-y-8'}>
          {/* Image grouping */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">Image View Mode (Grouping)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {IMAGE_GROUPING_OPTIONS.map((opt) => {
                const isActive = settings.imageGrouping === opt.value;
                return (
                  <button
                    key={opt.value}
                    disabled={!isPrism}
                    onClick={() => {
                      logAction('Appearance', 'image_grouping', { value: opt.value });
                      setImageGrouping(opt.value);
                    }}
                    className={`flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-200 border backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                        : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/50'
                    } ${!isPrism ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
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
                disabled={!isPrism}
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
                  disabled={!isPrism || settings.cornerRadius === 0}
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

      {/* Detailed Theme Breakdown Modal */}
      {previewModalTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0f14] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                <h3 className="text-lg font-serif text-white">
                  {GALLERY_STYLE_OPTIONS.find(t => t.value === previewModalTheme)?.label} Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalTheme(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                {renderThemePreview(previewModalTheme)}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">Key Differences & Layout Highlights:</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {GALLERY_STYLE_OPTIONS.find(t => t.value === previewModalTheme)?.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPreviewModalTheme(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-mono hover:bg-white/20"
                >
                  Close Preview
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const opt = GALLERY_STYLE_OPTIONS.find(t => t.value === previewModalTheme);
                    if (opt && opt.available) {
                      setGalleryStyle(previewModalTheme);
                      setPreviewModalTheme(null);
                    }
                  }}
                  disabled={!GALLERY_STYLE_OPTIONS.find(t => t.value === previewModalTheme)?.available}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-mono font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Select This Theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
