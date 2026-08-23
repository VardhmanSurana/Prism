import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Upload,
  X
} from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Adjustments, DEFAULT_BACKGROUND_ADJUSTMENTS, BackgroundAdjustments } from './filterEngine';

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
    { id: 'builtin-u2netp', name: 'U²-Net-p (Built-in Fast)', is_installed: true, license: 'Apache-2.0' },
    { id: 'isnet-general-use', name: 'ISNet (High Quality Universal)', is_installed: false, license: 'Apache-2.0' },
    { id: 'birefnet', name: 'BiRefNet (Bilateral Reference High-Res)', is_installed: false, license: 'MIT' },
    { id: 'rmbg-1.4', name: 'RMBG-1.4 (BRIA Studio Matting)', is_installed: false, license: 'Non-Commercial (BRIA)', gated: true },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefineExpanded, setIsRefineExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch installed packs status
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/packs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.packs)) {
          const models: PackModelStatus[] = [
            { id: 'builtin-u2netp', name: 'U²-Net-p (Built-in Fast)', is_installed: true, license: 'Apache-2.0' },
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
      if (res.ok) {
        // Poll for completion
        const poll = setInterval(async () => {
          try {
            const pRes = await fetch(`${API_BASE}/api/v1/models/progress`);
            if (pRes.ok) {
              const pData = await pRes.json();
              const prog = pData.progress?.[modelId];
              if (prog?.status === 'completed') {
                clearInterval(poll);
                setIsDownloading(null);
                setAvailableModels((prev) =>
                  prev.map((m) => (m.id === modelId ? { ...m, is_installed: true } : m))
                );
              } else if (prog?.status === 'error') {
                clearInterval(poll);
                setIsDownloading(null);
                setError(prog.error_message || 'Download failed');
              }
            }
          } catch {
            clearInterval(poll);
            setIsDownloading(null);
          }
        }, 1000);
      }
    } catch (e: any) {
      setIsDownloading(null);
      setError(e.message || 'Failed to trigger model download');
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

  return (
    <div className="flex flex-col h-full bg-[#121216] text-gray-200 text-xs overflow-y-auto select-none p-4 space-y-5 custom-scrollbar">
      {/* ── Header & Enable Toggle ── */}
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

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={bg.enabled}
            onChange={(e) => updateBg({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* ── Section 1: AI Model Selector & Matte Generation ── */}
      <div className="space-y-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10">
        <label className="text-[11px] font-semibold text-gray-300 flex items-center justify-between">
          <span>AI Matting Model</span>
          {selectedModelDef.license && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
              {selectedModelDef.license}
            </span>
          )}
        </label>

        <select
          value={bg.modelId}
          onChange={(e) => handleSelectModel(e.target.value)}
          className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-2 text-white font-sans text-xs focus:outline-none focus:border-blue-500"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.is_installed ? '✓' : '(Download required)'}
            </option>
          ))}
        </select>

        {/* Model status or download prompt */}
        {!selectedModelDef.is_installed ? (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Download size={13} className="text-amber-400" />
              <span>Model weights not yet installed locally.</span>
            </div>
            <button
              onClick={() => handleDownloadModel(selectedModelDef.id)}
              disabled={isDownloading === selectedModelDef.id}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 shadow"
            >
              {isDownloading === selectedModelDef.id ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Downloading weights...</span>
                </>
              ) : (
                <>
                  <Download size={12} />
                  <span>Download Model Now</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateMask}
            disabled={isGenerating}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 active:scale-98 disabled:opacity-50 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Extracting Subjects & Matting...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
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
            className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
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
            className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              bg.mode === 'keep_bg'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>Keep Background Only</span>
          </button>
        </div>
      </div>

      {/* ── Section 3: Backdrop Replacement ── */}
      <div className="space-y-3 p-3 rounded-xl bg-white/[0.02] border border-white/10">
        <label className="text-[11px] font-semibold text-gray-300 block">Backdrop Type</label>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'transparent', label: 'Alpha', icon: Scissors },
            { id: 'color', label: 'Color', icon: Palette },
            { id: 'blur', label: 'Blur', icon: SlidersHorizontal },
            { id: 'custom', label: 'Image', icon: ImageIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isSel = bg.backdrop === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateBg({ backdrop: item.id as any })}
                className={`py-2 flex flex-col items-center gap-1 rounded-xl border text-[11px] font-medium transition-all ${
                  isSel
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Color Backdrop Swatches & Hex Picker */}
        {bg.backdrop === 'color' && (
          <div className="pt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => updateBg({ backdropColor: swatch.hex })}
                  style={{ backgroundColor: swatch.hex }}
                  className={`w-6 h-6 rounded-full border transition-transform ${
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
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white/80 hover:text-white hover:bg-red-500/80 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] flex flex-col items-center gap-1.5 text-gray-400 hover:text-white transition-all"
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
          className="w-full p-3 flex items-center justify-between text-[11px] font-semibold text-gray-300 hover:text-white transition-colors"
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
              className="w-full py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] text-gray-400 hover:text-white font-mono flex items-center justify-center gap-1 transition-colors"
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
          className="w-full py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <RotateCcw size={13} />
          <span>Reset Cutout & Background</span>
        </button>
      </div>
    </div>
  );
};
