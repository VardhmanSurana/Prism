import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Check,
  Sliders,
  Grid,
  Calendar,
  Layers,
  RotateCcw,
  Sparkles,
  Map,
  Compass,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  Film,
  Zap,
} from 'lucide-react';
import { useGalleryLayout, ImageGrouping } from '../../hooks/useGalleryLayout';
import { useTelemetry } from '../../hooks/useTelemetry';

export type ColorTheme = 'dark' | 'light' | 'system';
export type AccentTone = 'gold' | 'gray' | 'emerald' | 'indigo';
export type InterfaceDensity = 'compact' | 'standard' | 'spacious';
export type ThumbnailQuality = '320px' | '640px' | '1280px';
export type MediaSortOrder = 'date_desc' | 'date_asc' | 'date_added' | 'camera_model' | 'rating';
export type GridAspectRatio = 'uncropped' | 'square' | 'classic';
export type MapStyle = 'monochrome' | 'satellite' | 'topographic';

const SAMPLE_IMAGES = [
  { id: 'nature', url: '/sample_images/nature.png', label: 'Nature' },
  { id: 'pet', url: '/sample_images/pet.png', label: 'Pet' },
  { id: 'woman', url: '/sample_images/woman.png', label: 'Portrait' },
];

const IMAGE_GROUPING_OPTIONS: { value: ImageGrouping; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'All Photos', description: 'Continuous fluid grid without date section headers', icon: <Grid size={16} /> },
  { value: 'months', label: 'Months Grouping', description: 'Group photos chronologically by month', icon: <Calendar size={16} /> },
  { value: 'years', label: 'Years Grouping', description: 'High-level annual view for multi-year libraries', icon: <Layers size={16} /> },
];

export const Appearance: React.FC = () => {
  const { settings, setImageGrouping, setCornerRadius, setPhotoDensity } = useGalleryLayout();
  const { logAction } = useTelemetry();

  // 1. Theme & Visuals
  const [theme, setTheme] = useState<ColorTheme>(() => (localStorage.getItem('prism_theme') as ColorTheme) || 'dark');
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('prism_language') || 'en-US');
  const [accent, setAccent] = useState<AccentTone>(() => (localStorage.getItem('prism_accent') as AccentTone) || 'gray');

  // 2. Layout & Density
  const [density, setDensity] = useState<InterfaceDensity>(() => (localStorage.getItem('prism_density') as InterfaceDensity) || 'standard');
  const [previewQuality, setPreviewQuality] = useState<ThumbnailQuality>(() => (localStorage.getItem('prism_preview_quality') as ThumbnailQuality) || '640px');
  const [sortOrder, setSortOrder] = useState<MediaSortOrder>(() => (localStorage.getItem('prism_sort_order') as MediaSortOrder) || 'date_desc');
  const [aspectRatio, setAspectRatio] = useState<GridAspectRatio>(() => (localStorage.getItem('prism_aspect_ratio') as GridAspectRatio) || 'uncropped');

  // 3. Behavior & Interaction
  const [groupBurst, setGroupBurst] = useState<boolean>(() => localStorage.getItem('prism_burst_grouping') !== 'false');
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => localStorage.getItem('prism_auto_advance') !== 'false');
  const [playheadSnapping, setPlayheadSnapping] = useState<boolean>(() => localStorage.getItem('prism_playhead_snapping') !== 'false');
  const [kineticScrolling, setKineticScrolling] = useState<boolean>(() => localStorage.getItem('prism_kinetic_scrolling') !== 'false');

  // 4. Map & Geography
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => (localStorage.getItem('prism_map_style') as MapStyle) || 'monochrome');
  const [locationPrivacy, setLocationPrivacy] = useState<boolean>(() => localStorage.getItem('prism_location_fuzzing') === 'true');

  // Corner radius sample state
  const [selectedSample, setSelectedSample] = useState('/sample_images/nature.png');
  const [prevRadius, setPrevRadius] = useState(settings.cornerRadius > 0 ? settings.cornerRadius : 8);

  // Status feedback toast
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved locally to config.json');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const notifySaved = (msg: string = 'All changes saved locally to config.json') => {
    setSaveStatus(msg);
    setTimeout(() => {
      setSaveStatus('All changes saved locally to config.json');
    }, 2500);
  };

  // Sync state changes with persistence
  const updateSetting = <T,>(key: string, val: T, setter: (v: T) => void, logTag: string) => {
    setter(val);
    localStorage.setItem(key, String(val));
    logAction('Appearance', logTag, { value: String(val) });
    notifySaved();
  };

  // Reset to Factory Defaults
  const handleResetDefaults = () => {
    setIsResetting(true);
    setTimeout(() => {
      // Theme
      setTheme('dark');
      localStorage.setItem('prism_theme', 'dark');
      setLanguage('en-US');
      localStorage.setItem('prism_language', 'en-US');
      setAccent('gray');
      localStorage.setItem('prism_accent', 'gray');

      // Layout
      setDensity('standard');
      localStorage.setItem('prism_density', 'standard');
      setPhotoDensity('default');
      setPreviewQuality('640px');
      localStorage.setItem('prism_preview_quality', '640px');
      setSortOrder('date_desc');
      localStorage.setItem('prism_sort_order', 'date_desc');
      setAspectRatio('uncropped');
      localStorage.setItem('prism_aspect_ratio', 'uncropped');

      // Behavior
      setGroupBurst(true);
      localStorage.setItem('prism_burst_grouping', 'true');
      setAutoAdvance(true);
      localStorage.setItem('prism_auto_advance', 'true');
      setPlayheadSnapping(true);
      localStorage.setItem('prism_playhead_snapping', 'true');
      setKineticScrolling(true);
      localStorage.setItem('prism_kinetic_scrolling', 'true');

      // Map
      setMapStyle('monochrome');
      localStorage.setItem('prism_map_style', 'monochrome');
      setLocationPrivacy(false);
      localStorage.setItem('prism_location_fuzzing', 'false');

      // Gallery
      setImageGrouping('none');
      setCornerRadius(0);

      setIsResetting(false);
      notifySaved('Defaults restored & written to config.json');
    }, 500);
  };

  return (
    <div className="relative min-h-screen bg-[#151312] text-[#e7e1df] p-4 sm:p-8 select-none overflow-x-hidden">
      {/* Atmospheric Editorial Backlight Orbs */}
      <div className="pointer-events-none absolute -top-12 -left-20 w-96 h-96 rounded-full bg-[#c6c6c7]/5 blur-3xl -z-10" />
      <div className="pointer-events-none absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#484745]/20 blur-3xl -z-10" />
      <div className="pointer-events-none absolute top-2/3 left-1/4 w-80 h-80 rounded-full bg-[#373433]/30 blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto space-y-8 pb-24 relative z-10">
        {/* Sticky Header & Action Bar */}
        <header className="sticky top-0 z-30 pt-2 pb-5 bg-[#151312]/90 backdrop-blur-md border-b border-white/[0.04]">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-[#998f8a] uppercase">
                  Studio Preferences
                </span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#998f8a]" />
                <span className="font-mono text-[10px] text-[#c9c6c4]">v4.8.2-r1</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#e7e1df] tracking-tight font-normal">
                Appearance &amp; Personalization
              </h1>
              <p className="text-xs sm:text-sm text-[#a8a29e] font-light leading-relaxed">
                Configure visual density, color themes, display typography, and timeline navigation behaviors across your local studio workspace.
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isResetting}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] border border-white/5 transition-all active:scale-95 shadow-sm text-xs font-mono"
                title="Revert all settings to factory configuration"
              >
                <RotateCcw size={14} className={`text-[#a8a29e] transition-transform ${isResetting ? 'animate-spin' : 'group-hover:-rotate-45'}`} />
                <span>{isResetting ? 'Reverting...' : 'Reset to Defaults'}</span>
              </button>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#998f8a]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
                <span>{saveStatus}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* ═══════════ SECTION 1: THEME & VISUALS ═══════════ */}
          <section className="bg-[#1d1b1a] rounded-2xl p-6 sm:p-8 space-y-6 border border-white/5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#211f1e] flex items-center justify-center text-[#c6c6c7]">
                  <Palette size={16} />
                </div>
                <h2 className="font-serif text-xl text-[#e7e1df]">Theme &amp; Visuals</h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
                01 // Chromatics
              </span>
            </div>

            <div className="space-y-4">
              {/* Setting 1: Color Theme */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Color Theme</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Select the baseline chromatic surface. Prism renders in hardware-accelerated dark obsidian with high dynamic range color contrast.
                  </p>
                </div>

                <div className="inline-flex p-1 bg-[#100e0d] rounded-full gap-1 self-start md:self-center border border-white/5">
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_theme', 'dark', setTheme, 'color_theme')}
                    className={`px-4 py-1.5 rounded-full font-mono text-xs flex items-center gap-2 transition-all ${
                      theme === 'dark'
                        ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                        : 'text-[#998f8a] hover:text-[#e7e1df]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#e7e1df]" />
                    <span>Obsidian Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_theme', 'light', setTheme, 'color_theme')}
                    className={`px-4 py-1.5 rounded-full font-mono text-xs flex items-center gap-2 transition-all ${
                      theme === 'light'
                        ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                        : 'text-[#998f8a] hover:text-[#e7e1df]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#998f8a]" />
                    <span>Quiet Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_theme', 'system', setTheme, 'color_theme')}
                    className={`px-4 py-1.5 rounded-full font-mono text-xs flex items-center gap-2 transition-all ${
                      theme === 'system'
                        ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                        : 'text-[#998f8a] hover:text-[#e7e1df]'
                    }`}
                  >
                    <SlidersHorizontal size={12} />
                    <span>System Sync</span>
                  </button>
                </div>
              </div>

              {/* Setting 2: App Language */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">App Language</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#998f8a]">
                      Default Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Interface language for system menus, tooltips, and contextual AI metadata tags.
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <select
                    value={language}
                    onChange={(e) => updateSetting('prism_language', e.target.value, setLanguage, 'app_language')}
                    className="w-full appearance-none bg-[#100e0d] text-[#e7e1df] font-mono text-xs px-4 py-2.5 rounded-full border border-white/5 focus:outline-none focus:border-white/20 cursor-pointer transition-all"
                  >
                    <option value="en-US">English (US) — Primary</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="ja-JP">日本語</option>
                    <option value="es-ES">Español</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3 text-[#998f8a]" />
                </div>
              </div>

              {/* Setting 3: Accent Tone & Vibrancy */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Accent Tone &amp; Vibrancy</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Subtle luminous highlight tint applied to active states, scrubber needles, and selection boundaries.
                  </p>
                </div>

                {/* Swatch Selector */}
                <div className="flex items-center gap-2 self-start md:self-center bg-[#100e0d] p-1.5 rounded-full border border-white/5">
                  {/* Prism Gold / Amber */}
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_accent', 'gold', setAccent, 'accent_tone')}
                    title="Prism Amber Gold"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      accent === 'gold' ? 'bg-[#3b3937] shadow-sm ring-1 ring-amber-400/50' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      {accent === 'gold' && <Check size={11} className="text-[#100e0d] stroke-[3]" />}
                    </span>
                  </button>

                  {/* Warm Luminous Gray */}
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_accent', 'gray', setAccent, 'accent_tone')}
                    title="Warm Luminous Gray"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      accent === 'gray' ? 'bg-[#3b3937] shadow-sm ring-1 ring-white/50' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-[#c6c6c7] flex items-center justify-center">
                      {accent === 'gray' && <Check size={11} className="text-[#100e0d] stroke-[3]" />}
                    </span>
                  </button>

                  {/* Emerald Sage */}
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_accent', 'emerald', setAccent, 'accent_tone')}
                    title="Emerald Sage"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      accent === 'emerald' ? 'bg-[#3b3937] shadow-sm ring-1 ring-emerald-500/50' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      {accent === 'emerald' && <Check size={11} className="text-[#100e0d] stroke-[3]" />}
                    </span>
                  </button>

                  {/* Indigo Blue */}
                  <button
                    type="button"
                    onClick={() => updateSetting('prism_accent', 'indigo', setAccent, 'accent_tone')}
                    title="Indigo Blue"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      accent === 'indigo' ? 'bg-[#3b3937] shadow-sm ring-1 ring-indigo-400/50' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center">
                      {accent === 'indigo' && <Check size={11} className="text-[#100e0d] stroke-[3]" />}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════ SECTION 2: LAYOUT & DENSITY ═══════════ */}
          <section className="bg-[#1d1b1a] rounded-2xl p-6 sm:p-8 space-y-6 border border-white/5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#211f1e] flex items-center justify-center text-[#c6c6c7]">
                  <LayoutGrid size={16} />
                </div>
                <h2 className="font-serif text-xl text-[#e7e1df]">Layout &amp; Density</h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
                02 // Spatial Grid
              </span>
            </div>

            <div className="space-y-4">
              {/* Setting 1: Interface Density */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Interface Density</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Controls spacing margins, padding, and information compactness across the gallery grid and inspector sidebars.
                  </p>
                </div>

                <div className="inline-flex p-1 bg-[#100e0d] rounded-full gap-1 self-start md:self-center border border-white/5">
                  {(['compact', 'standard', 'spacious'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        updateSetting('prism_density', d, setDensity, 'interface_density');
                        setPhotoDensity(d === 'compact' ? 'compact' : d === 'spacious' ? 'relaxed' : 'default');
                      }}
                      className={`px-3 py-1.5 rounded-full font-mono text-xs transition-all ${
                        density === d
                          ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                          : 'text-[#998f8a] hover:text-[#e7e1df]'
                      }`}
                    >
                      {d === 'compact' ? 'Compact (Dense)' : d === 'standard' ? 'Standard Editorial' : 'Spacious / Monograph'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Setting 2: Thumbnail Preview Quality */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Thumbnail Preview Quality</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#998f8a]">
                      Default Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Local WebP mipmap resolution rendered on disk cache. High quality consumes additional NVMe headroom.
                  </p>
                </div>

                <div className="inline-flex p-1 bg-[#100e0d] rounded-full gap-1 self-start md:self-center border border-white/5">
                  {(['320px', '640px', '1280px'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => updateSetting('prism_preview_quality', q, setPreviewQuality, 'preview_quality')}
                      className={`px-3 py-1.5 rounded-full font-mono text-xs transition-all ${
                        previewQuality === q
                          ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                          : 'text-[#998f8a] hover:text-[#e7e1df]'
                      }`}
                    >
                      {q === '320px' ? 'Performance (320px)' : q === '640px' ? 'Balanced (640px Retina)' : 'Master RAW (1280px HiDPI)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Setting 3: Default Media Sort Order */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Default Media Sort Order</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Initial sequencing algorithm applied when opening the global timeline or uncurated media collections.
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <select
                    value={sortOrder}
                    onChange={(e) => updateSetting('prism_sort_order', e.target.value as MediaSortOrder, setSortOrder, 'media_sort_order')}
                    className="w-full appearance-none bg-[#100e0d] text-[#e7e1df] font-mono text-xs px-4 py-2.5 rounded-full border border-white/5 focus:outline-none focus:border-white/20 cursor-pointer transition-all"
                  >
                    <option value="date_desc">Date Captured (Newest First)</option>
                    <option value="date_asc">Date Captured (Oldest First)</option>
                    <option value="date_added">Date Ingested / Added</option>
                    <option value="camera_model">Camera Model &amp; Shutter Count</option>
                    <option value="rating">Editorial Star Rating</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3 text-[#998f8a]" />
                </div>
              </div>

              {/* Setting 4: Gallery Grid Aspect Ratio */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Gallery Grid Aspect Ratio</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#998f8a]">
                      Default Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Display crops for the primary photo grid. Uncropped preserves original camera sensor framing.
                  </p>
                </div>

                <div className="inline-flex p-1 bg-[#100e0d] rounded-full gap-1 self-start md:self-center border border-white/5">
                  {(['uncropped', 'square', 'classic'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateSetting('prism_aspect_ratio', r, setAspectRatio, 'aspect_ratio')}
                      className={`px-3 py-1.5 rounded-full font-mono text-xs transition-all ${
                        aspectRatio === r
                          ? 'bg-[#3b3937] text-[#e7e1df] shadow-sm font-medium'
                          : 'text-[#998f8a] hover:text-[#e7e1df]'
                      }`}
                    >
                      {r === 'uncropped' ? 'Original Uncropped' : r === 'square' ? 'Square 1:1' : 'Classic 3:2'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Setting 5: Image View Mode Grouping */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 space-y-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Gallery Grouping Hierarchy</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Structure the chronological timeline with section headers or continuous scrolling.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {IMAGE_GROUPING_OPTIONS.map((opt) => {
                    const isActive = settings.imageGrouping === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          logAction('Appearance', 'image_grouping', { value: opt.value });
                          setImageGrouping(opt.value);
                          notifySaved();
                        }}
                        className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                          isActive
                            ? 'bg-[#2c2928] border-white/20 text-[#f5f0ed] shadow-md'
                            : 'bg-[#100e0d] border-white/5 text-[#998f8a] hover:border-white/10 hover:text-[#e7e1df]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={isActive ? 'text-white' : 'text-[#998f8a]'}>{opt.icon}</span>
                            <span className="text-xs font-medium font-serif">{opt.label}</span>
                          </div>
                          {isActive && <Check size={12} className="text-emerald-400" />}
                        </div>
                        <span className="text-[11px] text-[#78716c] font-light leading-normal">
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Setting 6: Custom Corner Roundness Studio */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 space-y-4 hover:border-white/10 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base text-[#e7e1df]">Corner Roundness Studio</span>
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                        Live Engine
                      </span>
                    </div>
                    <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                      Adjust border radiuses for gallery tiles, lightbox previews, and thumbnail sheet cards.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      {settings.cornerRadius}px
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = settings.cornerRadius > 0 ? 0 : prevRadius;
                        setCornerRadius(next);
                        notifySaved();
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                        settings.cornerRadius > 0 ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                          settings.cornerRadius > 0 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Real-time Visual Preview Tile */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#100e0d] border border-white/5">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <img
                      src={selectedSample}
                      alt="Corner radius preview"
                      className="w-20 h-20 object-cover shadow-lg border border-white/20 transition-[border-radius] duration-200 ease-out"
                      style={{ borderRadius: `${settings.cornerRadius}px` }}
                    />
                    <span className="text-[10px] font-mono text-[#78716c]">Live Sample</span>
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#998f8a]">Sample Asset:</span>
                        <div className="flex gap-1.5">
                          {SAMPLE_IMAGES.map((img) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setSelectedSample(img.url)}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${
                                selectedSample === img.url
                                  ? 'bg-[#2c2928] text-[#f5f0ed] border border-white/20 font-medium'
                                  : 'bg-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              {img.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={settings.cornerRadius}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCornerRadius(val);
                        if (val > 0) setPrevRadius(val);
                        notifySaved();
                      }}
                      className="w-full h-2 appearance-none bg-[#211f1e] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#e7e1df] [&::-webkit-slider-thumb]:shadow-md cursor-pointer border border-white/5"
                    />
                    <div className="flex justify-between font-mono text-[10px] text-[#78716c]">
                      <span>0px (Sharp)</span>
                      <span>8px</span>
                      <span>16px</span>
                      <span>32px (Pill)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════ SECTION 3: BEHAVIOR & INTERACTION ═══════════ */}
          <section className="bg-[#1d1b1a] rounded-2xl p-6 sm:p-8 space-y-6 border border-white/5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#211f1e] flex items-center justify-center text-[#c6c6c7]">
                  <Zap size={16} />
                </div>
                <h2 className="font-serif text-xl text-[#e7e1df]">Behavior &amp; Interaction</h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
                03 // Workflow Ergonomics
              </span>
            </div>

            <div className="space-y-4">
              {/* Setting 1: Group Burst Sequences */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Group Burst Sequences</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Automatically stack high-speed continuous shutter captures into a single master exposure tile with a frame count badge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('prism_burst_grouping', !groupBurst, setGroupBurst, 'burst_grouping')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                    groupBurst ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                      groupBurst ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 2: Auto-Advance on Pick / Reject */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Auto-Advance on Pick / Reject</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#100e0d] font-mono text-[10px] tracking-wider text-[#998f8a] uppercase border border-white/5">
                      Keybind: P / X
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Immediately jump to the next photo in sequence after flagging (P), unflagging (U), or rejecting (X) during rapid culling.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('prism_auto_advance', !autoAdvance, setAutoAdvance, 'auto_advance')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                    autoAdvance ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                      autoAdvance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 3: Timeline Playhead Snapping */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Timeline Playhead Snapping</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#998f8a]">
                      Default Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Magnetic snapping of the video playhead and scrubber needle to keyframes, audio waveform peaks, and clip cut points.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('prism_playhead_snapping', !playheadSnapping, setPlayheadSnapping, 'playhead_snapping')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                    playheadSnapping ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                      playheadSnapping ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 4: Smooth Kinetic Scrolling */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Smooth Kinetic Scrolling</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#998f8a]">
                      Default Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Hardware-accelerated inertia dampening when navigating multi-thousand photo chronologies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('prism_kinetic_scrolling', !kineticScrolling, setKineticScrolling, 'kinetic_scrolling')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                    kineticScrolling ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                      kineticScrolling ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* ═══════════ SECTION 4: MAP & GEOGRAPHY ═══════════ */}
          <section className="bg-[#1d1b1a] rounded-2xl p-6 sm:p-8 space-y-6 border border-white/5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#211f1e] flex items-center justify-center text-[#c6c6c7]">
                  <Compass size={16} />
                </div>
                <h2 className="font-serif text-xl text-[#e7e1df]">Map &amp; Geography</h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
                04 // Spatial Cartography
              </span>
            </div>

            <div className="space-y-4">
              {/* Setting 1: Map Style (3 Cards) */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 space-y-4 hover:border-white/10 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Map Style</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed max-w-2xl">
                    Base cartographic tile provider for geographic photo clusters, EXIF location inspector, and expedition routes.
                  </p>
                </div>

                {/* 3 Visual Map Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Dark Vector Monochrome */}
                  <div
                    onClick={() => updateSetting('prism_map_style', 'monochrome', setMapStyle, 'map_style')}
                    className={`cursor-pointer group relative rounded-xl bg-[#100e0d] overflow-hidden p-3 transition-all border ${
                      mapStyle === 'monochrome'
                        ? 'border-white/40 bg-[#3b3937]/30 ring-1 ring-white/20'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="relative h-28 w-full rounded-lg overflow-hidden bg-[#211f1e] flex items-center justify-center">
                      <svg className="w-full h-full text-[#4d4541]/40" fill="none" viewBox="0 0 300 120">
                        <path d="M0 30 C 50 60, 100 20, 180 80 C 220 110, 260 40, 300 60" stroke="currentColor" strokeWidth="2" opacity="0.4" />
                        <path d="M0 70 C 80 40, 140 100, 200 40 C 240 10, 280 80, 300 90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
                        <circle cx="180" cy="80" r="4" className="fill-[#c6c6c7]" />
                        <circle cx="90" cy="35" r="3" className="fill-[#998f8a]" />
                        <circle cx="240" cy="30" r="3" className="fill-[#998f8a]" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d] via-transparent to-transparent" />
                      {mapStyle === 'monochrome' && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c6c6c7] text-[#100e0d] flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="pt-2 px-1">
                      <div className="font-serif text-sm text-[#e7e1df]">Dark Vector Monochrome</div>
                      <div className="text-[11px] text-[#78716c] font-light mt-0.5">Vector lines optimized for dark room studio editing.</div>
                    </div>
                  </div>

                  {/* Card 2: Satellite High-Res */}
                  <div
                    onClick={() => updateSetting('prism_map_style', 'satellite', setMapStyle, 'map_style')}
                    className={`cursor-pointer group relative rounded-xl bg-[#100e0d] overflow-hidden p-3 transition-all border ${
                      mapStyle === 'satellite'
                        ? 'border-white/40 bg-[#3b3937]/30 ring-1 ring-white/20'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="relative h-28 w-full rounded-lg overflow-hidden bg-[#211f1e] flex items-center justify-center">
                      <img
                        className="w-full h-full object-cover filter contrast-125 opacity-70 group-hover:opacity-90 transition-opacity"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL4pDBu0fNnNOBHGkCdzsxwTY-olmuGiEGPeXrGe-yEzLCmXw_UCq_OQYs9y4pjQ5eVeUDcS8yfiqJ6TdF8zW8u84oR0CvSzlvY8dE_9Zmhr6F32SgwmMiC9FV04nLxX_J5yU8kEq1fGerUwbgeYXcNkeTZdeV-JEczJ4RoXalnTw78D56G6tXtWAlz8X1mWu5s0-ZSRHQi58Ryb0XcOa2UHksbVVSRiwmZ8W_GzgUo0NzHBzJrgx0Bg"
                        alt="High-resolution aerial satellite imagery"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d] via-transparent to-transparent" />
                      {mapStyle === 'satellite' && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c6c6c7] text-[#100e0d] flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="pt-2 px-1">
                      <div className="font-serif text-sm text-[#e7e1df]">Satellite High-Res</div>
                      <div className="text-[11px] text-[#78716c] font-light mt-0.5">Multi-spectral satellite imagery with elevation relief.</div>
                    </div>
                  </div>

                  {/* Card 3: Topographic Terrain */}
                  <div
                    onClick={() => updateSetting('prism_map_style', 'topographic', setMapStyle, 'map_style')}
                    className={`cursor-pointer group relative rounded-xl bg-[#100e0d] overflow-hidden p-3 transition-all border ${
                      mapStyle === 'topographic'
                        ? 'border-white/40 bg-[#3b3937]/30 ring-1 ring-white/20'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="relative h-28 w-full rounded-lg overflow-hidden bg-[#211f1e] flex items-center justify-center">
                      <svg className="w-full h-full text-[#4d4541]/40" fill="none" viewBox="0 0 300 120">
                        <ellipse cx="150" cy="60" rx="120" ry="45" stroke="currentColor" strokeWidth="1" />
                        <ellipse cx="150" cy="60" rx="90" ry="32" stroke="currentColor" strokeWidth="1" />
                        <ellipse cx="150" cy="60" rx="60" ry="20" stroke="currentColor" strokeWidth="1" />
                        <ellipse cx="150" cy="60" rx="30" ry="10" stroke="currentColor" strokeWidth="1" />
                        <circle cx="150" cy="60" r="2" className="fill-[#998f8a]" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d] via-transparent to-transparent" />
                      {mapStyle === 'topographic' && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c6c6c7] text-[#100e0d] flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="pt-2 px-1">
                      <div className="font-serif text-sm text-[#e7e1df]">Topographic Terrain</div>
                      <div className="text-[11px] text-[#78716c] font-light mt-0.5">Hypsometric contour lines and mountain peak elevations.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Setting 2: Location Privacy & Geo-Fuzzing */}
              <div className="bg-[#211f1e] p-5 rounded-xl border border-white/5 flex items-center justify-between gap-4 hover:border-white/10 transition-colors">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-[#e7e1df]">Location Privacy &amp; Geo-Fuzzing</span>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#373433] text-[#d0c4be]">
                      User Layer
                    </span>
                  </div>
                  <p className="text-xs text-[#a8a29e] font-light leading-relaxed">
                    Obfuscate precise GPS coordinates by 100m when sharing or exporting photos outside the local vault.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('prism_location_fuzzing', !locationPrivacy, setLocationPrivacy, 'location_fuzzing')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-white/10 ${
                    locationPrivacy ? 'bg-[#c6c6c7]' : 'bg-[#100e0d]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#100e0d] shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                      locationPrivacy ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Appearance;
