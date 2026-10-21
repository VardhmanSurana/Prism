import React, { useState } from 'react';
import {
  Sparkles,
  LayoutGrid,
  RefreshCw,
  Stamp,
  ShieldCheck,
  Code2,
  Paintbrush,
  Palette,
  Globe,
  Scissors,
  Film,
  Type,
  FileText,
  Sliders,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  ArrowRight,
  Lock,
  Layers,
  Zap,
} from 'lucide-react';
import { photoSrc } from '@/constants';
import { Photo } from '@/types';

export type ToolTab =
  | 'pdf'
  | 'collage'
  | 'converter'
  | 'watermark'
  | 'metadata'
  | 'base64'
  | 'svg-trace'
  | 'palette'
  | 'web-load'
  | 'video-trimmer'
  | 'video-gif'
  | 'video-compress'
  | 'subtitles';

/** Bundled local sample images used when no library photo is available (offline-safe). */
const FALLBACK_PROOF_IMAGES = [
  '/sample_images/nature.png',
  '/sample_images/pet.png',
  '/sample_images/woman.png',
  '/sample_images/ai_benchmark_sample.jpg',
];

/**
 * proofImageFallback - Swaps a failed proof-plate image for a local bundled sample.
 */
const proofImageFallback = (idx: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget;
  const fallback = FALLBACK_PROOF_IMAGES[idx % FALLBACK_PROOF_IMAGES.length];
  if (el.src !== fallback && !el.dataset.fallbackApplied) {
    el.dataset.fallbackApplied = '1';
    el.src = fallback;
  } else {
    el.style.opacity = '0';
  }
};

interface StudioToolboxCatalogProps {
  photos?: Photo[];
  activeCategory: 'image' | 'video';
  onCategoryChange: (category: 'image' | 'video') => void;
  onLaunchTool: (tool: ToolTab, category: 'image' | 'video') => void;
  onOpenPdf: () => void;
  onOpenCollage: () => void;
}

export const StudioToolboxCatalog: React.FC<StudioToolboxCatalogProps> = ({
  photos = [],
  activeCategory,
  onCategoryChange,
  onLaunchTool,
  onOpenPdf,
  onOpenCollage,
}) => {
  // Collage spotlight state
  const [matteMargin, setMatteMargin] = useState<number>(24);
  const [pagePreset, setPagePreset] = useState<'folio' | 'diptych' | 'contact'>('folio');

  // Video spotlight state
  const [videoCodec, setVideoCodec] = useState<'av1' | 'hevc' | 'prores'>('av1');
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);

  // Card interactive state
  const [converterQuality, setConverterQuality] = useState<number>(85);
  const [converterFormat, setConverterFormat] = useState<'webp' | 'jpeg' | 'png' | 'avif'>('webp');
  const [watermarkPos, setWatermarkPos] = useState<number>(8); // bottom-right
  const [watermarkAlpha, setWatermarkAlpha] = useState<number>(75);
  const [copiedColorHex, setCopiedColorHex] = useState<string | null>(null);
  const [copiedBase64Snippet, setCopiedBase64Snippet] = useState(false);
  const [svgTraceThreshold, setSvgTraceThreshold] = useState<number>(4);
  const [gifFps, setGifFps] = useState<15 | 24 | 30>(24);
  const [exifScrubChecked, setExifScrubChecked] = useState({
    gps: true,
    serial: true,
    lens: true,
    timestamp: false,
  });

  // Sample archival proof images: resolve library photos through photoSrc so
  // backend-relative thumbnails render correctly, falling back to bundled local
  // sample images (offline-safe, no remote CDN dependency).
  const proofImages = [0, 1, 2, 3].map(idx => {
    const photo = photos[idx];
    const resolved = photo ? photoSrc(photo) : '';
    return resolved || FALLBACK_PROOF_IMAGES[idx % FALLBACK_PROOF_IMAGES.length];
  });

  const paletteSwatches = [
    { hex: '#1B1917', name: 'Basalt Deep' },
    { hex: '#78716C', name: 'Granite Fog' },
    { hex: '#D6D3D1', name: 'Silver Ash' },
    { hex: '#A8A29E', name: 'Pumice' },
    { hex: '#57534E', name: 'Charcoal' },
    { hex: '#E7E5E4', name: 'Warm Chalk' },
  ];

  const copyToClipboard = (text: string, type: 'color' | 'base64') => {
    navigator.clipboard?.writeText(text);
    if (type === 'color') {
      setCopiedColorHex(text);
      setTimeout(() => setCopiedColorHex(null), 2000);
    } else {
      setCopiedBase64Snippet(true);
      setTimeout(() => setCopiedBase64Snippet(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#151312] text-[#e8e1df] font-sans antialiased selection:bg-[#373433] selection:text-white pb-24">
      {/* Ambient Radial Vignette */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.06),rgba(255,255,255,0))]" />

      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14 pt-8 sm:pt-12">
        {/* ── Top Header & Pipeline Telemetry ──────────────────────────────── */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-[#2c2928]/60 relative z-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#1d1b1a] border border-[#2c2928] text-[11px] font-mono tracking-wider text-[#a8a29e]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span>Utilities Suite · v2.4</span>
              <span className="text-[#57534e]">/</span>
              <span className="text-stone-300">Wasm 64-bit Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-serif tracking-tight text-[#f5f0ed] font-normal">
              Studio Toolbox
            </h1>

            <p className="text-sm sm:text-base text-[#a8a29e] font-light leading-relaxed max-w-xl">
              High-fidelity local media transformation suite. Zero telemetry, pure client-side acceleration with WebAssembly and hardware-accelerated shaders.
            </p>
          </div>

          {/* Archival Pipeline Telemetry Card */}
          <div className="p-4 rounded-xl bg-[#1d1b1a]/80 border border-[#2c2928] backdrop-blur-md min-w-[280px] shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-[#a8a29e] pb-1 border-b border-[#2c2928]">
              <span className="uppercase tracking-widest text-[10px] text-stone-400 font-semibold">Archival Pipeline</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                IDLE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div>
                <span className="text-[#78716c] block text-[9px] uppercase">Batch Queue</span>
                <span className="text-stone-200 font-medium">0 files pending</span>
              </div>
              <div>
                <span className="text-[#78716c] block text-[9px] uppercase">Shaders</span>
                <span className="text-stone-200 font-medium">WebGL 2.0 · SIMD</span>
              </div>
            </div>
            <div className="pt-1 text-[10px] text-[#78716c] font-mono flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400/80" />
              <span>Archival Integrity: Local Sandbox</span>
            </div>
          </div>
        </header>

        {/* ── Segmented Category Switch ───────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-between">
          <div className="inline-flex p-1 rounded-xl bg-[#1d1b1a] border border-[#2c2928] shadow-inner">
            <button
              onClick={() => onCategoryChange('image')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                activeCategory === 'image'
                  ? 'bg-[#2c2928] text-white shadow-sm border border-stone-600/30'
                  : 'text-[#a8a29e] hover:text-stone-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Image Tools</span>
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40 text-stone-400">8</span>
            </button>
            <button
              onClick={() => onCategoryChange('video')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                activeCategory === 'video'
                  ? 'bg-[#2c2928] text-white shadow-sm border border-stone-600/30'
                  : 'text-[#a8a29e] hover:text-stone-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Video Tools</span>
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40 text-stone-400">4</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#78716c]">
            <span>Fast shortcuts:</span>
            <button
              onClick={onOpenPdf}
              className="px-2.5 py-1 rounded bg-[#1d1b1a] border border-[#2c2928] hover:border-stone-500 text-stone-300 text-[11px] transition-colors"
            >
              PDF Book
            </button>
            <button
              onClick={onOpenCollage}
              className="px-2.5 py-1 rounded bg-[#1d1b1a] border border-[#2c2928] hover:border-stone-500 text-stone-300 text-[11px] transition-colors"
            >
              Collage Maker
            </button>
          </div>
        </div>

        {/* ── Spotlight Hero Engine ────────────────────────────────────────── */}
        <section className="mt-8 rounded-2xl bg-[#1d1b1a] border border-[#2c2928] p-6 sm:p-8 lg:p-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-stone-700/5 rounded-full blur-3xl pointer-events-none" />

          {activeCategory === 'image' ? (
            /* IMAGE SPOTLIGHT: Collage & Editorial Folio Composer */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#a8a29e]">
                    Spotlight Engine · Layout Series
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#f5f0ed]">
                    Collage & Editorial Folio Composer
                  </h2>
                  <p className="text-xs sm:text-sm text-[#a8a29e] font-light leading-relaxed">
                    Assemble multi-plate visual monographs, archival proof sheets, and asymmetric editorial spreads. Export with precision bleed margins for physical binding or digital cataloguing.
                  </p>
                </div>

                {/* Preset Switcher */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#78716c]">
                    Page Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    {[
                      { id: 'folio', label: 'Gallery Folio', ratio: '3:4' },
                      { id: 'diptych', label: 'Diptych', ratio: '3:2' },
                      { id: 'contact', label: 'Contact', ratio: '9-Up' },
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPagePreset(p.id as any)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          pagePreset === p.id
                            ? 'bg-[#2c2928] border-stone-500/50 text-white'
                            : 'bg-[#151312] border-[#2c2928] text-[#78716c] hover:text-stone-300'
                        }`}
                      >
                        <span className="block font-sans text-xs text-stone-200">{p.label}</span>
                        <span className="block text-[9px] text-[#78716c]">{p.ratio}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Matte Margin Slider */}
                <div className="space-y-2 p-3.5 rounded-xl bg-[#151312] border border-[#2c2928]">
                  <div className="flex justify-between text-xs font-mono text-[#a8a29e]">
                    <span>Matte Margin</span>
                    <span className="text-stone-200 font-semibold">{matteMargin} mm</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    step={2}
                    value={matteMargin}
                    onChange={e => setMatteMargin(Number(e.target.value))}
                    className="w-full accent-stone-300 h-1 bg-[#2c2928] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-[#57534e]">
                    <span>8mm (Flush)</span>
                    <span>24mm (Editorial Standard)</span>
                    <span>48mm (Archival Museum)</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={onOpenCollage}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-stone-200 active:scale-[0.98] transition-all shadow-lg"
                  >
                    <span>Open Composer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onOpenPdf}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2c2928] border border-stone-700/40 text-stone-200 font-mono text-xs hover:bg-[#373433] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Create PDF Book</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Interactive Monograph Proof Sheet Preview */}
              <div className="lg:col-span-7 flex justify-center">
                <div
                  className="w-full max-w-lg aspect-[4/5] rounded-xl bg-[#0f0e0d] border border-[#2c2928] shadow-2xl relative flex flex-col justify-between overflow-hidden transition-all duration-300"
                  style={{ padding: `${matteMargin}px` }}
                >
                  {/* Proof Sheet Subtitle Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800/40 text-[9px] font-mono tracking-widest text-[#78716c] uppercase">
                    <span>Prism Monograph Proof · Ser. 04</span>
                    <span>Bleed: 0.125in · CMYK Emul</span>
                  </div>

                  {/* 4-Plate Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1">
                    {proofImages.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-md overflow-hidden bg-stone-900 border border-stone-800/60 shadow-inner flex flex-col"
                      >
                        <img
                          src={src}
                          alt={`Proof plate ${idx + 1}`}
                          onError={proofImageFallback(idx)}
                          className="w-full h-full object-cover grayscale-[20%] group-hover:scale-105 group-hover:grayscale-0 transition-all duration-500"
                        />
                        <div className="absolute bottom-1 left-1.5 px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] font-mono text-stone-300">
                          Plate {idx === 0 ? 'I' : idx === 1 ? 'II' : idx === 2 ? 'III' : 'IV'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Proof Sheet Footer Telemetry */}
                  <div className="pt-2 mt-2 border-t border-stone-800/40 flex items-center justify-between text-[8px] font-mono text-[#57534e]">
                    <span>Grid 2×2 / Margin {matteMargin}mm</span>
                    <span>100% Client-Side Render</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIDEO SPOTLIGHT: Format Conversion & Compression */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                    Spotlight Engine · Video Suite
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#f5f0ed]">
                    Format Conversion & Compression
                  </h2>
                  <p className="text-xs sm:text-sm text-[#a8a29e] font-light leading-relaxed">
                    GPU-accelerated stream transcode, bit-rate reduction, and multi-track audio preservation without remote telemetry.
                  </p>
                </div>

                {/* Codec Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#78716c]">
                    Target Codec Architecture
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    {[
                      { id: 'av1', label: 'AV1 Next-Gen', sub: 'Best ratio' },
                      { id: 'hevc', label: 'H.265 / HEVC', sub: 'Balanced' },
                      { id: 'prores', label: 'ProRes 422', sub: 'Master' },
                    ].map(c => (
                      <button
                        key={c.id}
                        onClick={() => setVideoCodec(c.id as any)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          videoCodec === c.id
                            ? 'bg-[#2c2928] border-emerald-500/40 text-white'
                            : 'bg-[#151312] border-[#2c2928] text-[#78716c] hover:text-stone-300'
                        }`}
                      >
                        <span className="block font-sans text-xs text-stone-200">{c.label}</span>
                        <span className="block text-[9px] text-[#78716c]">{c.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bitrate & Telemetry Card */}
                <div className="p-3.5 rounded-xl bg-[#151312] border border-[#2c2928] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-[#a8a29e]">
                    <span>Target CRF</span>
                    <span className="text-emerald-400 font-semibold">22 (Near-lossless)</span>
                  </div>
                  <div className="flex justify-between text-[#78716c] text-[11px]">
                    <span>Audio Stream</span>
                    <span className="text-stone-300">PCM 24-bit 48kHz Pass-Through</span>
                  </div>
                  <div className="flex justify-between text-[#78716c] text-[11px]">
                    <span>Est. Footprint Reduction</span>
                    <span className="text-emerald-400 font-semibold">~64% smaller</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => onLaunchTool('video-compress', 'video')}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-stone-200 active:scale-[0.98] transition-all shadow-lg"
                  >
                    <span>Configure Transcode Engine</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onLaunchTool('video-trimmer', 'video')}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2c2928] border border-stone-700/40 text-stone-200 font-mono text-xs hover:bg-[#373433] transition-colors"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Trimmer</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Interactive Video Player Simulation */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="w-full max-w-lg aspect-video rounded-xl bg-[#0f0e0d] border border-[#2c2928] shadow-2xl relative overflow-hidden flex flex-col justify-between p-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#a8a29e] z-10">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      MASTER_REEL_001.MOV
                    </span>
                    <span className="text-stone-400">4K 60fps · Rec.709</span>
                  </div>

                  {/* Center Video Graphic / 4-Split Grid */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 bg-[#2c2928]">
                      {proofImages.map((src, i) => (
                        <div key={i} className="relative overflow-hidden bg-stone-900">
                          <img src={src} alt="video-tile" onError={proofImageFallback(i)} className="w-full h-full object-cover filter brightness-75" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Playback Controls Overlay */}
                  <div className="relative z-10 flex items-center justify-between pt-2 border-t border-stone-800/80 bg-black/60 backdrop-blur-md -mx-4 -mb-4 p-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                      >
                        {isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                      <div className="text-[10px] font-mono text-stone-300">
                        <span>00:04:12</span> / <span className="text-[#78716c]">00:12:40</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-emerald-400">
                      <span>42.8 Mbps → 14.2 Mbps</span>
                      <Volume2 className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Utilities Grid ──────────────────────────────────────────────── */}
        <section className="mt-12">
          <div className="flex items-center justify-between pb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif text-[#f5f0ed]">
                {activeCategory === 'image' ? 'Image Utilities' : 'Video Utilities'}
              </h2>
              <p className="text-xs text-[#a8a29e] mt-1 font-light">
                {activeCategory === 'image'
                  ? 'Eight specialized tools for batch processing, privacy sanitation, vectorization, and color grading.'
                  : 'Four high-performance tools for stream trimming, animated synthesis, bitrate reduction, and subtitle synchronization.'}
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#78716c]">
              Local Browser Sandbox
            </span>
          </div>

          {activeCategory === 'image' ? (
            /* 8 IMAGE TOOL CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. Collage Builder */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Layout
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Collage Builder</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Multi-photo grid composer with custom margins, aspect ratios, and print-ready proofs.
                    </p>
                  </div>

                  {/* Interactive Mini Preview */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2">
                    <div className="grid grid-cols-3 gap-1 h-16">
                      <div className="bg-stone-800/80 rounded-sm" />
                      <div className="bg-stone-700/80 rounded-sm" />
                      <div className="bg-stone-800/80 rounded-sm" />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#78716c]">
                      <span>Ratios: 1:1 · 4:5 · 16:9</span>
                      <span>Padding: 4-32px</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOpenCollage}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Launch Builder</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 2. Format Converter */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Batch
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Format Converter</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Batch convert, resize, and compress between WebP, PNG, JPEG, and AVIF formats.
                    </p>
                  </div>

                  {/* Interactive Format Selector & Quality */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2.5">
                    <div className="flex gap-1 text-[10px] font-mono">
                      {(['webp', 'jpeg', 'png', 'avif'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setConverterFormat(fmt)}
                          className={`flex-1 py-1 rounded uppercase tracking-wider text-center transition-colors ${
                            converterFormat === fmt
                              ? 'bg-stone-200 text-black font-semibold'
                              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-[#78716c]">
                      <span>Quality: {converterQuality}%</span>
                      <input
                        type="range"
                        min={50}
                        max={100}
                        value={converterQuality}
                        onChange={e => setConverterQuality(Number(e.target.value))}
                        className="w-24 accent-stone-300 h-1 bg-[#2c2928] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('converter', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Open Converter</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 3. Watermark Studio */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Stamp className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Brand
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Watermark Studio</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Apply text or monogram marks with 9-point anchor alignment, opacity, and rotation.
                    </p>
                  </div>

                  {/* Interactive 9-Box Anchor Grid */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] flex items-center justify-between">
                    <div className="grid grid-cols-3 gap-1.5 w-20">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(idx => (
                        <button
                          key={idx}
                          onClick={() => setWatermarkPos(idx)}
                          className={`w-5 h-5 rounded-sm border transition-colors ${
                            watermarkPos === idx
                              ? 'bg-stone-300 border-white shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                              : 'bg-stone-900 border-[#2c2928] hover:border-stone-600'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] font-mono text-right space-y-1 text-[#78716c]">
                      <div>Opacity: {watermarkAlpha}%</div>
                      <div>Anchor: {watermarkPos === 8 ? 'Bottom-Right' : watermarkPos === 4 ? 'Center' : 'Custom'}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('watermark', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Configure Watermark</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 4. EXIF Privacy Inspector */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-emerald-400 border border-emerald-900/40">
                      Privacy
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">EXIF Privacy Inspector</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Audit and sanitize GPS coordinates, serials, and timestamps before publishing.
                    </p>
                  </div>

                  {/* Interactive Scrub Checklist */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between items-center text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> GPS Coordinates
                      </span>
                      <span className="text-[9px] text-emerald-400">Scrubbed</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Camera Serial
                      </span>
                      <span className="text-[9px] text-emerald-400">Scrubbed</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-stone-600" /> Lens Metadata
                      </span>
                      <span className="text-[9px] text-stone-500">Optional</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('metadata', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Inspect Metadata</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 5. Base64 Tools */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Developer
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Base64 Studio</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Bi-directional Data URI encoding and decoding with instant clipboard synchronization.
                    </p>
                  </div>

                  {/* Interactive Code Snippet */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#78716c]">
                      <span>data:image/webp;base64...</span>
                      <button
                        onClick={() => copyToClipboard('data:image/webp;base64,UklGRmYAAABXRUJQVlA4TFsAAAAv...', 'base64')}
                        className="text-stone-300 hover:text-white flex items-center gap-1"
                      >
                        {copiedBase64Snippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedBase64Snippet ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-[10px] text-stone-400 truncate bg-stone-900/80 p-1.5 rounded">
                      UklGRmYAAABXRUJQVlA4TFsAAAAv...A1B3e90Q
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('base64', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Launch Base64 Studio</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 6. Images to SVG */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Paintbrush className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Vector
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Images to SVG</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Trace raster plates into resolution-independent SVG vector graphics with Bézier smoothing.
                    </p>
                  </div>

                  {/* Interactive Bezier Curves Preset */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between text-[#78716c]">
                      <span>Trace Preset</span>
                      <span className="text-stone-300">Posterized 4-Color</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      {['Poster', 'Detail', 'Curvy', 'Sharp'].map((preset, idx) => (
                        <div
                          key={preset}
                          className={`py-1 rounded text-[9px] ${
                            idx === 0 ? 'bg-stone-300 text-black font-semibold' : 'bg-stone-900 text-stone-400'
                          }`}
                        >
                          {preset}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('svg-trace', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Vectorize Plate</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 7. Palette Extractor */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Palette className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Color
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Palette Extractor</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Extract dominant color schemes, hex swatches, and CSS/Tailwind variables from photographs.
                    </p>
                  </div>

                  {/* Interactive 6-Color Swatch Strip */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2">
                    <div className="flex h-7 rounded overflow-hidden shadow-inner">
                      {paletteSwatches.map(c => (
                        <button
                          key={c.hex}
                          onClick={() => copyToClipboard(c.hex, 'color')}
                          title={`${c.name} (${c.hex}) - Click to copy`}
                          style={{ backgroundColor: c.hex }}
                          className="flex-1 hover:opacity-85 transition-opacity relative group/swatch"
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-[#78716c]">
                      <span>{copiedColorHex ? `Copied ${copiedColorHex}` : 'Click swatch to copy'}</span>
                      <span className="text-stone-400">6 Harmonized</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('palette', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Extract Palette</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 8. Web Image Loader */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-5 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-stone-400 border border-[#2c2928]">
                      Network
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif text-white group-hover:text-stone-100">Web Image Loader</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Load and inspect remote assets directly into the sandbox canvas with CORS proxy handling.
                    </p>
                  </div>

                  {/* Interactive URL Input Simulator */}
                  <div className="p-3 rounded-lg bg-[#151312] border border-[#2c2928] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400 truncate bg-stone-900/80 p-2 rounded border border-stone-800">
                      <span className="text-stone-500">https://</span>
                      <span className="text-stone-300">images.unsplash.com/...</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-[#78716c]">
                      <span>Automatic CORS handling</span>
                      <span className="text-emerald-400">Direct Pipeline</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('web-load', 'image')}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Inspect Remote Plate</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            /* 4 VIDEO TOOL CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {/* 1. Video Trimmer */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-6 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Scissors className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-blue-400 border border-blue-900/40">
                      Stream Edit
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif text-white group-hover:text-stone-100">Video Trimmer</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Lossless frame-accurate trimming without re-encoding. Set precise start/end cue points and extract key clips.
                    </p>
                  </div>

                  {/* Interactive Timeline Scrubber Mock */}
                  <div className="p-4 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2">
                    <div className="h-6 rounded bg-stone-900 border border-stone-800 relative flex items-center px-2 overflow-hidden">
                      <div className="absolute left-6 right-12 top-1 bottom-1 bg-blue-500/25 border-x-2 border-blue-400 rounded-sm" />
                      <div className="w-full flex justify-between text-[8px] font-mono text-stone-500">
                        <span>00:00</span>
                        <span>00:30</span>
                        <span>01:00</span>
                        <span>01:30</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#78716c]">
                      <span>Selected: 00:06 → 00:48</span>
                      <span className="text-stone-300">Duration: 42s</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('video-trimmer', 'video')}
                  className="mt-6 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Launch Trimmer</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 2. Video to GIF */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-6 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Film className="w-5 h-5 text-pink-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-pink-400 border border-pink-900/40">
                      Animated
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif text-white group-hover:text-stone-100">Video to GIF</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Convert video clips to high-framerate animated GIFs with Floyd-Steinberg dithering and loop parameters.
                    </p>
                  </div>

                  {/* Interactive FPS Switcher */}
                  <div className="p-4 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2">
                    <div className="flex gap-2 text-xs font-mono">
                      {([15, 24, 30] as const).map(fps => (
                        <button
                          key={fps}
                          onClick={() => setGifFps(fps)}
                          className={`flex-1 py-1.5 rounded text-center transition-colors ${
                            gifFps === fps
                              ? 'bg-stone-200 text-black font-semibold'
                              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {fps} FPS
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-[#78716c]">
                      <span>Palette: 256 Colors Adaptive</span>
                      <span className="text-stone-300">Infinite Loop</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('video-gif', 'video')}
                  className="mt-6 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Synthesize GIF</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 3. Video Compressor */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-6 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <RefreshCw className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-emerald-400 border border-emerald-900/40">
                      Transcode
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif text-white group-hover:text-stone-100">Video Compressor</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Reduce video footprint while preserving perceptual visual fidelity with CRF rate control.
                    </p>
                  </div>

                  {/* Interactive Compression Slider */}
                  <div className="p-4 rounded-lg bg-[#151312] border border-[#2c2928] space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-[#a8a29e]">
                      <span>Target Footprint</span>
                      <span className="text-emerald-400 font-semibold">25 MB (Discord / Web)</span>
                    </div>
                    <div className="h-2 rounded bg-stone-900 overflow-hidden">
                      <div className="w-2/5 h-full bg-emerald-400 rounded" />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-[#78716c]">
                      <span>Original: 184 MB</span>
                      <span>Target: ~32 MB (-82%)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('video-compress', 'video')}
                  className="mt-6 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Launch Compressor</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* 4. Subtitle Editor */}
              <div className="rounded-xl bg-[#1d1b1a] border border-[#2c2928] p-6 flex flex-col justify-between hover:border-stone-500/40 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-200">
                      <Type className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-orange-400 border border-orange-900/40">
                      Captions
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif text-white group-hover:text-stone-100">Subtitle Editor</h3>
                    <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed">
                      Multi-track SRT and VTT caption editor with real-time waveform timing sync and burn-in options.
                    </p>
                  </div>

                  {/* Interactive Cue Preview */}
                  <div className="p-4 rounded-lg bg-[#151312] border border-[#2c2928] space-y-1.5 text-[10px] font-mono">
                    <div className="text-stone-400 flex justify-between">
                      <span className="text-orange-400/90 font-semibold">[00:01.200 - 00:04.500]</span>
                      <span className="text-stone-500">Cue #01</span>
                    </div>
                    <div className="text-stone-200 italic bg-stone-900/80 p-2 rounded border border-stone-800">
                      "Light cascades across the basalt cliff..."
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTool('subtitles', 'video')}
                  className="mt-6 w-full py-2.5 px-4 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono flex items-center justify-between transition-colors"
                >
                  <span>Open Subtitle Editor</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Client-Side Archival Guarantee Banner ─────────────────────────── */}
        <footer className="mt-14 p-6 sm:p-8 rounded-2xl bg-[#1d1b1a] border border-[#2c2928] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#2c2928] border border-stone-700/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-serif text-white font-medium">
                Client-Side Archival Guarantee
              </h4>
              <p className="text-xs text-[#a8a29e] mt-1 font-light leading-relaxed max-w-xl">
                All computations, transcode routines, and pixel modifications execute strictly within your local browser sandbox and native machine architecture. No images, video streams, or metadata are ever transmitted to external servers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#a8a29e] shrink-0">
            <span className="px-2.5 py-1 rounded bg-[#151312] border border-[#2c2928] text-stone-300">
              100% Local Wasm Sandbox
            </span>
            <span className="px-2.5 py-1 rounded bg-[#151312] border border-[#2c2928] text-stone-300">
              Zero Cloud Telemetry
            </span>
            <span className="px-2.5 py-1 rounded bg-[#151312] border border-[#2c2928] text-emerald-400">
              Lossless Processing
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
