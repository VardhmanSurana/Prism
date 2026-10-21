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
  Film,
  Scissors,
  Image as ImageIcon,
  Type,
  ArrowLeft,
  Play,
  Plus,
} from 'lucide-react';
import exifr from 'exifr';
import { Photo } from '@/types';
import { PhotoBook } from '../PhotoView/PhotoBook';
import { CollageMaker } from '../PhotoView/CollageMaker';
import { EditingMode } from '../Editor/ImageEditor/EditingMode';
import { StudioToolboxCatalog } from './StudioToolboxCatalog';
import {
  getVideoInfo,
  trimVideoFile,
  compressVideoFile,
  videoToGif,
  formatBytes,
  formatTimecode,
  downloadBlob,
  estimateGifFrameCount,
  GIF_MAX_FRAMES,
  type VideoInfo,
  type VideoToolResult,
  type CompressionQuality,
} from './videoTools';
import {
  parseSubtitles,
  serializeSubtitles,
  validateSubtitleCues,
  formatSubtitleTimestamp,
  type SubtitleCue,
  type SubtitleFormat,
} from './subtitles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageToolboxViewProps {
  photos?: Photo[];
  onPhotoClick?: (photo: Photo | null) => void;
}

type ToolTab = 'pdf' | 'collage' | 'converter' | 'watermark' | 'metadata' | 'base64' | 'svg-trace' | 'palette' | 'web-load' | 'video-trimmer' | 'video-gif' | 'video-compress' | 'subtitles';

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

  /**
   * handleFiles - Handles files.
   */
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

  /**
   * handleDrop - Handles drop.
   */
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
        className={`border-2 border-dashed rounded-[10px] flex flex-col items-center justify-center p-10 cursor-pointer transition-colors duration-200 ease-out gap-3 ${
          isDragOver
            ? 'border-white/20 bg-white/5'
            : 'border-white/10 hover:border-white/25 hover:bg-white/5'
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
            className="px-3 py-1.5 bg-white/10 border border-white/20 text-neutral-300 hover:text-white hover:bg-white/15 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Upload size={12} />
            Add More
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors duration-150 ease-out"
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
          <div key={file.id} className="relative aspect-square bg-neutral-900 rounded-md border border-white/10 overflow-hidden group">
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

// ─── Shared Upload Component (video) ─────────────────────────────────────

/**
 * ToolVideoUpload - Single-file video picker with drag & drop, preview and metadata.
 */
const ToolVideoUpload: React.FC<{
  file: UploadedFile | null;
  info: VideoInfo | null;
  onUpload: (file: UploadedFile) => void;
  onClear: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}> = ({ file, info, onUpload, onClear, videoRef }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * handleFiles - Accepts the first video file from a file list.
   */
  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const video = Array.from(fileList).find(f => f.type.startsWith('video/'));
    if (!video) return;
    onUpload({
      id: `video-${Date.now()}`,
      name: video.name,
      url: URL.createObjectURL(video),
      file: video,
    });
  }, [onUpload]);

  /**
   * handleDrop - Handles drop.
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (!file) {
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-[10px] flex flex-col items-center justify-center p-10 cursor-pointer transition-colors duration-200 ease-out gap-3 ${
          isDragOver
            ? 'border-white/20 bg-white/5'
            : 'border-white/10 hover:border-white/25 hover:bg-white/5'
        }`}
      >
        <Upload className="w-10 h-10 text-neutral-500" />
        <p className="text-xs font-medium text-neutral-300">Click or drop a video here</p>
        <p className="text-[11px] text-neutral-500">Supports MP4, WebM, MOV, MKV</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-neutral-300 truncate">{file.name}</p>
          <p className="text-[10px] text-neutral-500 font-mono">
            {formatBytes(file.file.size)}
            {info ? ` · ${info.width}×${info.height} · ${formatTimecode(info.duration)}` : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-white/10 border border-white/20 text-neutral-300 hover:text-white hover:bg-white/15 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors duration-150 ease-out"
          >
            <Upload size={12} />
            Replace
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors duration-150 ease-out"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
      <video
        ref={videoRef}
        src={file.url}
        controls
        className="w-full max-h-56 rounded-lg bg-black border border-white/10"
      />
    </div>
  );
};

// ─── Utility: draw image to canvas ────────────────────────────────────────────

/**
 * loadImageToCanvas - Decodes an image source into a canvas.
 * Prefers createImageBitmap (off-main-thread decode) and falls back to the
 * classic <img> decoder when bitmap decoding is unavailable or blocked.
 */
async function loadImageToCanvas(src: string): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  try {
    const response = await fetch(src);
    if (response.ok) {
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Canvas context unavailable');
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { canvas, ctx };
    }
  } catch {
    // Fall back to the <img> decoder below.
  }

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
      resolve({ canvas, ctx });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * downloadCanvas - Performs download canvas.
 */
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

/**
 * medianCut - Performs median cut.
 */
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

/**
 * rgbToHex - Performs rgb to hex.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * hexToRgb - Performs hex to rgb.
 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ImageToolboxView - Renders image toolbox view.
 */
export const ImageToolboxView: React.FC<ImageToolboxViewProps> = ({ photos = [] }) => {
  const [viewMode, setViewMode] = useState<'catalog' | 'tool'>('catalog');
  const [activeTab, setActiveTab] = useState<ToolTab>('pdf');
  const [toolCategory, setToolCategory] = useState<'image' | 'video'>('image');
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isCollageOpen, setIsCollageOpen] = useState(false);

  // Converter state
  const [converterFiles, setConverterFiles] = useState<UploadedFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<'png' | 'jpeg' | 'webp' | 'avif'>('webp');
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

  // Converter: browser-encodable formats (detected at runtime) + failures
  const [encodableFormats, setEncodableFormats] = useState<Array<'png' | 'jpeg' | 'webp' | 'avif'>>(
    ['png', 'jpeg', 'webp'],
  );
  const [convertFailures, setConvertFailures] = useState<string[]>([]);

  // Video tool state (shared source file across trimmer/compressor/GIF)
  const [videoFile, setVideoFile] = useState<UploadedFile | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoInfoError, setVideoInfoError] = useState<string | null>(null);
  const trimPreviewRef = useRef<HTMLVideoElement>(null);

  // Trimmer state
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState<number>(0);
  const [trimResult, setTrimResult] = useState<VideoToolResult | null>(null);
  const [trimError, setTrimError] = useState<string | null>(null);

  // Compressor state
  const [compressQuality, setCompressQuality] = useState<CompressionQuality>('medium');
  const [compressMaxHeight, setCompressMaxHeight] = useState<number>(0); // 0 = keep original
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<number>(0);
  const [compressResult, setCompressResult] = useState<VideoToolResult | null>(null);
  const [compressError, setCompressError] = useState<string | null>(null);

  // GIF state
  const [gifFps, setGifFps] = useState<number>(15);
  const [gifMaxWidth, setGifMaxWidth] = useState<number>(480);
  const [gifStart, setGifStart] = useState<number>(0);
  const [gifEnd, setGifEnd] = useState<number>(0);
  const [isGifConverting, setIsGifConverting] = useState(false);
  const [gifProgress, setGifProgress] = useState<number>(0);
  const [gifResult, setGifResult] = useState<VideoToolResult | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);

  // Subtitle editor state
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleFormat, setSubtitleFormat] = useState<SubtitleFormat>('srt');
  const [subtitleName, setSubtitleName] = useState<string>('subtitles');
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitlePasteText, setSubtitlePasteText] = useState<string>('');
  const subtitleInputRef = useRef<HTMLInputElement>(null);



  // ─── Converter ────────────────────────────────────────────────────────────

  /**
   * handleConvertAndDownload - Handles convert and download.
   */
  const handleConvertAndDownload = async () => {
    if (converterFiles.length === 0) return;
    setIsConverting(true);
    setConvertedCount(0);
    setConvertFailures([]);

    const failures: string[] = [];
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
      } catch {
        failures.push(item.name);
      }
      setConvertedCount(prev => prev + 1);
    }
    setConvertFailures(failures);
    setIsConverting(false);
  };

  // Detect which image encoders this browser actually implements, so the
  // converter only offers formats that will not silently fall back to PNG.
  useEffect(() => {
    let cancelled = false;
    const detect = (type: string) =>
      new Promise<boolean>(resolve => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        canvas.toBlob(blob => resolve(!!blob && blob.type === type), type);
      });
    (async () => {
      const [webp, avif] = await Promise.all([detect('image/webp'), detect('image/avif')]);
      if (cancelled) return;
      const formats: Array<'png' | 'jpeg' | 'webp' | 'avif'> = ['png', 'jpeg'];
      if (webp) formats.push('webp');
      if (avif) formats.push('avif');
      setEncodableFormats(formats);
      setTargetFormat(prev => (formats.includes(prev) ? prev : 'png'));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * handleWatermarkExport - Handles watermark export.
   */
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

  /**
   * handleMetadataUpload - Handles metadata upload.
   */
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

  /**
   * handleStripAndExport - Handles strip and export.
   */
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

  // ─── Video Tools (Mediabunny / WebCodecs) ───────────────────────────────

  /**
   * revokeVideoState - Revokes object URLs and resets all video tool state.
   */
  const revokeVideoState = useCallback(() => {
    setVideoFile(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setTrimResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setCompressResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setGifResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setVideoInfo(null);
    setVideoInfoError(null);
    setTrimStart(0);
    setTrimEnd(0);
    setTrimProgress(0);
    setTrimError(null);
    setCompressProgress(0);
    setCompressError(null);
    setGifStart(0);
    setGifEnd(0);
    setGifProgress(0);
    setGifError(null);
  }, []);

  /**
   * handleVideoUpload - Loads a source video and reads its metadata.
   */
  const handleVideoUpload = useCallback((item: UploadedFile) => {
    revokeVideoState();
    setVideoFile(item);
    getVideoInfo(item.file)
      .then(info => {
        setVideoInfo(info);
        setTrimEnd(info.duration);
        setGifEnd(Math.min(info.duration, 15));
      })
      .catch((err: unknown) => {
        setVideoInfoError(err instanceof Error ? err.message : 'Could not read video metadata.');
      });
  }, [revokeVideoState]);

  /**
   * handleTrimPreview - Plays only the selected range in the preview player.
   */
  const handleTrimPreview = () => {
    const video = trimPreviewRef.current;
    if (!video) return;
    video.currentTime = trimStart;
    const stopAt = trimEnd;
    const onTimeUpdate = () => {
      if (video.currentTime >= stopAt) {
        video.pause();
        video.removeEventListener('timeupdate', onTimeUpdate);
      }
    };
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.play()?.catch(() => { /* autoplay blocked */ });
  };

  /**
   * handleTrimExport - Trims the selected range and prepares a download.
   */
  const handleTrimExport = async () => {
    if (!videoFile) return;
    setIsTrimming(true);
    setTrimProgress(0);
    setTrimError(null);
    setTrimResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const result = await trimVideoFile({
        file: videoFile.file,
        start: trimStart,
        end: trimEnd,
        onProgress: setTrimProgress,
      });
      setTrimResult(result);
    } catch (err) {
      setTrimError(err instanceof Error ? err.message : 'Trimming failed.');
    } finally {
      setIsTrimming(false);
    }
  };

  /**
   * handleCompressExport - Re-encodes the video and prepares a download.
   */
  const handleCompressExport = async () => {
    if (!videoFile) return;
    setIsCompressing(true);
    setCompressProgress(0);
    setCompressError(null);
    setCompressResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const result = await compressVideoFile({
        file: videoFile.file,
        quality: compressQuality,
        maxHeight: compressMaxHeight || undefined,
        onProgress: setCompressProgress,
      });
      setCompressResult(result);
    } catch (err) {
      setCompressError(err instanceof Error ? err.message : 'Compression failed.');
    } finally {
      setIsCompressing(false);
    }
  };

  /**
   * handleGifExport - Encodes the selected range as an animated GIF.
   */
  const handleGifExport = async () => {
    if (!videoFile) return;
    setIsGifConverting(true);
    setGifProgress(0);
    setGifError(null);
    setGifResult(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const result = await videoToGif({
        file: videoFile.file,
        fps: gifFps,
        maxWidth: gifMaxWidth,
        start: gifStart,
        end: gifEnd,
        onProgress: setGifProgress,
      });
      setGifResult(result);
    } catch (err) {
      setGifError(err instanceof Error ? err.message : 'GIF conversion failed.');
    } finally {
      setIsGifConverting(false);
    }
  };

  // ─── Subtitle Editor ───────────────────────────────────────────────────

  /**
   * applySubtitleText - Parses subtitle text and loads cues into the editor.
   */
  const applySubtitleText = (text: string, name: string) => {
    try {
      const { format, cues } = parseSubtitles(text);
      if (cues.length === 0) {
        setSubtitleError('No cues found. Check that the text is valid SRT or WebVTT.');
        return;
      }
      setSubtitleFormat(format);
      setSubtitleCues(cues);
      setSubtitleName(name || 'subtitles');
      setSubtitleError(null);
    } catch {
      setSubtitleError('Could not parse the subtitles.');
    }
  };

  /**
   * handleSubtitleFile - Loads and parses a dropped/picked .srt or .vtt file.
   */
  const handleSubtitleFile = async (file: File) => {
    try {
      const text = await file.text();
      applySubtitleText(text, file.name.replace(/\.[^/.]+$/, ''));
    } catch {
      setSubtitleError('Could not read the subtitle file.');
    }
  };

  /**
   * updateSubtitleCue - Applies a partial patch to one cue.
   */
  const updateSubtitleCue = (index: number, patch: Partial<SubtitleCue>) => {
    setSubtitleCues(prev => prev.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)));
  };

  /**
   * removeSubtitleCue - Deletes the cue at the given index.
   */
  const removeSubtitleCue = (index: number) => {
    setSubtitleCues(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * handleSubtitleCopy - Copies the serialized subtitles to the clipboard.
   */
  const handleSubtitleCopy = async () => {
    if (subtitleCues.length === 0) return;
    try {
      await navigator.clipboard.writeText(serializeSubtitles(subtitleCues, subtitleFormat));
    } catch {
      setSubtitleError('Clipboard access was denied.');
    }
  };

  /**
   * addSubtitleCue - Appends a new cue after the current last cue.
   */
  const addSubtitleCue = () => {
    setSubtitleCues(prev => {
      const last = prev[prev.length - 1];
      const start = last ? last.end : 0;
      return [...prev, { start, end: start + 2, text: 'New cue' }];
    });
  };

  /**
   * handleSubtitleDownload - Validates, serializes and downloads the cues.
   */
  const handleSubtitleDownload = (format: SubtitleFormat) => {
    const error = validateSubtitleCues(subtitleCues);
    if (error) {
      setSubtitleError(error);
      return;
    }
    const text = serializeSubtitles(subtitleCues, format);
    const blob = new Blob([text], {
      type: format === 'vtt' ? 'text/vtt' : 'application/x-subrip',
    });
    downloadBlob(blob, `${subtitleName || 'subtitles'}.${format}`);
    setSubtitleError(null);
  };

  // ─── Base64 Encode ──────────────────────────────────────────────────────

  /**
   * handleBase64Encode - Handles base64encode.
   */
  const handleBase64Encode = async () => {
    if (base64Files.length === 0) return;
    const item = base64Files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setBase64Output(reader.result as string);
    };
    reader.readAsDataURL(item.file);
  };

  /**
   * handleBase64Decode - Handles base64decode.
   */
  const handleBase64Decode = () => {
    if (!base64DecodeInput.trim()) return;
    const trimmed = base64DecodeInput.trim();
    const src = trimmed.startsWith('data:') ? trimmed : `data:image/*;base64,${trimmed}`;
    setBase64DecodePreview(src);
  };

  /**
   * handleCopyBase64 - Handles copy base64.
   */
  const handleCopyBase64 = async () => {
    if (!base64Output) return;
    await navigator.clipboard.writeText(base64Output);
    setBase64Copied(true);
    setTimeout(() => setBase64Copied(false), 2000);
  };

  /**
   * handleDownloadBase64 - Handles download base64.
   */
  const handleDownloadBase64 = () => {
    if (!base64DecodePreview) return;
    const a = document.createElement('a');
    a.href = base64DecodePreview;
    a.download = 'decoded-image.png';
    a.click();
  };

  // ─── SVG Trace ────────────────────────────────────────────────────────────

  /**
   * traceToSvg - Performs trace to svg.
   */
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

  /**
   * handleDownloadSvg - Handles download svg.
   */
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

  /**
   * extractPalette - Performs extract palette.
   */
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
  /**
   * handleCopyColor - Handles copy color.
   */
  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    clearTimeout(copiedColorTimerRef.current);
    copiedColorTimerRef.current = setTimeout(() => setCopiedColor(null), 1500);
  };

  // ─── Palette Export ──────────────────────────────────────────────────────

  /**
   * generatePaletteExport - Performs generate palette export.
   */
  const generatePaletteExport = useCallback(() => {
    if (paletteColors.length === 0) return '';
    /**
     * names - Performs names.
     */
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

  /**
   * handleCopyPaletteExport - Handles copy palette export.
   */
  const handleCopyPaletteExport = async () => {
    const output = generatePaletteExport();
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setPaletteExportCopied(true);
    setTimeout(() => setPaletteExportCopied(false), 2000);
  };

  /**
   * handleDownloadPaletteExport - Handles download palette export.
   */
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

  /**
   * handleWebLoad - Handles web load.
   */
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

  /**
   * handleWebEditorSave - Handles web editor save.
   */
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

  const toolTitles: Record<ToolTab, string> = {
    pdf: 'PDF Document Creator',
    collage: 'Collage Builder',
    converter: 'Format Converter',
    watermark: 'Watermark Studio',
    metadata: 'EXIF Privacy Inspector',
    base64: 'Base64 Studio',
    'svg-trace': 'Images to SVG',
    palette: 'Palette Tools',
    'web-load': 'Web Image Loader',
    'video-trimmer': 'Video Trimmer',
    'video-gif': 'Video to GIF',
    'video-compress': 'Video Compressor',
    subtitles: 'Subtitle Editor',
  };

  if (viewMode === 'catalog') {
    return (
      <div className="bg-[#151312] min-h-screen">
        <StudioToolboxCatalog
          photos={photos}
          activeCategory={toolCategory}
          onCategoryChange={setToolCategory}
          onLaunchTool={(tool, category) => {
            setActiveTab(tool);
            setToolCategory(category);
            setViewMode('tool');
          }}
          onOpenPdf={() => setIsPdfOpen(true)}
          onOpenCollage={() => setIsCollageOpen(true)}
        />

        {/* Modals */}
        <PhotoBook isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} />
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
  }

  return (
    <div className="bg-[#151312] text-[#e8e1df] p-6 lg:p-10 min-h-screen">
      {/* Prism Navigation Top Bar */}
      <div className="max-w-6xl mx-auto w-full mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#1d1b1a] border border-[#2c2928] shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('catalog')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-stone-200 text-xs font-mono transition-colors border border-stone-700/40"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Studio Toolbox</span>
            </button>
            <div className="h-4 w-px bg-stone-700/60 hidden sm:block" />
            <span className="text-xs font-mono text-stone-400">
              {toolCategory === 'image' ? 'Image Utilities' : 'Video Utilities'} / <span className="text-stone-200 font-semibold">{toolTitles[activeTab]}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Local Engine</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-visible">
        {/* Navigation Sidebar / Tool Cards */}
        <div className="lg:col-span-4 space-y-3">
          {/* Category Toggle */}
          <div className="flex items-center bg-[#1d1b1a] border border-[#2c2928] rounded-xl p-1 shadow-inner">
            <button
              onClick={() => {
                setToolCategory('image');
                setActiveTab('pdf');
              }}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                toolCategory === 'image'
                  ? 'bg-[#2c2928] text-white shadow-sm border border-stone-600/30'
                  : 'text-[#a8a29e] hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <ImageIcon size={12} />
                Images (8)
              </div>
            </button>
            <button
              onClick={() => {
                setToolCategory('video');
                setActiveTab('video-trimmer');
              }}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                toolCategory === 'video'
                  ? 'bg-[#2c2928] text-white shadow-sm border border-stone-600/30'
                  : 'text-[#a8a29e] hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Film size={12} />
                Video (4)
              </div>
            </button>
          </div>

          {/* Tool Cards */}
          {(toolCategory === 'image' ? [
            { id: 'pdf' as ToolTab, title: 'PDF Document Creator', desc: 'Generate print-ready A4, Letter & Square PDF books', icon: FileText, badge: 'Export' },
            { id: 'collage' as ToolTab, title: 'Collage Builder', desc: 'Multi-photo grid composer with custom margins', icon: LayoutGrid, badge: 'Layout' },
            { id: 'converter' as ToolTab, title: 'Format Converter', desc: 'Batch convert, resize & compress WebP, PNG, JPEG', icon: RefreshCw, badge: 'Batch' },
            { id: 'watermark' as ToolTab, title: 'Watermark Studio', desc: 'Apply text overlays with custom fonts, position & opacity', icon: Stamp, badge: 'Brand' },
            { id: 'metadata' as ToolTab, title: 'EXIF Privacy Inspector', desc: 'View & strip camera metadata before publishing', icon: ShieldCheck, badge: 'Privacy' },
            { id: 'base64' as ToolTab, title: 'Base64 Tools', desc: 'Encode images to Base64 strings, or decode strings to images', icon: Code2, badge: 'Dev' },
            { id: 'svg-trace' as ToolTab, title: 'Images to SVG', desc: 'Trace raster images into scalable SVG vector graphics', icon: Paintbrush, badge: 'Vector' },
            { id: 'palette' as ToolTab, title: 'Palette Tools', desc: 'Extract dominant color palettes from any image', icon: Palette, badge: 'Color' },
            { id: 'web-load' as ToolTab, title: 'Web Image Loader', desc: 'Load, preview, edit & save images from any URL', icon: Globe, badge: 'Web' },
          ] : [
            { id: 'video-trimmer' as ToolTab, title: 'Video Trimmer', desc: 'Cut and trim video clips with precision', icon: Scissors, badge: 'Edit' },
            { id: 'video-gif' as ToolTab, title: 'Video to GIF', desc: 'Convert video clips to animated GIFs', icon: ImageIcon, badge: 'Convert' },
            { id: 'video-compress' as ToolTab, title: 'Video Compressor', desc: 'Reduce video file size while preserving quality', icon: RefreshCw, badge: 'Optimize' },
            { id: 'subtitles' as ToolTab, title: 'Subtitle Editor', desc: 'Add and edit subtitles for your videos', icon: Type, badge: 'Text' },
          ]).map(tool => {
            const isActive = activeTab === tool.id;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                aria-pressed={isActive}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 relative overflow-hidden flex items-start gap-3.5 group ${
                  isActive
                    ? 'border-stone-500/40 bg-[#2c2928] text-white shadow-lg ring-1 ring-stone-500/30'
                    : 'border-[#2c2928] bg-[#1d1b1a] hover:bg-[#221f1e] hover:border-stone-600/30'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${isActive ? 'bg-white text-black' : 'bg-[#151312] border border-[#2c2928] text-stone-400 group-hover:text-white'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-stone-200'}`}>
                      {tool.title}
                    </h3>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-[#2c2928] text-stone-400 shrink-0">
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a8a29e] mt-1 line-clamp-2">{tool.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tool Playground */}
        <div className="lg:col-span-8">
          <div className="bg-[#1d1b1a] border border-[#2c2928] rounded-2xl p-6 lg:p-8 flex flex-col shadow-2xl">

            {/* ── PDF ──────────────────────────────────────────────── */}
            {activeTab === 'pdf' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="w-16 h-16 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center text-neutral-300">
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
                  className="px-6 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-md text-xs shadow-none flex items-center gap-2 transition-all duration-150 ease-out active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <Sparkles size={16} />
                  Launch PDF Studio
                </button>
              </div>
            )}

            {/* ── Collage ─────────────────────────────────────────── */}
            {activeTab === 'collage' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="w-16 h-16 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center text-neutral-300">
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
                  className="px-6 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-md text-xs shadow-none flex items-center gap-2 transition-all duration-150 ease-out active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
                  <div className="p-4 bg-neutral-950/60 rounded-md border border-white/10 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Target Format</label>
                        <div className="flex gap-2">
                          {encodableFormats.map(fmt => (
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
                          className="w-full accent-neutral-400"
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
                          className={`relative w-9 h-5 rounded-full transition-colors duration-150 ease-out ${resizeEnabled ? 'bg-white' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${resizeEnabled ? 'left-[18px]' : 'left-0.5'}`} />
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
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/20 transition-colors"
                              />
                            </div>

                            <button
                              onClick={() => setLockAspect(prev => !prev)}
                              className={`mt-4 p-1.5 rounded-lg border transition-colors duration-150 ease-out ${
                                lockAspect
                                  ? 'bg-white/10 border-white/20 text-neutral-300'
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
                                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/20 transition-colors"
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
                      className="w-full py-3 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-none active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <Download size={15} />
                      {isConverting ? `Converting (${convertedCount}/${converterFiles.length})…` : `Convert & Download ${converterFiles.length} Images`}
                    </button>

                    {convertFailures.length > 0 && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                        Failed to convert: {convertFailures.join(', ')}
                      </div>
                    )}
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
                          className="w-full bg-neutral-900 border border-white/10 rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white/20 transition-colors"
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
                          <input type="range" min={10} max={100} value={watermarkOpacity} onChange={e => setWatermarkOpacity(Number(e.target.value))} className="w-full accent-neutral-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-300 block mb-1">Font Size: {watermarkFontSize}px</label>
                          <input type="range" min={10} max={80} value={watermarkFontSize} onChange={e => setWatermarkFontSize(Number(e.target.value))} className="w-full accent-neutral-400" />
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
                          <input type="range" min={-45} max={45} value={watermarkRotation} onChange={e => setWatermarkRotation(Number(e.target.value))} className="w-full accent-neutral-400" />
                        </div>
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-3 flex flex-col gap-3">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Live Preview</p>
                      <div className="relative w-full aspect-video bg-neutral-900 rounded-md overflow-hidden border border-white/5">
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
                        className="w-full py-2.5 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-none active:scale-[0.98] disabled:opacity-50 transition-all"
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
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <div className="w-3 h-3 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                    Parsing EXIF data…
                  </div>
                )}

                {metadataFiles.length > 0 && !isParsing && (
                  <div className="space-y-4">
                    {metadataFiles.map(file => {
                      const exif = metadataResults.get(file.id);
                      const hasData = exif && Object.keys(exif).length > 0;
                      return (
                        <div key={file.id} className="bg-neutral-950 border border-white/10 rounded-[10px] overflow-hidden">
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
                    <div className="w-16 h-16 rounded-[10px] bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
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
                      className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
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
                        className="w-full py-3 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-none active:scale-[0.98] transition-all"
                      >
                        <Code2 size={15} />
                        Encode to Base64
                      </button>
                    )}
                    {base64Output && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-md p-3">
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
                            className="flex-1 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            {base64Copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {base64Copied ? 'Copied!' : 'Copy Full String'}
                          </button>
                          <button
                            onClick={() => { const a = document.createElement('a'); a.href = base64Output; a.download = 'image-base64.txt'; a.click(); }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
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
                      className="w-full h-28 bg-neutral-900 border border-white/10 rounded-md p-3 text-xs text-neutral-300 font-mono resize-none focus:outline-none focus:border-white/20 transition-colors placeholder-neutral-600"
                    />
                    <button
                      onClick={handleBase64Decode}
                      disabled={!base64DecodeInput.trim()}
                      className="w-full py-3 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-none active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <Code2 size={15} />
                      Decode to Image
                    </button>
                    {base64DecodePreview && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-3">
                          <img src={base64DecodePreview} alt="Decoded" className="w-full rounded-md object-contain max-h-64" />
                        </div>
                        <button
                          onClick={handleDownloadBase64}
                          className="w-full py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
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
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      {isTracing ? (
                        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tracing…</>
                      ) : (
                        <><Paintbrush size={15} /> Trace to SVG</>
                      )}
                    </button>

                    {svgOutput && (
                      <div className="space-y-3">
                        <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-3 flex items-center justify-center min-h-[200px]">
                          <div dangerouslySetInnerHTML={{ __html: svgOutput }} className="w-full h-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-64" />
                        </div>
                        <div className="bg-neutral-950 border border-white/10 rounded-md p-3">
                          <p className="text-[10px] text-neutral-500 mb-1.5 font-mono">SVG Output ({Math.round(svgOutput.length / 1024)}KB)</p>
                          <textarea
                            readOnly
                            value={svgOutput.slice(0, 300) + (svgOutput.length > 300 ? '…' : '')}
                            className="w-full h-20 bg-neutral-900 border border-white/10 rounded-lg p-2.5 text-[10px] text-neutral-300 font-mono resize-none focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleDownloadSvg}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-emerald-600/20 active:scale-[0.98] transition-all"
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
                    className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-amber-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
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
                    <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-3">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Source Image</p>
                      <img src={paletteFiles[0]?.url} alt="" className="w-full rounded-md object-cover aspect-video" />
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
                                className="w-full flex items-center gap-3 p-2.5 bg-neutral-950 border border-white/10 rounded-md hover:border-white/20 transition-all group"
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

                            <div className="bg-neutral-950 border border-white/10 rounded-md p-3">
                              <pre className="text-[10px] text-neutral-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                                {generatePaletteExport()}
                              </pre>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={handleCopyPaletteExport}
                                className="flex-1 py-2 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                              >
                                {paletteExportCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                {paletteExportCopied ? 'Copied!' : 'Copy Code'}
                              </button>
                              <button
                                onClick={handleDownloadPaletteExport}
                                className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                              >
                                <Download size={14} />
                                Save as File
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-6 flex items-center justify-center">
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
                      className="w-full bg-neutral-900 border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 transition-colors placeholder-neutral-600"
                    />
                  </div>
                  <button
                    onClick={handleWebLoad}
                    disabled={!webUrl.trim() || webLoading}
                    className="px-4 py-2.5 bg-white hover:bg-white/90 text-black rounded-md text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    {webLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Globe size={14} />
                    )}
                    Load
                  </button>
                </div>

                {webError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                    {webError}
                  </div>
                )}

                {webPreview ? (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="bg-neutral-950 border border-white/10 rounded-[10px] p-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={webPreview}
                        alt="Web loaded"
                        className="w-full rounded-md object-contain max-h-80"
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
                    <div className="w-16 h-16 rounded-[10px] bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
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

            {/* ── Video Trimmer ──────────────────────────────────── */}
            {activeTab === 'video-trimmer' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Video Trimmer</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Cut a precise range in your browser — media data is copied untouched whenever the container allows it
                  </p>
                </div>

                <ToolVideoUpload
                  file={videoFile}
                  info={videoInfo}
                  onUpload={handleVideoUpload}
                  onClear={revokeVideoState}
                  videoRef={trimPreviewRef}
                />

                {videoInfoError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                    {videoInfoError}
                  </div>
                )}

                {videoFile && !videoInfo && !videoInfoError && (
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <div className="w-3 h-3 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                    Reading video metadata…
                  </div>
                )}

                {videoFile && videoInfo && (
                  <div className="p-4 bg-neutral-950/60 rounded-md border border-white/10 space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>Start</span>
                        <span className="text-stone-200 font-semibold">{formatTimecode(trimStart)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={videoInfo.duration}
                        step={0.1}
                        value={trimStart}
                        onChange={e => setTrimStart(Math.min(Number(e.target.value), Math.max(0, trimEnd - 0.1)))}
                        className="w-full accent-neutral-400"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>End</span>
                        <span className="text-stone-200 font-semibold">{formatTimecode(trimEnd)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={videoInfo.duration}
                        step={0.1}
                        value={trimEnd}
                        onChange={e => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.1))}
                        className="w-full accent-neutral-400"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                        <span>Selected: {formatTimecode(Math.max(0, trimEnd - trimStart))}</span>
                        <span>Source: {formatTimecode(videoInfo.duration)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleTrimPreview}
                        disabled={isTrimming}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Play size={14} />
                        Preview Range
                      </button>
                      <button
                        onClick={handleTrimExport}
                        disabled={isTrimming}
                        className="flex-1 py-2.5 bg-gradient-to-r from-white to-white/90 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 transition-all"
                      >
                        <Scissors size={14} />
                        {isTrimming ? `Trimming… ${Math.round(trimProgress * 100)}%` : 'Trim & Export'}
                      </button>
                    </div>

                    {isTrimming && (
                      <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-200"
                          style={{ width: `${Math.round(trimProgress * 100)}%` }}
                        />
                      </div>
                    )}

                    {trimError && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                        {trimError}
                      </div>
                    )}

                    {trimResult && (
                      <div className="p-3 bg-neutral-900/80 border border-white/10 rounded-md space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            Trim complete
                          </span>
                          <span className="font-mono text-neutral-400">
                            {formatBytes(trimResult.size)} · {trimResult.extension.toUpperCase()}
                          </span>
                        </div>
                        <video src={trimResult.url} controls className="w-full max-h-48 rounded-md bg-black" />
                        <button
                          onClick={() => downloadBlob(trimResult.blob, `${videoFile.name.replace(/\.[^/.]+$/, '')}-trim.${trimResult.extension}`)}
                          className="w-full py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download size={14} />
                          Download Trimmed Clip
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Video to GIF ───────────────────────────────────── */}
            {activeTab === 'video-gif' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Video to GIF Converter</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Decode frames with WebCodecs and encode an animated GIF entirely in your browser
                  </p>
                </div>

                <ToolVideoUpload
                  file={videoFile}
                  info={videoInfo}
                  onUpload={handleVideoUpload}
                  onClear={revokeVideoState}
                />

                {videoInfoError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                    {videoInfoError}
                  </div>
                )}

                {videoFile && videoInfo && (
                  <div className="p-4 bg-neutral-950/60 rounded-md border border-white/10 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Frame Rate</label>
                        <div className="flex gap-1.5">
                          {[15, 24, 30].map(fps => (
                            <button
                              key={fps}
                              onClick={() => setGifFps(fps)}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                gifFps === fps ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                              }`}
                            >
                              {fps} FPS
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Max Width</label>
                        <div className="flex gap-1.5">
                          {[240, 320, 480, 640].map(width => (
                            <button
                              key={width}
                              onClick={() => setGifMaxWidth(width)}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                gifMaxWidth === width ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                              }`}
                            >
                              {width}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>Start</span>
                        <span className="text-stone-200 font-semibold">{formatTimecode(gifStart)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={videoInfo.duration}
                        step={0.1}
                        value={gifStart}
                        onChange={e => setGifStart(Math.min(Number(e.target.value), Math.max(0, gifEnd - 0.1)))}
                        className="w-full accent-neutral-400"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>End</span>
                        <span className="text-stone-200 font-semibold">{formatTimecode(gifEnd)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={videoInfo.duration}
                        step={0.1}
                        value={gifEnd}
                        onChange={e => setGifEnd(Math.max(Number(e.target.value), gifStart + 0.1))}
                        className="w-full accent-neutral-400"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                        <span>Range: {formatTimecode(Math.max(0, gifEnd - gifStart))}</span>
                        <span
                          className={estimateGifFrameCount(gifEnd - gifStart, gifFps) > GIF_MAX_FRAMES ? 'text-amber-400' : ''}
                        >
                          ≈{estimateGifFrameCount(gifEnd - gifStart, gifFps)} frames (max {GIF_MAX_FRAMES})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleGifExport}
                      disabled={isGifConverting || estimateGifFrameCount(gifEnd - gifStart, gifFps) > GIF_MAX_FRAMES}
                      className="w-full py-2.5 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <ImageIcon size={14} />
                      {isGifConverting ? `Encoding… ${Math.round(gifProgress * 100)}%` : 'Convert to GIF'}
                    </button>

                    {isGifConverting && (
                      <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-pink-400 transition-all duration-200"
                          style={{ width: `${Math.round(gifProgress * 100)}%` }}
                        />
                      </div>
                    )}

                    {gifError && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                        {gifError}
                      </div>
                    )}

                    {gifResult && (
                      <div className="p-3 bg-neutral-900/80 border border-white/10 rounded-md space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            GIF ready
                          </span>
                          <span className="font-mono text-neutral-400">{formatBytes(gifResult.size)}</span>
                        </div>
                        <img src={gifResult.url} alt="Generated GIF preview" className="w-full max-h-56 object-contain rounded-md bg-black" />
                        <button
                          onClick={() => downloadBlob(gifResult.blob, `${videoFile.name.replace(/\.[^/.]+$/, '')}.gif`)}
                          className="w-full py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download size={14} />
                          Download GIF
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Video Compressor ────────────────────────────────── */}
            {activeTab === 'video-compress' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Video Compressor</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Re-encode with hardware acceleration to shrink files while keeping perceptual quality
                  </p>
                </div>

                <ToolVideoUpload
                  file={videoFile}
                  info={videoInfo}
                  onUpload={handleVideoUpload}
                  onClear={revokeVideoState}
                />

                {videoInfoError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                    {videoInfoError}
                  </div>
                )}

                {videoFile && videoInfo && (
                  <div className="p-4 bg-neutral-950/60 rounded-md border border-white/10 space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Quality</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'very-low' as CompressionQuality, label: 'Smallest' },
                          { id: 'medium' as CompressionQuality, label: 'Balanced' },
                          { id: 'high' as CompressionQuality, label: 'Best Fidelity' },
                        ]).map(q => (
                          <button
                            key={q.id}
                            onClick={() => setCompressQuality(q.id)}
                            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                              compressQuality === q.id ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-400 block mb-2">Max Resolution</label>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          { value: 0, label: 'Keep' },
                          { value: 1080, label: '1080p' },
                          { value: 720, label: '720p' },
                          { value: 480, label: '480p' },
                        ]).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setCompressMaxHeight(opt.value)}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              compressMaxHeight === opt.value ? 'bg-white text-black font-bold' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleCompressExport}
                      disabled={isCompressing}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      <RefreshCw size={14} />
                      {isCompressing ? `Compressing… ${Math.round(compressProgress * 100)}%` : 'Compress Video'}
                    </button>

                    {isCompressing && (
                      <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-200"
                          style={{ width: `${Math.round(compressProgress * 100)}%` }}
                        />
                      </div>
                    )}

                    {compressError && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                        {compressError}
                      </div>
                    )}

                    {compressResult && (
                      <div className="p-3 bg-neutral-900/80 border border-white/10 rounded-md space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            Compression complete
                          </span>
                          <span className="font-mono text-neutral-400">{compressResult.extension.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-neutral-300">
                          <span>{formatBytes(videoFile.file.size)}</span>
                          <span className="text-neutral-600">→</span>
                          <span className="text-stone-100">{formatBytes(compressResult.size)}</span>
                          <span
                            className={compressResult.size <= videoFile.file.size ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}
                          >
                            {compressResult.size <= videoFile.file.size
                              ? `−${Math.max(0, Math.round((1 - compressResult.size / videoFile.file.size) * 100))}%`
                              : `+${Math.round((compressResult.size / videoFile.file.size - 1) * 100)}%`}
                          </span>
                        </div>
                        <button
                          onClick={() => downloadBlob(compressResult.blob, `${videoFile.name.replace(/\.[^/.]+$/, '')}-compressed.${compressResult.extension}`)}
                          className="w-full py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download size={14} />
                          Download Compressed Video
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Subtitle Editor ─────────────────────────────────── */}
            {activeTab === 'subtitles' && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-sm font-bold text-white">Subtitle Editor</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Load SRT/WebVTT captions to fix timing and text, then export — 100% local
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => subtitleInputRef.current?.click()}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Upload size={14} />
                    Load .srt / .vtt
                  </button>
                  <input
                    ref={subtitleInputRef}
                    type="file"
                    accept=".srt,.vtt,text/vtt,application/x-subrip"
                    className="hidden"
                    onChange={e => {
                      const picked = e.target.files?.[0];
                      if (picked) void handleSubtitleFile(picked);
                      e.target.value = '';
                    }}
                  />
                  <textarea
                    placeholder="…or paste SRT / WebVTT content here…"
                    value={subtitlePasteText}
                    onChange={e => setSubtitlePasteText(e.target.value)}
                    className="flex-1 min-w-[220px] h-16 bg-neutral-900 border border-white/10 rounded-md p-2.5 text-[11px] text-neutral-300 font-mono resize-none focus:outline-none focus:border-white/20 transition-colors placeholder-neutral-600"
                  />
                  <button
                    onClick={() => {
                      if (subtitlePasteText.trim()) applySubtitleText(subtitlePasteText, 'pasted-subtitles');
                    }}
                    disabled={!subtitlePasteText.trim()}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    Parse Pasted Text
                  </button>
                </div>

                {subtitleError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-400">
                    {subtitleError}
                  </div>
                )}

                {subtitleCues.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400">
                        {subtitleCues.length} cue{subtitleCues.length !== 1 ? 's' : ''} · {subtitleFormat.toUpperCase()} · {subtitleName}
                      </span>
                      <button
                        onClick={() => { setSubtitleCues([]); setSubtitleError(null); }}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} />
                        Clear
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                      {subtitleCues.map((cue, idx) => (
                        <div key={idx} className="p-3 bg-neutral-950/60 border border-white/10 rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-neutral-500">#{idx + 1}</span>
                            <button
                              onClick={() => removeSubtitleCue(idx)}
                              aria-label={`Delete cue ${idx + 1}`}
                              className="text-neutral-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] uppercase tracking-wider text-neutral-500 block mb-1">Start (s)</label>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={cue.start}
                                onChange={e => updateSubtitleCue(idx, { start: Math.max(0, Number(e.target.value)) })}
                                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/20"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] uppercase tracking-wider text-neutral-500 block mb-1">End (s)</label>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={cue.end}
                                onChange={e => updateSubtitleCue(idx, { end: Math.max(0, Number(e.target.value)) })}
                                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/20"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] font-mono text-neutral-600">
                            {formatSubtitleTimestamp(cue.start, subtitleFormat)} → {formatSubtitleTimestamp(cue.end, subtitleFormat)}
                          </p>
                          <textarea
                            rows={2}
                            value={cue.text}
                            onChange={e => updateSubtitleCue(idx, { text: e.target.value })}
                            className="w-full bg-neutral-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-neutral-200 resize-none focus:outline-none focus:border-white/20"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={addSubtitleCue}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Plus size={14} />
                        Add Cue
                      </button>
                      <button
                        onClick={() => handleSubtitleDownload('srt')}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Download size={14} />
                        Export SRT
                      </button>
                      <button
                        onClick={() => handleSubtitleDownload('vtt')}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Download size={14} />
                        Export WebVTT
                      </button>
                      <button
                        onClick={handleSubtitleCopy}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 rounded-[10px] bg-orange-600/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Type size={32} />
                    </div>
                    <div className="max-w-sm">
                      <h2 className="text-base font-bold text-white">Edit Subtitles Locally</h2>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                        Load an SRT or WebVTT file (or paste its contents) to review timing, fix text, add or remove cues, then export. Nothing ever leaves your browser.
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
      <PhotoBook isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} />
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
