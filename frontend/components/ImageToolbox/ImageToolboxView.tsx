import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText,
  LayoutGrid,
  RefreshCw,
  Stamp,
  ShieldCheck,
  Sliders,
  Upload,
  Download,
  Sparkles,
  X,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Palette,
  Code2,
  Paintbrush,
  Globe,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import exifr from 'exifr';
import { Photo } from '@/types';
import { PhotoBook } from '../PhotoView/PhotoBook';
import { CollageMaker } from '../PhotoView/CollageMaker';
import { EditingMode } from '../Editor/ImageEditor/EditingMode';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageToolboxViewProps {
  photos?: Photo[];
  onPhotoClick?: (photo: Photo | null) => void;
}

type ToolTab = 'pdf' | 'collage' | 'converter' | 'watermark' | 'metadata' | 'base64' | 'svg-trace' | 'palette' | 'web-load';

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  file: File;
  width?: number;
  height?: number;
}

// ─── Shared Upload Component ──────────────────────────────────────────────────

const ToolImageUpload: React.FC<{
  files: UploadedFile[];
  onUpload: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}> = ({ files, onUpload, onRemove, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const items: UploadedFile[] = Array.from(fileList)
      .filter(f => f.type.startsWith('image/'))
      .map((f, idx) => ({
        id: `tool-${Date.now()}-${idx}`,
        name: f.name,
        url: URL.createObjectURL(f),
        file: f,
      }));
    onUpload(items);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (files.length === 0) {
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-10 cursor-pointer transition-colors 200ms ease, border-color 200ms ease, background-color 200ms ease gap-3 ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5'
        }`}
      >
        <Upload className="w-10 h-10 text-neutral-500" />
        <p className="text-xs font-medium text-neutral-300">Click or drag images here</p>
        <p className="text-[11px] text-neutral-500">Supports JPEG, PNG, WebP, AVIF</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-400">
          {files.length} image{files.length !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors 150ms ease, background-color 150ms ease"
          >
            <Upload size={12} />
            Add More
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors 150ms ease, border-color 150ms ease, background-color 150ms ease"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
        {files.map(file => (
          <div key={file.id} className="relative aspect-square bg-neutral-900 rounded-xl border border-white/10 overflow-hidden group">
            <img src={file.url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => onRemove(file.id)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white/70 hover:text-red-400 hover:bg-black/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[9px] text-white truncate font-mono">{file.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Utility: draw image to canvas ────────────────────────────────────────────

function loadImageToCanvas(src: string): Promise<{ img: HTMLImageElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(img, 0, 0);
      resolve({ img, canvas, ctx });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: string = 'image/png', quality: number = 0.95) {
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, format, quality);
}

// ─── Palette utilities ────────────────────────────────────────────────────────

function medianCut(pixels: [number, number, number][], depth: number): [number, number, number][] {
  if (depth <= 0 || pixels.length === 0) {
    if (pixels.length === 0) return [[0, 0, 0]];
    const avg: [number, number, number] = [0, 0, 0];
    for (const p of pixels) { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; }
    return [[Math.round(avg[0] / pixels.length), Math.round(avg[1] / pixels.length), Math.round(avg[2] / pixels.length)]];
  }
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  for (const p of pixels) {
    if (p[0] < minR) minR = p[0]; if (p[0] > maxR) maxR = p[0];
    if (p[1] < minG) minG = p[1]; if (p[1] > maxG) maxG = p[1];
    if (p[2] < minB) minB = p[2]; if (p[2] > maxB) maxB = p[2];
  }
  const rRange = maxR - minR, gRange = maxG - minG, bRange = maxB - minB;
  const channel = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;
  pixels.sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(pixels.length / 2);
  return [...medianCut(pixels.slice(0, mid), depth - 1), ...medianCut(pixels.slice(mid), depth - 1)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ImageToolboxView: React.FC<ImageToolboxViewProps> = ({ photos = [] }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('pdf');
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isCollageOpen, setIsCollageOpen] = useState(false);

  // Converter state
  const [converterFiles, setConverterFiles] = useState<UploadedFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<'png' | 'jpeg' | 'webp'>('webp');
  const [quality, setQuality] = useState<number>(85);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedCount, setConvertedCount] = useState(0);

  // Base64 state
  const [base64Mode, setBase64Mode] = useState<'encode' | 'decode'>('encode');
  const [base64Files, setBase64Files] = useState<UploadedFile[]>([]);
  const [base64Output, setBase64Output] = useState('');
  const [base64Copied, setBase64Copied] = useState(false);
  const [base64DecodeInput, setBase64DecodeInput] = useState('');
  const [base64DecodePreview, setBase64DecodePreview] = useState<string | null>(null);

  // SVG Trace state
  const [svgFiles, setSvgFiles] = useState<UploadedFile[]>([]);
  const [svgOutput, setSvgOutput] = useState('');
  const [isTracing, setIsTracing] = useState(false);
  const [svgPreset, setSvgPreset] = useState<'posterized' | 'detailed' | 'curvy' | 'sharp'>('posterized');

  // Palette state
  const [paletteFiles, setPaletteFiles] = useState<UploadedFile[]>([]);
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [paletteExportFormat, setPaletteExportFormat] = useState<'css' | 'tailwind' | 'scss' | 'json'>('css');
  const [paletteExportCopied, setPaletteExportCopied] = useState(false);

  // Web Load state
  const [webUrl, setWebUrl] = useState('');
  const [webPreview, setWebPreview] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [isWebEditorOpen, setIsWebEditorOpen] = useState(false);

  // Resize state
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(600);
  const [lockAspect, setLockAspect] = useState(true);
  const resizeAspectRef = useRef(1);

  // Watermark state
  const [watermarkFiles, setWatermarkFiles] = useState<UploadedFile[]>([]);
  const [watermarkText, setWatermarkText] = useState('© Prism Studio');
  const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(75);
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(24);
  const [watermarkColor, setWatermarkColor] = useState('#ffffff');
  const [watermarkRotation, setWatermarkRotation] = useState<number>(0);
  const [isExportingWatermark, setIsExportingWatermark] = useState(false);

  // Metadata state
  const [metadataFiles, setMetadataFiles] = useState<UploadedFile[]>([]);
  const [metadataResults, setMetadataResults] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [isParsing, setIsParsing] = useState(false);



  // ─── Converter ────────────────────────────────────────────────────────────

  const handleConvertAndDownload = async () => {
    if (converterFiles.length === 0) return;
    setIsConverting(true);
    setConvertedCount(0);

    for (const item of converterFiles) {
      try {
        const { canvas } = await loadImageToCanvas(item.url);

        if (resizeEnabled && resizeWidth > 0 && resizeHeight > 0) {
          const resized = document.createElement('canvas');
          resized.width = resizeWidth;
          resized.height = resizeHeight;
          const rCtx = resized.getContext('2d');
          if (rCtx) {
            rCtx.drawImage(canvas, 0, 0, resizeWidth, resizeHeight);
            const baseName = item.name.replace(/\.[^/.]+$/, '');
            downloadCanvas(resized, `${baseName}.${targetFormat}`, `image/${targetFormat}`, quality / 100);
          }
        } else {
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          downloadCanvas(canvas, `${baseName}.${targetFormat}`, `image/${targetFormat}`, quality / 100);
        }
      } catch { /* skip failed */ }
      setConvertedCount(prev => prev + 1);
    }
    setIsConverting(false);
  };

  // When first file loads, seed resize dimensions from its natural size
  useEffect(() => {
    if (converterFiles.length > 0 && resizeEnabled) {
      const img = new Image();
      img.onload = () => {
        resizeAspectRef.current = img.naturalWidth / img.naturalHeight;
        if (lockAspect) {
          setResizeWidth(img.naturalWidth);
          setResizeHeight(img.naturalHeight);
        }
      };
      img.src = converterFiles[0].url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converterFiles.length, resizeEnabled]);

  // ─── Watermark ────────────────────────────────────────────────────────────

  const handleWatermarkExport = async () => {
    if (watermarkFiles.length === 0) return;
    setIsExportingWatermark(true);

    for (const item of watermarkFiles) {
      try {
        const { canvas, ctx } = await loadImageToCanvas(item.url);

        // Draw watermark
        ctx.save();
        ctx.globalAlpha = watermarkOpacity / 100;
        ctx.font = `bold ${watermarkFontSize}px sans-serif`;

        const textMetrics = ctx.measureText(watermarkText);
        const textW = textMetrics.width;
        const textH = watermarkFontSize;
        const padding = 20;

        let x = 0, y = 0;
        switch (watermarkPosition) {
          case 'top-left': x = padding; y = padding + textH; break;
          case 'top-right': x = canvas.width - textW - padding; y = padding + textH; break;
          case 'center': x = (canvas.width - textW) / 2; y = (canvas.height + textH) / 2; break;
          case 'bottom-left': x = padding; y = canvas.height - padding; break;
          case 'bottom-right': x = canvas.width - textW - padding; y = canvas.height - padding; break;
        }

        if (watermarkRotation !== 0) {
          ctx.translate(x + textW / 2, y - textH / 2);
          ctx.rotate((watermarkRotation * Math.PI) / 180);
          ctx.fillStyle = watermarkColor;
          ctx.fillText(watermarkText, -textW / 2, textH / 2);
        } else {
          ctx.fillStyle = watermarkColor;
          ctx.fillText(watermarkText, x, y);
        }
        ctx.restore();

        const baseName = item.name.replace(/\.[^/.]+$/, '');
        downloadCanvas(canvas, `${baseName}-watermarked.png`);
      } catch { /* skip */ }
    }
    setIsExportingWatermark(false);
  };

  // ─── EXIF Metadata ────────────────────────────────────────────────────────

  const handleMetadataUpload = useCallback(async (newFiles: UploadedFile[]) => {
    setMetadataFiles(prev => [...prev, ...newFiles]);
    setIsParsing(true);

    const results = new Map<string, Record<string, unknown>>();
    for (const item of newFiles) {
      try {
        const data = await exifr.parse(item.url, true);
        if (data) results.set(item.id, data);
      } catch { /* skip */ }
    }
    setMetadataResults(prev => new Map([...prev, ...results]));
    setIsParsing(false);
  }, []);

  const handleStripAndExport = async () => {
    for (const item of metadataFiles) {
      try {
        const { canvas } = await loadImageToCanvas(item.url);
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const ext = item.name.split('.').pop() || 'jpg';
        downloadCanvas(canvas, `${baseName}-stripped.${ext}`, `image/${ext === 'png' ? 'png' : 'jpeg'}`);
      } catch { /* skip */ }
    }
  };

  // ─── Base64 Encode ──────────────────────────────────────────────────────

  const handleBase64Encode = async () => {
    if (base64Files.length === 0) return;
    const item = base64Files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setBase64Output(reader.result as string);
    };
    reader.readAsDataURL(item.file);
  };

  const handleBase64Decode = () => {
    if (!base64DecodeInput.trim()) return;
    const trimmed = base64DecodeInput.trim();
    const src = trimmed.startsWith('data:') ? trimmed : `data:image/*;base64,${trimmed}`;
    setBase64DecodePreview(src);
  };

  const handleCopyBase64 = async () => {
    if (!base64Output) return;
    await navigator.clipboard.writeText(base64Output);
    setBase64Copied(true);
    setTimeout(() => setBase64Copied(false), 2000);
  };

  const handleDownloadBase64 = () => {
    if (!base64DecodePreview) return;
    const a = document.createElement('a');
    a.href = base64DecodePreview;
    a.download = 'decoded-image.png';
    a.click();
  };

  // ─── SVG Trace ────────────────────────────────────────────────────────────

  const traceToSvg = useCallback(async () => {
    if (svgFiles.length === 0) return;
    setIsTracing(true);
    setSvgOutput('');

    try {
      const { canvas } = await loadImageToCanvas(svgFiles[0].url);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Downsample large images for faster tracing
      const maxDim = 800;
      let w = canvas.width;
      let h = canvas.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const sample = document.createElement('canvas');
      sample.width = w;
      sample.height = h;
      const sCtx = sample.getContext('2d');
      if (!sCtx) throw new Error('Could not get sample context');
      sCtx.drawImage(canvas, 0, 0, w, h);
      const imageData = sCtx.getImageData(0, 0, w, h);

      // Dynamic import to keep bundle size down
      const ImageTracer = await import('imagetracerjs');
      const tracer = ImageTracer.default || ImageTracer;

      // Use imagedataToSVG for reliable tracing (works with ImageData directly)
      const presetOptions: Record<string, Record<string, unknown>> = {
        posterized: { numberofcolors: 8, mincolorratio: 0, colorquantcycles: 3, blurradius: 1 },
        detailed: { numberofcolors: 16, mincolorratio: 0, colorquantcycles: 5, blurradius: 0.5, pathomit: 0 },
        curvy: { numberofcolors: 6, mincolorratio: 0, blurradius: 2, blurdelta: 20, ltres: 1 },
        sharp: { numberofcolors: 12, mincolorratio: 0, blurradius: 0, pathomit: 0, ltres: 1, qtres: 1 },
      };

      const options = { ...presetOptions[svgPreset] || presetOptions.posterized, scale: 1 };
      const svgString = tracer.imagedataToSVG(imageData, options);
      setSvgOutput(svgString);
    } catch (err) {
      console.error('SVG trace error:', err);
      setSvgOutput('<!-- Trace failed: ' + String(err) + ' -->');
    }
    setIsTracing(false);
  }, [svgFiles, svgPreset]);

  const handleDownloadSvg = () => {
    if (!svgOutput) return;
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'traced.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Palette Extraction ───────────────────────────────────────────────────

  const extractPalette = useCallback(async (file: UploadedFile) => {
    setIsExtracting(true);
    try {
      const { canvas } = await loadImageToCanvas(file.url);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Downsample for performance
      const size = 100;
      const sample = document.createElement('canvas');
      sample.width = size;
      sample.height = size;
      const sCtx = sample.getContext('2d');
      if (!sCtx) return;
      sCtx.drawImage(canvas, 0, 0, size, size);
      const data = sCtx.getImageData(0, 0, size, size).data;

      // K-means-like color quantization
      const pixels: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }

      // Simple median cut
      const colors = medianCut(pixels, 8);
      setPaletteColors(colors.map(c => rgbToHex(c[0], c[1], c[2])));
    } catch { /* skip */ }
    setIsExtracting(false);
  }, []);

  const copiedColorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    clearTimeout(copiedColorTimerRef.current);
    copiedColorTimerRef.current = setTimeout(() => setCopiedColor(null), 1500);
  };

  // ─── Palette Export ──────────────────────────────────────────────────────

  const generatePaletteExport = useCallback(() => {
    if (paletteColors.length === 0) return '';
    const names = paletteColors.map((_, i) => `color-${i + 1}`);

    switch (paletteExportFormat) {
      case 'css':
        return `:root {
${paletteColors.map((c, i) => `  --palette-${names[i]}: ${c};`).join('\n')}
}

/* Usage example */
.primary   { color: var(--palette-color-1); }
.secondary { color: var(--palette-color-2); }
.accent    { color: var(--palette-color-3); }`;

      case 'tailwind':
        return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        palette: {
${paletteColors.map((c, i) => `          '${(i + 1) * 100}': '${c}',`).join('\n')}
        },
      },
    },
  },
};`;

      case 'scss':
        return `// SCSS Variables
${paletteColors.map((c, i) => `$palette-${names[i]}: ${c};`).join('\n')}

// Map for iteration
$palette: (
${paletteColors.map((c, i) => `  '${names[i]}': ${c},`).join('\n')}
);

// Usage
@each $name, $color in $palette {
  .text-#{$name} { color: $color; }
}`;

      case 'json':
        return JSON.stringify(
          Object.fromEntries(paletteColors.map((c, i) => [names[i], { hex: c, rgb: hexToRgb(c) }])),
          null, 2
        );

      default:
        return '';
    }
  }, [paletteColors, paletteExportFormat]);

  const handleCopyPaletteExport = async () => {
    const output = generatePaletteExport();
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setPaletteExportCopied(true);
    setTimeout(() => setPaletteExportCopied(false), 2000);
  };

  const handleDownloadPaletteExport = () => {
    const output = generatePaletteExport();
    if (!output) return;
    const ext = paletteExportFormat === 'json' ? 'json' : paletteExportFormat === 'scss' ? 'scss' : 'css';
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palette.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Web Image Load ──────────────────────────────────────────────────────

  const handleWebLoad = async () => {
    if (!webUrl.trim()) return;
    setWebLoading(true);
    setWebError(null);
    setWebPreview(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image from URL'));
        img.src = webUrl.trim();
      });
      setWebPreview(webUrl.trim());
    } catch (err) {
      setWebError(err instanceof Error ? err.message : 'Failed to load image');
    }
    setWebLoading(false);
  };

  const handleWebEditorSave = (blob: Blob, _isSaveAs: boolean) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-image.jpg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    const allFiles = [...converterFiles, ...watermarkFiles, ...metadataFiles];
    return () => { allFiles.forEach(f => URL.revokeObjectURL(f.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-gray-100 overflow-y-auto custom-scrollbar p-6 lg:p-10">
      {/* Header Banner */}
      <div className="max-w-6xl mx-auto w-full mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface/80 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 z-10">
            <div className="p-3 rounded-2xl bg-blue-600/15 border border-blue-500/30 shadow-inner flex items-center justify-center">
              <img src="/toolbox.svg" alt="Toolbox" className="w-10 h-10 object-contain filter invert brightness-125 drop-shadow-[0_0_10px_rgba(37,99,235,0.6)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Image Toolbox</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  PRO SUITE
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Professional studio utilities for PDF creation, collage building, format conversion, watermarking, and privacy inspection.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar / Tool Cards */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">Studio Tools</p>

          {[
            { id: 'pdf' as ToolTab, title: 'PDF Document Creator', desc: 'Generate print-ready A4, Letter & Square PDF books', icon: FileText, badge: 'Export' },
            { id: 'collage' as ToolTab, title: 'Collage Builder', desc: 'Multi-photo grid composer with custom margins', icon: LayoutGrid, badge: 'Layout' },
            { id: 'converter' as ToolTab, title: 'Format Converter', desc: 'Batch convert, resize & compress WebP, PNG, JPEG', icon: RefreshCw, badge: 'Batch' },
            { id: 'watermark' as ToolTab, title: 'Watermark Studio', desc: 'Apply text overlays with custom fonts, position & opacity', icon: Stamp, badge: 'Brand' },
            { id: 'metadata' as ToolTab, title: 'EXIF Privacy Inspector', desc: 'View & strip camera metadata before publishing', icon: ShieldCheck, badge: 'Privacy' },
            { id: 'base64' as ToolTab, title: 'Base64 Tools', desc: 'Encode images to Base64 strings, or decode strings to images', icon: Code2, badge: 'Dev' },
            { id: 'svg-trace' as ToolTab, title: 'Images to SVG', desc: 'Trace raster images into scalable SVG vector graphics', icon: Paintbrush, badge: 'Vector' },
            { id: 'palette' as ToolTab, title: 'Palette Tools', desc: 'Extract dominant color palettes from any image', icon: Palette, badge: 'Color' },
            { id: 'web-load' as ToolTab, title: 'Web Image Loader', desc: 'Load, preview, edit & save images from any URL', icon: Globe, badge: 'Web' },
          ].map(tool => {
            const isActive = activeTab === tool.id;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className={`w-full p-4 rounded-xl border text-left transition-colors 150ms ease, border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease relative overflow-hidden flex items-start gap-3.5 group ${
                  isActive
                    ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_20px_rgba(37,99,235,0.15)] ring-1 ring-blue-500/30'
                    : 'border-white/10 bg-surface/50 hover:bg-surface/80 hover:border-white/20'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-white/5 text-neutral-400 group-hover:text-white'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                      {tool.title}
                    </h3>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400 shrink-0">
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{tool.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tool Playground */}
        <div className="lg:col-span-8">
          <div className="bg-surface/80 border border-white/10 rounded-2xl p-6 lg:p-8 backdrop-blur-xl shadow-2xl min-h-[540px] flex flex-col">

            {/* ── PDF ──────────────────────────────────────────────── */}
            {activeTab === 'pdf' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
                  <FileText size={32} />
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-bold text-white">Create PDF Document</h2>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    Arrange your photo collection into print-ready PDF documents with custom page sizes, grid layouts, and optional text captions.
                  </p>
                </div>
                <button
                  onClick={() => setIsPdfOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-colors 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) active:scale-[0.98]"
                >
                  <Sparkles size={16} />
                  Launch PDF Studio
                </button>
              </div>
            )}

            {/* ── Collage ─────────────────────────────────────────── */}
            {activeTab === 'collage' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl">
                  <LayoutGrid size={32} />
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-bold text-white">Collage Grid Builder</h2>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    Combine 2 to 6 photos into artistic grid arrangements with configurable inner gaps, custom background hues, and rounded corners.
                  </p>
                </div>
                <button
                  onClick={() => setIsCollageOpen(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-colors 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) active:scale-[0.98]"
                >
                  <LayoutGrid size={16} />
                  Launch Collage Studio
                </button>
              </div>
            )}

            {/* ── Converter ───────────────────────────────────────── */}
            {activeTab === 'converter' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Batch Format Converter</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Convert image files client-side with quality controls</p>
                </div>

                <ToolImageUpload
                  files={converterFiles}
                  onUpload={newFiles => setConverterFiles(prev => [...prev, ...newFiles])}
                  onRemove={id => setConverterFiles(prev => prev.filter(f => f.id !== id))}
                  onClear={() => setConverterFiles([])}
                />

                {converterFiles.length > 0 && (
                  <div className="p-4 bg-neutral-950/60 rounded-xl border border-white/10 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Target Format</label>
                        <div className="flex gap-2">
                          {(['webp', 'png', 'jpeg'] as const).map(fmt => (
                            <button
                              key={fmt}
                              onClick={() => setTargetFormat(fmt)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                targetFormat === fmt ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                              }`}
                            >
                              {fmt.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Quality: {quality}%</label>
                        <input
                          type="range" min={20} max={100} value={quality}
                          onChange={e => setQuality(Number(e.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>

                    {/* Resize section */}
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Maximize2 size={14} className="text-neutral-400" />
                          <label className="text-[11px] font-semibold text-neutral-400">Resize</label>
                        </div>
                        <button
                          onClick={() => setResizeEnabled(prev => !prev)}
                          className={`relative w-9 h-5 rounded-full transition-colors 150ms ease, background-color 150ms ease ${resizeEnabled ? 'bg-blue-600' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform 150ms cubic-bezier(0.23, 1, 0.32, 1) ${resizeEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </div>

                      {resizeEnabled && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">Width (px)</label>
                              <input
                                type="number"
                                min={1}
                                max={10000}
                                value={resizeWidth}
                                onChange={e => {
                                  const w = Math.max(1, Number(e.target.value) || 1);
                                  setResizeWidth(w);
                                  if (lockAspect) setResizeHeight(Math.round(w / resizeAspectRef.current));
                                }}
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>

                            <button
                              onClick={() => setLockAspect(prev => !prev)}
                              className={`mt-4 p-1.5 rounded-lg border transition-colors 150ms ease, border-color 150ms ease, background-color 150ms ease ${
                                lockAspect
                                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                  : 'bg-white/5 border-white/10 text-neutral-500 hover:text-white'
                              }`}
                              title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {lockAspect ? (
                                  <>
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </>
                                ) : (
                                  <>
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                  </>
                                )}
                              </svg>
                            </button>

                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">Height (px)</label>
                              <input
                                type="number"
                                min={1}
                                max={10000}
                                value={resizeHeight}
                                onChange={e => {
                                  const h = Math.max(1, Number(e.target.value) || 1);
                                  setResizeHeight(h);
                                  if (lockAspect) setResizeWidth(Math.round(h * resizeAspectRef.current));
                                }}
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>
                          </div>

                          <div className="flex gap-1.5">
                            {([
                              { label: '½', w: 0.5 },
                              { label: '1×', w: 1 },
                              { label: '2×', w: 2 },
                              { label: '1080p', w: 1080 },
                              { label: 'Square', w: -1 },
                            ]).map(preset => (
                              <button
                                key={preset.label}
                                onClick={() => {
                                  if (preset.w === -1) {
                                    const side = Math.min(resizeWidth, resizeHeight);
                                    setResizeWidth(side);
                                    setResizeHeight(side);
                                    setLockAspect(true);
                                    resizeAspectRef.current = 1;
                                  } else {
                                    const img = new Image();
                                    img.onload = () => {
                                      const w = Math.round(img.naturalWidth * preset.w);
                                      const h = Math.round(img.naturalHeight * preset.w);
                                      setResizeWidth(w);
                                      setResizeHeight(h);
                                      resizeAspectRef.current = img.naturalWidth / img.naturalHeight;
                                    };
                                    img.src = converterFiles[0]?.url || '';
                                  }
                                }}
                                className="flex-1 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleConvertAndDownload}
                      disabled={isConverting}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <Download size={15} />
                      {isConverting ? `Converting (${convertedCount}/${converterFiles.length})…` : `Convert & Download ${converterFiles.length} Images`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Watermark Studio ────────────────────────────────── */}
            {activeTab === 'watermark' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Watermark Studio</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Apply text overlays with custom fonts, position, and opacity</p>
                </div>

                <ToolImageUpload
                  files={watermarkFiles}
                  onUpload={newFiles => setWatermarkFiles(prev => [...prev, ...newFiles])}
                  onRemove={id => setWatermarkFiles(prev => prev.filter(f => f.id !== id))}
                  onClear={() => setWatermarkFiles([])}
                />

                {watermarkFiles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Controls */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Watermark Text</label>
                        <input
                          type="text" value={watermarkText}
                          onChange={e => setWatermarkText(e.target.value)}
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Position</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['top-left', 'center', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
                            <button
                              key={pos}
                              onClick={() => setWatermarkPosition(pos)}
                              className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                                watermarkPosition === pos ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                              }`}
                            >
                              {pos.replace(/-/g, ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-neutral-300 block mb-1">Opacity: {watermarkOpacity}%</label>
                          <input type="range" min={10} max={100} value={watermarkOpacity} onChange={e => setWatermarkOpacity(Number(e.target.value))} className="w-full accent-blue-500" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-300 block mb-1">Font Size: {watermarkFontSize}px</label>
                          <input type="range" min={10} max={80} value={watermarkFontSize} onChange={e => setWatermarkFontSize(Number(e.target.value))} className="w-full accent-blue-500" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-neutral-300 block mb-1">Color</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={watermarkColor} onChange={e => setWatermarkColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer" />
                            <span className="text-[10px] font-mono text-neutral-500">{watermarkColor}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-300 block mb-1">Rotation: {watermarkRotation}°</label>
                          <input type="range" min={-45} max={45} value={watermarkRotation} onChange={e => setWatermarkRotation(Number(e.target.value))} className="w-full accent-blue-500" />
                        </div>
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl p-3 flex flex-col gap-3">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Live Preview</p>
                      <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-white/5">
                        <img src={watermarkFiles[0]?.url} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.6)' }} />
                        <div
                          className={`absolute text-sm font-bold bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 ${
                            watermarkPosition === 'top-left' ? 'top-3 left-3' :
                            watermarkPosition === 'top-right' ? 'top-3 right-3' :
                            watermarkPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                            watermarkPosition === 'bottom-left' ? 'bottom-3 left-3' :
                            'bottom-3 right-3'
                          }`}
                          style={{ color: watermarkColor, opacity: watermarkOpacity / 100, transform: watermarkPosition === 'center' ? `translate(-50%,-50%) rotate(${watermarkRotation}deg)` : `rotate(${watermarkRotation}deg)` }}
                        >
                          {watermarkText}
                        </div>
                      </div>
                      <button
                        onClick={handleWatermarkExport}
                        disabled={isExportingWatermark}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                      >
                        <Download size={14} />
                        {isExportingWatermark ? 'Exporting…' : `Export ${watermarkFiles.length} Watermarked Images`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EXIF Privacy Inspector ──────────────────────────── */}
            {activeTab === 'metadata' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">EXIF Privacy Inspector</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">Inspect & strip sensitive location & camera metadata</p>
                  </div>
                  {metadataFiles.length > 0 && (
                    <button
                      onClick={handleStripAndExport}
                      className="px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-600 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <ShieldCheck size={12} />
                      Strip & Export All
                    </button>
                  )}
                </div>

                <ToolImageUpload
                  files={metadataFiles}
                  onUpload={handleMetadataUpload}
                  onRemove={id => {
                    setMetadataFiles(prev => prev.filter(f => f.id !== id));
                    setMetadataResults(prev => { const n = new Map(prev); n.delete(id); return n; });
                  }}
                  onClear={() => { setMetadataFiles([]); setMetadataResults(new Map()); }}
                />

                {isParsing && (
                  <div className="flex items-center gap-2 text-xs text-blue-400">
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Parsing EXIF data…
                  </div>
                )}

                {metadataFiles.length > 0 && !isParsing && (
                  <div className="space-y-4">
                    {metadataFiles.map(file => {
                      const exif = metadataResults.get(file.id);
                      const hasData = exif && Object.keys(exif).length > 0;
                      return (
                        <div key={file.id} className="bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-3 p-4 border-b border-white/5">
                            <img src={file.url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {hasData ? (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-400">
                                    <AlertTriangle size={10} />
                                    {Object.keys(exif).length} metadata fields found
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                                    <CheckCircle2 size={10} />
                                    No EXIF data detected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {hasData && (
                            <div className="p-4 max-h-64 overflow-y-auto custom-scrollbar">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {Object.entries(exif).map(([key, value]) => {
                                  if (value === undefined || value === null) return null;
                                  const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
                                  if (display.length > 100) return null;
                                  const isSensitive = /gps|lat|lon|serial|software|copyright/i.test(key);
                                  return (
                                    <div key={key} className="flex flex-col">
                                      <span className="text-[10px] text-neutral-500 font-mono">{key}</span>
                                      <span className={`text-[11px] font-medium break-all ${isSensitive ? 'text-amber-400' : 'text-neutral-300'}`}>
                                        {display}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {metadataFiles.length === 0 && !isParsing && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
                      <ShieldCheck size={32} />
                    </div>
                    <div className="max-w-sm">
                      <h2 className="text-base font-bold text-white">Privacy Shield</h2>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                        Upload images to inspect GPS coordinates, camera serial numbers, and device hardware signatures. Export stripped versions for safe sharing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* ── Base64 Tools ────────────────────────────────────── */}
            {activeTab === 'base64' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Base64 Tools</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Encode images to Base64 strings, or decode strings to images</p>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  {[{ id: 'encode' as const, label: 'Image → Base64' }, { id: 'decode' as const, label: 'Base64 → Image' }].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setBase64Mode(m.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        base64Mode === m.id ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {base64Mode === 'encode' ? (
                  <div className="space-y-4">
                    <ToolImageUpload
                      files={base64Files}
                      onUpload={newFiles => { setBase64Files([newFiles[0]]); setBase64Output(''); }}
                      onRemove={() => { setBase64Files([]); setBase64Output(''); }}
                      onClear={() => { setBase64Files([]); setBase64Output(''); }}
                    />
                    {base64Files.length > 0 && !base64Output && (
                      <button
                        onClick={handleBase64Encode}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all"
                      >
                        <Code2 size={15} />
                        Encode to Base64
                      </button>
                    )}
                    {base64Output && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-xl p-3">
                          <p className="text-[10px] text-neutral-500 mb-1.5 font-mono">Output ({Math.round(base64Output.length / 1024)}KB)</p>
                          <textarea
                            readOnly
                            value={base64Output.slice(0, 500) + (base64Output.length > 500 ? '…' : '')}
                            className="w-full h-24 bg-neutral-900 border border-white/10 rounded-lg p-2.5 text-[10px] text-neutral-300 font-mono resize-none focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyBase64}
                            className="flex-1 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            {base64Copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {base64Copied ? 'Copied!' : 'Copy Full String'}
                          </button>
                          <button
                            onClick={() => { const a = document.createElement('a'); a.href = base64Output; a.download = 'image-base64.txt'; a.click(); }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Download size={14} />
                            Save as .txt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      placeholder="Paste Base64 string here (with or without data:image prefix)…"
                      value={base64DecodeInput}
                      onChange={e => { setBase64DecodeInput(e.target.value); setBase64DecodePreview(null); }}
                      className="w-full h-28 bg-neutral-900 border border-white/10 rounded-xl p-3 text-xs text-neutral-300 font-mono resize-none focus:outline-none focus:border-blue-500 transition-colors placeholder-neutral-600"
                    />
                    <button
                      onClick={handleBase64Decode}
                      disabled={!base64DecodeInput.trim()}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <Code2 size={15} />
                      Decode to Image
                    </button>
                    {base64DecodePreview && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-2xl p-3">
                          <img src={base64DecodePreview} alt="Decoded" className="w-full rounded-xl object-contain max-h-64" />
                        </div>
                        <button
                          onClick={handleDownloadBase64}
                          className="w-full py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download size={14} />
                          Save Decoded Image
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Images to SVG ───────────────────────────────────── */}
            {activeTab === 'svg-trace' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Images to SVG</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Trace raster images into scalable SVG vector graphics</p>
                </div>

                <ToolImageUpload
                  files={svgFiles}
                  onUpload={newFiles => { setSvgFiles([newFiles[0]]); setSvgOutput(''); }}
                  onRemove={() => { setSvgFiles([]); setSvgOutput(''); }}
                  onClear={() => { setSvgFiles([]); setSvgOutput(''); }}
                />

                {svgFiles.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-2">Trace Preset</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'posterized' as const, label: 'Poster' },
                          { id: 'detailed' as const, label: 'Detail' },
                          { id: 'curvy' as const, label: 'Curvy' },
                          { id: 'sharp' as const, label: 'Sharp' },
                        ]).map(p => (
                          <button
                            key={p.id}
                            onClick={() => setSvgPreset(p.id)}
                            className={`py-2 rounded-lg text-[10px] font-semibold transition-all ${
                              svgPreset === p.id ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={traceToSvg}
                      disabled={isTracing}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      {isTracing ? (
                        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tracing…</>
                      ) : (
                        <><Paintbrush size={15} /> Trace to SVG</>
                      )}
                    </button>

                    {svgOutput && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-2xl p-3 flex items-center justify-center min-h-[200px]">
                          <div dangerouslySetInnerHTML={{ __html: svgOutput }} className="w-full h-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-64" />
                        </div>
                        <div className="bg-neutral-950 border border-white/10 rounded-xl p-3">
                          <p className="text-[10px] text-neutral-500 mb-1.5 font-mono">SVG Output ({Math.round(svgOutput.length / 1024)}KB)</p>
                          <textarea
                            readOnly
                            value={svgOutput.slice(0, 300) + (svgOutput.length > 300 ? '…' : '')}
                            className="w-full h-20 bg-neutral-900 border border-white/10 rounded-lg p-2.5 text-[10px] text-neutral-300 font-mono resize-none focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleDownloadSvg}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                        >
                          <Download size={14} />
                          Download SVG
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Palette Tools ────────────────────────────────────── */}
            {activeTab === 'palette' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Palette Tools</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Extract dominant color palettes from any image</p>
                </div>

                <ToolImageUpload
                  files={paletteFiles}
                  onUpload={newFiles => { setPaletteFiles([newFiles[0]]); setPaletteColors([]); }}
                  onRemove={() => { setPaletteFiles([]); setPaletteColors([]); }}
                  onClear={() => { setPaletteFiles([]); setPaletteColors([]); }}
                />

                {paletteFiles.length > 0 && !paletteColors.length && (
                  <button
                    onClick={() => extractPalette(paletteFiles[0])}
                    disabled={isExtracting}
                    className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {isExtracting ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing…</>
                    ) : (
                      <><Palette size={15} /> Extract Palette</>
                    )}
                  </button>
                )}

                {paletteFiles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Source preview */}
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl p-3">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Source Image</p>
                      <img src={paletteFiles[0]?.url} alt="" className="w-full rounded-xl object-cover aspect-video" />
                    </div>

                    {/* Palette output */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Extracted Palette</p>
                      {paletteColors.length > 0 ? (
                        <div className="space-y-4">
                          {/* Color list */}
                          <div className="space-y-2">
                            {paletteColors.map((color, i) => (
                              <button
                                key={i}
                                onClick={() => handleCopyColor(color)}
                                className="w-full flex items-center gap-3 p-2.5 bg-neutral-950 border border-white/10 rounded-xl hover:border-white/20 transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg shrink-0 border border-white/10" style={{ backgroundColor: color }} />
                                <div className="flex-1 text-left">
                                  <p className="text-xs font-mono text-neutral-300 uppercase">{color}</p>
                                  <p className="text-[10px] text-neutral-500">RGB {parseInt(color.slice(1, 3), 16)}, {parseInt(color.slice(3, 5), 16)}, {parseInt(color.slice(5, 7), 16)}</p>
                                </div>
                                <span className="text-[10px] text-neutral-500 group-hover:text-white transition-colors">
                                  {copiedColor === color ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Export formats */}
                          <div className="border-t border-white/10 pt-4 space-y-3">
                            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Export Palette</p>
                            <div className="flex gap-1.5">
                              {([
                                { id: 'css' as const, label: 'CSS' },
                                { id: 'tailwind' as const, label: 'Tailwind' },
                                { id: 'scss' as const, label: 'SCSS' },
                                { id: 'json' as const, label: 'JSON' },
                              ]).map(fmt => (
                                <button
                                  key={fmt.id}
                                  onClick={() => setPaletteExportFormat(fmt.id)}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                                    paletteExportFormat === fmt.id
                                      ? 'bg-white text-black font-bold'
                                      : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                                  }`}
                                >
                                  {fmt.label}
                                </button>
                              ))}
                            </div>

                            <div className="bg-neutral-950 border border-white/10 rounded-xl p-3">
                              <pre className="text-[10px] text-neutral-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                                {generatePaletteExport()}
                              </pre>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={handleCopyPaletteExport}
                                className="flex-1 py-2 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                              >
                                {paletteExportCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                {paletteExportCopied ? 'Copied!' : 'Copy Code'}
                              </button>
                              <button
                                onClick={handleDownloadPaletteExport}
                                className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                              >
                                <Download size={14} />
                                Save as File
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 flex items-center justify-center">
                          <p className="text-xs text-neutral-600">Click Extract Palette to analyze</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Web Image Loader ────────────────────────────────── */}
            {activeTab === 'web-load' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Web Image Loader</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Load, preview, edit & save images from any URL</p>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="url"
                      placeholder="Paste image URL here…"
                      value={webUrl}
                      onChange={e => setWebUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleWebLoad()}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-neutral-600"
                    />
                  </div>
                  <button
                    onClick={handleWebLoad}
                    disabled={!webUrl.trim() || webLoading}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    {webLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Globe size={14} />
                    )}
                    Load
                  </button>
                </div>

                {webError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                    {webError}
                  </div>
                )}

                {webPreview ? (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl p-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={webPreview}
                        alt="Web loaded"
                        className="w-full rounded-xl object-contain max-h-80"
                        crossOrigin="anonymous"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsWebEditorOpen(true)}
                        className="flex-1 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <Sliders size={14} />
                        Open in Editor
                      </button>
                      <button
                        onClick={() => { const a = document.createElement('a'); a.href = webPreview; a.download = 'web-image.png'; a.click(); }}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Download size={14} />
                        Save
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(webPreview); }}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Copy size={14} />
                        Copy URL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl">
                      <Globe size={32} />
                    </div>
                    <div className="max-w-sm">
                      <h2 className="text-base font-bold text-white">Load from the Web</h2>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                        Paste any image URL above to load, preview, zoom, edit and save it. Supports direct image links (JPG, PNG, WebP, etc.).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <PhotoBook photos={photos} isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} />
      <CollageMaker photos={photos} isOpen={isCollageOpen} onClose={() => setIsCollageOpen(false)} />
      {isWebEditorOpen && webPreview && (
        <EditingMode
          src={webPreview}
          onClose={() => setIsWebEditorOpen(false)}
          onSave={handleWebEditorSave}
        />
      )}
    </div>
  );
};
