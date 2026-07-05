import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, LayoutGrid } from 'lucide-react';
import { Photo } from '@/types';
import { resolveUrl } from '@/constants';
import { GlassMaterial } from '@/components/GlassMaterial';
import { springs } from '@/lib/motion-tokens';

interface CollageLayout {
  id: string;
  name: string;
  slots: { x: number; y: number; w: number; h: number }[];
  minPhotos: number;
}

const LAYOUTS: CollageLayout[] = [
  {
    id: '2-up',
    name: '2-Up',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
    minPhotos: 2,
  },
  {
    id: '3-up',
    name: '3-Up',
    slots: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.5 },
      { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
    ],
    minPhotos: 3,
  },
  {
    id: '4-grid',
    name: '4-Grid',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
    minPhotos: 4,
  },
  {
    id: '5-up',
    name: '5-Up',
    slots: [
      { x: 0, y: 0, w: 0.6, h: 0.6 },
      { x: 0.6, y: 0, w: 0.4, h: 0.3 },
      { x: 0.6, y: 0.3, w: 0.4, h: 0.3 },
      { x: 0, y: 0.6, w: 0.3, h: 0.4 },
      { x: 0.3, y: 0.6, w: 0.3, h: 0.4 },
    ],
    minPhotos: 5,
  },
  {
    id: '6-grid',
    name: '6-Grid',
    slots: [
      { x: 0, y: 0, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0, w: 0.334, h: 0.5 },
      { x: 0.667, y: 0, w: 0.333, h: 0.5 },
      { x: 0, y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.334, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
    minPhotos: 6,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    slots: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
    ],
    minPhotos: 1,
  },
];

interface CollageMakerProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
}

export const CollageMaker: React.FC<CollageMakerProps> = ({ photos, isOpen, onClose }) => {
  const [selectedLayout, setSelectedLayout] = useState<CollageLayout>(LAYOUTS[2]);
  const [gap, setGap] = useState(4);
  const [bgColor, setBgColor] = useState('#000000');
  const [roundCorners, setRoundCorners] = useState(false);
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [photoSlots, setPhotoSlots] = useState<(Photo | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const slots: (Photo | null)[] = selectedLayout.slots.map((_, i) =>
        i < photos.length ? photos[i] : null
      );
      setPhotoSlots(slots);
    }
  }, [isOpen, photos, selectedLayout]);

  const drawCanvas = useCallback(async (canvas: HTMLCanvasElement, scale: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 2000 * scale;
    const height = (2000 * selectedLayout.slots[0]?.h / selectedLayout.slots[0]?.w || 2000) * scale;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const gapPx = gap * scale;

    for (let i = 0; i < selectedLayout.slots.length; i++) {
      const slot = selectedLayout.slots[i];
      const photo = photoSlots[i];
      if (!photo) continue;

      const x = slot.x * width + gapPx / 2;
      const y = slot.y * height + gapPx / 2;
      const w = slot.w * width - gapPx;
      const h = slot.h * height - gapPx;

      if (w <= 0 || h <= 0) continue;

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          if (roundCorners) {
            const r = Math.min(w, h) * 0.05;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            ctx.clip();
          }

          const imgRatio = img.naturalWidth / img.naturalHeight;
          const slotRatio = w / h;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

          if (imgRatio > slotRatio) {
            sw = img.naturalHeight * slotRatio;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / slotRatio;
            sy = (img.naturalHeight - sh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = resolveUrl(photo.url);
      });
    }
  }, [selectedLayout, photoSlots, gap, bgColor, roundCorners]);

  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    try {
      await drawCanvas(canvas, 1);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collage.${exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      }, `image/${exportFormat}`, 0.95);
    } catch {
      setIsExporting(false);
    }
  }, [drawCanvas, exportFormat]);

  const renderPreview = useCallback(() => {
    if (!previewRef.current) return;
    const container = previewRef.current;
    const rect = container.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gapPx = gap * 2;

    let loaded = 0;
    const total = photoSlots.filter(Boolean).length;
    if (total === 0) return;

    const drawSlot = (i: number) => {
      const slot = selectedLayout.slots[i];
      const photo = photoSlots[i];
      if (!photo) { loaded++; if (loaded >= total) commit(); return; }

      const x = slot.x * canvas.width + gapPx / 2;
      const y = slot.y * canvas.height + gapPx / 2;
      const w = slot.w * canvas.width - gapPx;
      const h = slot.h * canvas.height - gapPx;
      if (w <= 0 || h <= 0) { loaded++; if (loaded >= total) commit(); return; }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        if (roundCorners) {
          const r = Math.min(w, h) * 0.05;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.clip();
        }
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const slotRatio = w / h;
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (imgRatio > slotRatio) {
          sw = img.naturalHeight * slotRatio;
          sx = (img.naturalWidth - sw) / 2;
        } else {
          sh = img.naturalWidth / slotRatio;
          sy = (img.naturalHeight - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        ctx.restore();
        loaded++;
        if (loaded >= total) commit();
      };
      img.onerror = () => { loaded++; if (loaded >= total) commit(); };
      img.src = resolveUrl(photo.url);
    };

    const commit = () => {
      const existing = container.querySelector('canvas');
      if (existing) existing.remove();
      const display = document.createElement('canvas');
      display.width = canvas.width;
      display.height = canvas.height;
      display.style.width = '100%';
      display.style.height = '100%';
      display.style.borderRadius = '12px';
      const dCtx = display.getContext('2d');
      if (dCtx) dCtx.drawImage(canvas, 0, 0);
      container.appendChild(display);
    };

    for (let i = 0; i < selectedLayout.slots.length; i++) {
      drawSlot(i);
    }
  }, [selectedLayout, photoSlots, gap, bgColor, roundCorners]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(renderPreview, 100);
    return () => clearTimeout(timer);
  }, [isOpen, renderPreview]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={springs.gentle}
        className="relative w-full max-w-5xl h-[85vh] mx-4 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <LayoutGrid size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-white">Collage Maker</h2>
            <span className="text-sm text-gray-400">{photos.length} photos</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r border-border p-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Layout</label>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map((layout) => {
                  const available = layout.minPhotos <= photos.length;
                  return (
                    <button
                      key={layout.id}
                      disabled={!available}
                      onClick={() => setSelectedLayout(layout)}
                      className={`relative p-2 rounded-xl border transition-all ${
                        selectedLayout.id === layout.id
                          ? 'border-primary bg-primary/10'
                          : available
                            ? 'border-border hover:border-white/20 bg-white/5'
                            : 'border-border bg-white/5 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="aspect-square relative">
                        {layout.slots.map((slot, i) => (
                          <div
                            key={i}
                            className={`absolute ${selectedLayout.id === layout.id ? 'bg-primary/40' : 'bg-white/20'}`}
                            style={{
                              left: `${slot.x * 100}%`,
                              top: `${slot.y * 100}%`,
                              width: `${slot.w * 100}%`,
                              height: `${slot.h * 100}%`,
                              borderRadius: '3px',
                              margin: '1px',
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 text-center font-medium">{layout.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                Gap: {gap}px
              </label>
              <input
                type="range"
                min={2}
                max={20}
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Background</label>
              <div className="flex gap-2">
                {[{ color: '#000000', label: 'Black' }, { color: '#ffffff', label: 'White' }, { color: '#1a1a2e', label: 'Navy' }].map(({ color, label }) => (
                  <button
                    key={color}
                    onClick={() => setBgColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      bgColor === color ? 'border-primary scale-110' : 'border-border hover:border-white/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={label}
                  />
                ))}
                <label className="w-8 h-8 rounded-lg border-2 border-border hover:border-white/30 cursor-pointer flex items-center justify-center overflow-hidden">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="sr-only"
                  />
                  <div className="w-6 h-6 rounded" style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }} />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Round Corners</label>
              <button
                onClick={() => setRoundCorners(!roundCorners)}
                className={`w-10 h-6 rounded-full transition-all ${
                  roundCorners ? 'bg-primary' : 'bg-white/10'
                }`}
              >
                <motion.div
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                  animate={{ x: roundCorners ? 18 : 2 }}
                  transition={springs.snappy}
                />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Format</label>
              <div className="flex gap-2">
                {(['jpeg', 'png'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      exportFormat === fmt
                        ? 'bg-primary text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-4">
              <GlassMaterial intensity="regular" interactive borderRadius="12px" className="w-full">
                <button
                  onClick={handleExport}
                  disabled={isExporting || photos.length === 0}
                  className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Download size={16} />
                  {isExporting ? 'Exporting...' : 'Export Collage'}
                </button>
              </GlassMaterial>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8 bg-black/20">
            <div
              ref={previewRef}
              className="relative w-full max-w-2xl aspect-square bg-black rounded-xl overflow-hidden shadow-2xl"
            />
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </motion.div>
  );
};
