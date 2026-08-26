import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Image as ImageIcon, 
  Palette, 
  Eye, 
  RotateCcw, 
  Check, 
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Upload,
  X
} from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Adjustments, DEFAULT_BACKGROUND_ADJUSTMENTS, BackgroundAdjustments } from '@/components/Editor/ImageEditor/filterEngine';

interface BackgroundPanelProps {
  photoId: string | number;
  photoUrl: string;
  adjustments: Adjustments;
  onChange: (adjustments: Adjustments) => void;
  onResetTool?: () => void;
}

interface PackModelStatus {
  id: string;
  name: string;
  description?: string;
  is_installed: boolean;
  license?: string;
  gated?: boolean;
}

interface ModelProgress {
  model_id: string;
  status: 'downloading' | 'completed' | 'error';
  bytes_downloaded: number;
  total_bytes: number;
  download_speed_bps: number;
  progress_percent: number;
  elapsed_seconds: number;
  eta_seconds?: number | null;
  error_message?: string | null;
}

const COLOR_SWATCHES = [
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Studio Dark', hex: '#18181B' },
  { name: 'Neutral Gray', hex: '#64748B' },
  { name: 'Sky Cyan', hex: '#0EA5E9' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Sunset Amber', hex: '#F59E0B' },
  { name: 'Rose Pink', hex: '#F43F5E' },
  { name: 'Deep Indigo', hex: '#6366F1' },
];

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({
  photoId,
  photoUrl,
  adjustments,
  onChange,
  onResetTool,
}) => {
  const bg = adjustments.background || DEFAULT_BACKGROUND_ADJUSTMENTS;

  const [availableModels, setAvailableModels] = useState<PackModelStatus[]>([
    { id: 'builtin-u2netp', name: 'U²-Net-p (Built-in Fast)', is_installed: true, license: 'Apache-2.0', description: 'Fast on-device matting' },
    { id: 'isnet-general-use', name: 'ISNet (High Quality Universal)', is_installed: false, license: 'Apache-2.0', description: '1024px high-res subject extraction' },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ModelProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [isRefineExpanded, setIsRefineExpanded] = useState(true);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bps: number): string => {
    if (!bps || bps <= 0) return '0 B/s';
    return `${formatBytes(bps)}/s`;
  };

  // Fetch installed packs status
  const refreshModels = useCallback(() => {
    fetch(`${API_BASE}/api/v1/packs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.packs)) {
          const models: PackModelStatus[] = [
            { id: 'builtin-u2netp', name: 'U²-Net-p (Built-in Fast)', is_installed: true, license: 'Apache-2.0', description: 'Fast on-device matting' },
          ];
          for (const pack of data.packs) {
            for (const m of pack.models) {
              models.push({
                id: m.id,
                name: m.name,
                description: m.description,
                is_installed: m.is_installed,
                license: m.license,
                gated: m.gated,
              });
            }
          }
          setAvailableModels(models);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  // Live telemetry polling when downloading
  useEffect(() => {
    if (!isDownloading) return;

    const poll = setInterval(async () => {
      try {
        const pRes = await fetch(`${API_BASE}/api/v1/models/progress`);
        if (pRes.ok) {
          const pData = await pRes.json();
          const map: Record<string, ModelProgress> = pData.progress || {};
          setProgressMap(map);

          const prog = map[isDownloading];
          if (prog?.status === 'completed') {
            setIsDownloading(null);
            refreshModels();
          } else if (prog?.status === 'error') {
            setIsDownloading(null);
            setError(prog.error_message || 'Download failed');
          }
        }
      } catch {
        // Continue polling
      }
    }, 350);

    return () => clearInterval(poll);
  }, [isDownloading, refreshModels]);

  const updateBg = (partial: Partial<BackgroundAdjustments>) => {
    const updated: BackgroundAdjustments = {
      ...bg,
      ...partial,
      enabled: true,
    };
    onChange({ ...adjustments, background: updated });
  };

  const handleSelectModel = (modelId: string) => {
    updateBg({ modelId, maskUrl: null });
  };

  const handleGenerateMask = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const modelQuery = bg.modelId && bg.modelId !== 'builtin-u2netp' ? `?model=${encodeURIComponent(bg.modelId)}` : '';
      const res = await fetch(`${API_BASE}/api/v1/photos/background-mask/${photoId}${modelQuery}`);
      
      if (res.status === 409) {
        throw new Error(`Model weights not installed on disk. Please download ${bg.modelId} first.`);
      }

      if (!res.ok) {
        throw new Error(`Failed to generate background mask (${res.status})`);
      }

      const data = await res.json();
      if (data.mask_url) {
        updateBg({ maskUrl: data.mask_url, enabled: true });
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error('Mask generation error:', e);
      setError(e.message || 'Background extraction failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadModel = async (modelId: string) => {
    setIsDownloading(modelId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/models/download/${modelId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Download request failed (${res.status})`);
      }
    } catch (e: any) {
      setIsDownloading(null);
      setError(e.message || 'Failed to trigger model download');
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/models/cancel/${modelId}`, { method: 'POST' });
      setIsDownloading(null);
      setProgressMap((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
    } catch (e: any) {
      console.error('Failed to cancel download:', e);
    }
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateBg({ backdrop: 'custom', customImageSrc: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedModelDef = availableModels.find((m) => m.id === bg.modelId) || availableModels[0];
  const currentModelProgress = selectedModelDef ? progressMap[selectedModelDef.id] : undefined;

  return (
    <div className="flex flex-col h-full bg-[#121216] text-gray-200 text-xs overflow-y-auto select-none p-4 space-y-5 custom-scrollbar">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Scissors size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-tight text-sm">Cutout & Background</h3>
            <p className="text-[10px] text-gray-400">AI subject extraction & backdrop synthesis</p>
          </div>
        </div>

        {onResetTool && (bg.enabled || bg.maskUrl) && (
          <button
            onClick={onResetTool}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="Reset Background"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span className="leading-snug">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 p-0.5 cursor-pointer"
            title="Dismiss error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Section 1: AI Model Selector & Matte Generation ── */}
      <div className="p-3.5 rounded-2xl bg-[#171922] border border-white/10 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-gray-200 flex items-center gap-1.5">
            <Sparkles size={12} className="text-blue-400" />
            <span>AI Matting Model</span>
          </label>
          <div className="flex items-center gap-1.5">
            {selectedModelDef.license && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                {selectedModelDef.license}
              </span>
            )}
            {selectedModelDef.is_installed ? (
              <span className="text-[9.5px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Check size={9} /> Ready
              </span>
            ) : (
              <span className="text-[9.5px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Download Required
              </span>
            )}
          </div>
        </div>

        {/* Custom Bespoke Model Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="w-full bg-[#11131a] hover:bg-[#151822] border border-white/15 hover:border-white/25 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white font-sans text-xs flex items-center justify-between transition-all cursor-pointer shadow-inner"
          >
            <span className="font-medium text-white truncate text-left">{selectedModelDef.name}</span>
            <ChevronDown
              size={14}
              className={`text-gray-400 shrink-0 ml-2 transition-transform duration-200 ${
                isModelDropdownOpen ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-[#14161f] border border-white/15 shadow-2xl space-y-1 backdrop-blur-xl">
              {availableModels.map((m) => {
                const isSelected = m.id === bg.modelId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      handleSelectModel(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 truncate pr-2">
                      <span className="truncate">{m.name}</span>
                      {m.description && (
                        <span className="text-[10px] text-gray-400 font-normal truncate">{m.description}</span>
                      )}
                    </div>
                    {m.is_installed ? (
                      <span className="shrink-0 text-[9.5px] text-emerald-400 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        Ready
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9.5px] text-cyan-400 font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                        Install
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Model Status / Download Progress / Action */}
        {!selectedModelDef.is_installed ? (
          <div className="p-3 rounded-xl bg-gradient-to-b from-blue-950/20 via-[#11131a] to-[#11131a] border border-blue-500/20 text-gray-200 space-y-3">
            {isDownloading === selectedModelDef.id ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-cyan-300">
                    <RefreshCw size={12} className="animate-spin text-cyan-400" />
                    <span>Downloading model weights...</span>
                  </div>
                  <span className="font-mono text-cyan-300 font-bold text-xs">
                    {(currentModelProgress?.progress_percent || 0).toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(4, currentModelProgress?.progress_percent || 0)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                  <span>
                    {currentModelProgress?.bytes_downloaded
                      ? `${formatBytes(currentModelProgress.bytes_downloaded)} / ${formatBytes(currentModelProgress.total_bytes)}`
                      : 'Connecting to CDN...'}
                  </span>
                  <span>{formatSpeed(currentModelProgress?.download_speed_bps || 0)}</span>
                  <button
                    type="button"
                    onClick={() => handleCancelDownload(selectedModelDef.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 text-[11px] text-gray-300 leading-relaxed">
                  <Download size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  <span>
                    Model weights not yet installed locally. High-precision neural inference weights required.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadModel(selectedModelDef.id)}
                  className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download Model Now</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerateMask}
            disabled={isGenerating}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={13} className="animate-spin text-white" />
                <span>Extracting Subjects & Matting...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-blue-200" />
                <span>{bg.maskUrl ? 'Recompute AI Matte' : 'Extract Subject / Cutout'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Section 2: Cutout Mode (Remove vs Keep BG) ── */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-gray-300 block">Segmentation Target</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateBg({ mode: 'remove_bg' })}
            className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              bg.mode === 'remove_bg'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Scissors size={13} />
            <span>Remove Background</span>
          </button>

          <button
            type="button"
            onClick={() => updateBg({ mode: 'keep_bg' })}
            className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              bg.mode === 'keep_bg'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Eye size={13} />
            <span>Extract Background</span>
          </button>
        </div>
      </div>

      {/* ── Section 3: Backdrop Replacement Options ── */}
      <div className="space-y-3">
        <label className="text-[11px] font-semibold text-gray-300 block">Backdrop Composite</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'transparent', label: 'Transparent', icon: Layers },
            { id: 'color', label: 'Solid Color', icon: Palette },
            { id: 'blur', label: 'Original Blur', icon: SlidersHorizontal },
            { id: 'custom', label: 'Custom Image', icon: ImageIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = bg.backdrop === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateBg({ backdrop: item.id as any })}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Solid Color Palette Picker */}
        {bg.backdrop === 'color' && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Preset Colors</span>
              <span className="font-mono text-white text-[10px]">{bg.backdropColor || '#FFFFFF'}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => updateBg({ backdropColor: swatch.hex })}
                  style={{ backgroundColor: swatch.hex }}
                  className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                    bg.backdropColor === swatch.hex
                      ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-[#121216] border-white'
                      : 'border-white/20 hover:scale-105'
                  }`}
                  title={swatch.name}
                />
              ))}
              <input
                type="color"
                value={bg.backdropColor || '#FFFFFF'}
                onChange={(e) => updateBg({ backdropColor: e.target.value })}
                className="w-6 h-6 rounded-full bg-transparent border-0 cursor-pointer p-0"
                title="Custom color"
              />
            </div>
          </div>
        )}

        {/* Blur Original Background Slider */}
        {bg.backdrop === 'blur' && (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Background Blur Intensity</span>
              <span className="font-mono text-white font-medium">{bg.blurRadius ?? 20}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={bg.blurRadius ?? 20}
              onChange={(e) => updateBg({ blurRadius: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        )}

        {/* Custom Background Image Uploader */}
        {bg.backdrop === 'custom' && (
          <div className="pt-2 space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomImageUpload}
              accept="image/*"
              className="hidden"
            />
            {bg.customImageSrc ? (
              <div className="relative rounded-xl border border-white/15 overflow-hidden group">
                <img
                  src={bg.customImageSrc}
                  alt="Custom Backdrop"
                  className="w-full h-20 object-cover"
                />
                <button
                  type="button"
                  onClick={() => updateBg({ customImageSrc: null })}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white/80 hover:text-white hover:bg-red-500/80 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] flex flex-col items-center gap-1.5 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <Upload size={16} />
                <span className="text-[11px] font-medium">Upload Backdrop Image</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4: Refine Edge & Hair Detail Accordion ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsRefineExpanded(!isRefineExpanded)}
          className="w-full p-3 flex items-center justify-between text-[11px] font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-blue-400" />
            <span>Edge Refinement & Hair Detail</span>
          </div>
          {isRefineExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isRefineExpanded && (
          <div className="p-3 pt-1 space-y-3.5 border-t border-white/5">
            {/* Feather */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Feather (Gaussian Softness)</span>
                <span className="font-mono text-white">{bg.refine.feather}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bg.refine.feather}
                onChange={(e) =>
                  updateBg({ refine: { ...bg.refine, feather: parseInt(e.target.value, 10) } })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Smooth */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Smooth Edge Contour</span>
                <span className="font-mono text-white">{bg.refine.smooth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={bg.refine.smooth}
                onChange={(e) =>
                  updateBg({ refine: { ...bg.refine, smooth: parseInt(e.target.value, 10) } })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Shift Edge (Expand / Contract) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Shift Edge (Expand / Erode)</span>
                <span className="font-mono text-white">
                  {bg.refine.shiftEdge > 0 ? `+${bg.refine.shiftEdge}` : bg.refine.shiftEdge}px
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={bg.refine.shiftEdge}
                onChange={(e) =>
                  updateBg({ refine: { ...bg.refine, shiftEdge: parseInt(e.target.value, 10) } })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Edge Contrast (Threshold Hardness)</span>
                <span className="font-mono text-white">{bg.refine.contrast}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={bg.refine.contrast}
                onChange={(e) =>
                  updateBg({ refine: { ...bg.refine, contrast: parseInt(e.target.value, 10) } })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                updateBg({
                  refine: { feather: 0, smooth: 0, shiftEdge: 0, contrast: 0 },
                })
              }
              className="w-full py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] text-gray-400 hover:text-white font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Reset Edge Sliders</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Section 5: Reset All ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => (onResetTool ? onResetTool() : onChange({ ...adjustments, background: { ...DEFAULT_BACKGROUND_ADJUSTMENTS } }))}
          className="w-full py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Reset Cutout & Background</span>
        </button>
      </div>
    </div>
  );
};
