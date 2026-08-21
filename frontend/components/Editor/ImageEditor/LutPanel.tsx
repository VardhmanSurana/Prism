import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Upload, Download, X, Check,
  Film, Palette, Camera, Sparkles, Wand2,
} from 'lucide-react';
import gsap from 'gsap';
import { Adjustments, LutAdjustments } from './filterEngine';
import { resolveUrl } from '@/constants';
import { BUILTIN_LUTS, parseCubeFile, getBuiltinLutData, exportToCubeFile, applyLutToImageData } from './lutEngine';
import { EditorSlider } from './ui/EditorSlider';

interface LutPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
  imageSrc?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cinematic: <Film size={11} />,
  vintage: <Camera size={11} />,
  portrait: <Sparkles size={11} />,
  creative: <Palette size={11} />,
  bw: <Wand2 size={11} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  portrait: 'Portrait',
  cinematic: 'Cinema',
  vintage: 'Vintage',
  creative: 'Creative',
  bw: 'B&W',
};

const CATEGORIES = ['all', 'portrait', 'cinematic', 'vintage', 'creative', 'bw'] as const;

// ── Sample Image Sources per category ─────────────────────────────────────────
const getSampleFilename = (category: string): string => {
  if (category === 'portrait') {
    return 'woman.png';
  } else if (category === 'cinematic' || category === 'creative') {
    return 'nature.png';
  } else if (category === 'vintage' || category === 'bw') {
    return 'pet.png';
  }
  return 'woman.png';
};

// ── Accurate curated fallback gradients for all 15 built-in LUTs ──────────────
const SWATCH_COLORS: Record<string, [string, string, string]> = {
  // Vivid Studio Dusk Collection (Golden Sunset & Twilight Radiance)
  'vivid-dusk-1': ['#1c1015', '#b44e26', '#f8b878'], // Golden Hour Sunset Amber
  'vivid-dusk-2': ['#181422', '#8c485c', '#f0a88c'], // Warm Twilight Peach Radiance
  'vivid-dusk-3': ['#101828', '#883a60', '#f4a068'], // Cinematic Dusk Magenta-Amber
  'vivid-dusk-4': ['#220d0a', '#943818', '#e88848'], // Sunset Mahogany Bronze
  'vivid-dusk-5': ['#1a100a', '#b86020', '#fcd080'], // Ultra-Vivid Golden Dusk
  // Cinematic & Analog Classics
  'golden-hour': ['#1a2a3a', '#c87941', '#f5d89a'],
  'teal-orange': ['#0d3040', '#667766', '#e8874a'],
  'matte-fade': ['#3a3530', '#8a7a6a', '#d4c9b8'],
  'bleach-bypass': ['#1a1a1a', '#555550', '#d8d8d0'],
  'film-print': ['#1a1510', '#7a6050', '#e0c8a8'],
  'fuji-provia': ['#0d1f2d', '#1a7a50', '#4ab0e8'],
  'noir': ['#0a0a0a', '#505050', '#e0e0e0'],
  'emerald-city': ['#0a1a0d', '#1a6a2a', '#a0d060'],
  'rose-gold': ['#201015', '#b0607a', '#f0c8a8'],
  'arctic-blue': ['#0a1020', '#204060', '#80b8e8'],
};

export const LutPanel: React.FC<LutPanelProps> = ({ adjustments, onChange }) => {
  const lut = adjustments.lut || { builtinId: null, customData: null, opacity: 100 };
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [importError, setImportError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const activeLutId = lut.builtinId;
  const hasCustom = !!lut.customData;
  const hasAnyLut = activeLutId !== null || hasCustom;

  const updateLut = useCallback((patch: Partial<LutAdjustments>) => {
    onChange({ ...adjustments, lut: { ...lut, ...patch } });
  }, [adjustments, lut, onChange]);

  const handleSelectBuiltin = useCallback((id: string) => {
    if (activeLutId === id && !hasCustom) {
      // Deselect toggle
      onChange({ ...adjustments, lut: { builtinId: null, customData: null, opacity: lut.opacity } });
    } else {
      onChange({ ...adjustments, lut: { builtinId: id, customData: null, opacity: lut.opacity } });
    }
  }, [activeLutId, hasCustom, adjustments, lut, onChange]);

  const handleReset = useCallback(() => {
    onChange({ ...adjustments, lut: { builtinId: null, customData: null, opacity: 100 } });
  }, [adjustments, onChange]);

  const handleImportCube = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseCubeFile(text);
      if (!parsed) {
        setImportError('Invalid .cube file — check format and try again');
        return;
      }
      parsed.title = file.name.replace('.cube', '');
      onChange({ ...adjustments, lut: { builtinId: null, customData: parsed, opacity: lut.opacity } });
    } catch {
      setImportError('Failed to read .cube file');
    }
    e.target.value = '';
  }, [adjustments, lut, onChange]);

  const handleExportCube = useCallback(() => {
    const lutData = lut.customData || (lut.builtinId ? getBuiltinLutData(lut.builtinId) : null);
    if (!lutData) return;

    const cubeText = exportToCubeFile(lutData, lut.customData?.title || lut.builtinId || 'prism-lut');
    const blob = new Blob([cubeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lutData.title || 'prism-lut'}.cube`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lut]);

  // ── GSAP Stagger Entrance Animation when Category Changes ──────────────────────
  useEffect(() => {
    if (!gridContainerRef.current) return;
    const cards = gridContainerRef.current.querySelectorAll('.lut-card-item');
    if (cards.length === 0) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 10, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.28,
        stagger: 0.02,
        ease: 'power2.out',
        overwrite: 'auto',
      }
    );
  }, [activeCategory]);

  // ── Generate High-Definition Sample Photo Thumbnails with each LUT applied ──────
  useEffect(() => {
    let isMounted = true;
    const sampleCategories = ['portrait', 'cinematic', 'vintage'];
    const sampleBuffers = new Map<string, ImageData>();

    const loadSample = (cat: string): Promise<void> => {
      return new Promise(resolve => {
        const filename = getSampleFilename(cat);
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const tryDraw = () => {
          try {
            const tw = 120;
            const th = Math.max(60, Math.round((tw * img.naturalHeight) / img.naturalWidth));
            const offscreen = document.createElement('canvas');
            offscreen.width = tw;
            offscreen.height = th;
            const ctx = offscreen.getContext('2d', { willReadFrequently: true });
            if (!ctx) return resolve();

            ctx.drawImage(img, 0, 0, tw, th);
            sampleBuffers.set(cat, ctx.getImageData(0, 0, tw, th));
          } catch { }
          resolve();
        };

        img.onload = tryDraw;
        img.onerror = () => {
          // Fallback to Vite local asset
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          fallbackImg.onload = () => {
            try {
              const tw = 120;
              const th = Math.max(60, Math.round((tw * fallbackImg.naturalHeight) / fallbackImg.naturalWidth));
              const offscreen = document.createElement('canvas');
              offscreen.width = tw;
              offscreen.height = th;
              const ctx = offscreen.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(fallbackImg, 0, 0, tw, th);
                sampleBuffers.set(cat, ctx.getImageData(0, 0, tw, th));
              }
            } catch { }
            resolve();
          };
          fallbackImg.onerror = () => resolve();
          fallbackImg.src = `/sample_images/${filename}`;
        };

        img.src = resolveUrl(`/api/v1/sample-images/${filename}`);
      });
    };

    Promise.all(sampleCategories.map(loadSample)).then(() => {
      if (!isMounted) return;

      const generated: Record<string, string> = {};
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      for (const item of BUILTIN_LUTS) {
        const cat = item.category === 'portrait' ? 'portrait' : (item.category === 'vintage' || item.category === 'bw' ? 'vintage' : 'cinematic');
        const baseImageData = sampleBuffers.get(cat) || sampleBuffers.get('portrait');
        if (!baseImageData) continue;

        const lutData = getBuiltinLutData(item.id);
        if (!lutData) continue;

        const graded = applyLutToImageData(baseImageData, lutData, 1.0);
        offscreen.width = baseImageData.width;
        offscreen.height = baseImageData.height;
        ctx.putImageData(graded, 0, 0);
        generated[item.id] = offscreen.toDataURL('image/jpeg', 0.85);
      }

      if (isMounted) {
        setThumbnails(generated);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLuts = useMemo(() => {
    return activeCategory === 'all'
      ? BUILTIN_LUTS
      : BUILTIN_LUTS.filter(l => l.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white">
      {/* ── Sticky Top Section: Actions + Blend Strength Slider + Category Filters ── */}
      <div className="sticky top-0 z-20 bg-[#0d0f14]/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        {/* Header Action Buttons (Refined: No static border, white border on hover only, GSAP micro-interactions) */}
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-2">
          {/* Import .cube */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import external .cube LUT file"
            className="flex-1 h-8.5 flex items-center justify-center gap-1.5 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-transparent hover:border-white/30 text-xs font-semibold text-white/90 hover:text-white transition-all duration-200 cursor-pointer shadow-sm active:scale-95 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] whitespace-nowrap"
          >
            <Upload size={13} className="text-primary shrink-0" />
            <span>Import .cube</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".cube"
            className="hidden"
            onChange={handleImportCube}
          />

          {/* Export .cube */}
          {hasAnyLut && (
            <button
              onClick={handleExportCube}
              title="Export current LUT grade as standard .cube file"
              className="flex-1 h-8.5 flex items-center justify-center gap-1.5 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-transparent hover:border-white/30 text-xs font-semibold text-white/90 hover:text-white transition-all duration-200 cursor-pointer shadow-sm active:scale-95 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] whitespace-nowrap animate-in fade-in"
            >
              <Download size={13} className="text-white/70 shrink-0" />
              <span>Export</span>
            </button>
          )}

          {/* Remove / Reset */}
          {hasAnyLut && (
            <button
              onClick={handleReset}
              title="Remove LUT grade"
              className="h-8.5 flex items-center justify-center gap-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-transparent hover:border-red-400/40 text-xs font-semibold text-red-300 hover:text-red-200 transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap animate-in fade-in hover:shadow-[0_0_12px_rgba(239,68,68,0.15)]"
            >
              <X size={13} className="shrink-0" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Import Error Banner */}
        {importError && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-center justify-between">
            <span>{importError}</span>
            <button onClick={() => setImportError(null)} className="text-red-400/60 hover:text-red-400 cursor-pointer">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Custom Imported LUT Card */}
        {hasCustom && (
          <div className="mx-4 mb-3 p-2.5 rounded-xl bg-primary/10 border border-primary/40 shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {lut.customData?.title || 'Custom LUT'}
              </div>
              <div className="text-[10px] text-white/60 mt-0.5 font-medium">
                Custom Imported • {lut.customData?.size}³ 3D Table
              </div>
            </div>
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
              <Check size={12} className="text-primary font-bold" />
            </div>
          </div>
        )}

        {/* ── Blend Strength Slider (Sticky: Always visible on scroll when a LUT is active) ── */}
        {hasAnyLut && (
          <div className="px-4 pt-2 pb-3 border-t border-white/5 animate-in fade-in duration-200">
            <EditorSlider
              label="Blend Strength"
              value={lut.opacity}
              onChange={val => updateLut({ opacity: val })}
              min={0}
              max={100}
              defaultValue={100}
              unit="%"
            />
          </div>
        )}

        {/* ── Category Filter Bar ── */}
        <div className="px-4 pb-2.5 border-t border-white/5 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-scrollbar py-0.5">
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all shrink-0 cursor-pointer ${isActive
                      ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                >
                  {cat !== 'all' && CATEGORY_ICONS[cat]}
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── LUT Cards Grid (White Border on Cover Only with Fixed Height) ── */}
      <div ref={gridContainerRef} className="p-4 grid grid-cols-2 gap-2.5">
        {filteredLuts.map(builtinLut => {
          const isActive = activeLutId === builtinLut.id && !hasCustom;
          const thumbUrl = thumbnails[builtinLut.id];
          const swatch = SWATCH_COLORS[builtinLut.id] || ['#1c1015', '#b44e26', '#f8b878'];

          return (
            <button
              key={builtinLut.id}
              onClick={() => handleSelectBuiltin(builtinLut.id)}
              className="lut-card-item group text-left p-2 rounded-xl transition-all cursor-pointer relative flex flex-col justify-between hover:bg-white/[0.04] active:scale-[0.98]"
            >
              {/* Cover Preview Box: Fixed h-16 with Crisp White Border on Cover Only */}
              <div
                className={`w-full h-16 rounded-lg overflow-hidden relative transition-all duration-200 bg-black/60 shadow-inner ${isActive
                    ? 'border-2 border-white ring-2 ring-white/30 shadow-[0_0_14px_rgba(255,255,255,0.3)]'
                    : 'border border-white/40 group-hover:border-white/90 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.12)]'
                  }`}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={builtinLut.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background: `linear-gradient(135deg, ${swatch[0]} 0%, ${swatch[1]} 50%, ${swatch[2]} 100%)`,
                    }}
                  />
                )}

                {/* Subtle glass sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 pointer-events-none" />

                {/* Active Checkmark Pill on Cover */}
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150">
                    <Check size={10} className="text-black font-black" />
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="mt-2 flex-1 flex flex-col justify-between">
                <div className={`text-[11px] font-bold tracking-tight truncate ${isActive ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                  {builtinLut.name}
                </div>
                <div className={`text-[9.5px] ${isActive ? 'text-white/80' : 'text-white/55'} leading-snug mt-0.5 line-clamp-2`}>
                  {builtinLut.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="px-4 pb-6 text-[9.5px] text-white/30 text-center leading-relaxed">
        LUTs are processed non-destructively in 3D color space.
        Supports standard 17³, 33³, and 65³ <code className="text-white/50">.cube</code> files.
      </div>
    </div>
  );
};
