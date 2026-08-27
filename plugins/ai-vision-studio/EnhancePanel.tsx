/**
 * EnhancePanel.tsx
 * AI enhancement: Real-ESRGAN tiled super-resolution and GFPGAN face
 * restoration. Heavy models run through the backend inference slot.
 */

import React from 'react';
import { Maximize, User, Loader2, Sparkles, MessageSquare, Copy, Check } from 'lucide-react';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

export interface EnhanceSettings {
  /** Upscale factor: 2 or 4. */
  scale: 2 | 4;
  /** GFPGAN blend strength 0..1. */
  restoreStrength: number;
}

export type EnhanceAction = 'upscale' | 'face-restore' | 'denoise' | 'caption';

export type CaptionTask = 'caption' | 'detailed' | 'more_detailed';

export interface EnhancePanelProps {
  settings: EnhanceSettings;
  onSettingsChange: (settings: EnhanceSettings) => void;
  onUpscale: () => void;
  onFaceRestore: () => void;
  onDenoise: () => void;
  onCaption?: (task: CaptionTask) => void;
  isProcessing: boolean;
  activeAction: EnhanceAction | null;
  infoMessage?: string | null;
  caption?: string | null;
  captionLoading?: boolean;
}

const SCALE_OPTIONS: Array<{ value: 2 | 4; label: string; hint: string }> = [
  { value: 2, label: '2×', hint: 'Balanced' },
  { value: 4, label: '4×', hint: 'Max detail' },
];

export const EnhancePanel: React.FC<EnhancePanelProps> = ({
  settings,
  onSettingsChange,
  onUpscale,
  onFaceRestore,
  onDenoise,
  onCaption,
  isProcessing,
  activeAction,
  infoMessage,
  caption,
  captionLoading,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCaption = async () => {
    if (caption) {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="pb-6">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1">
          AI Enhance
        </p>
        <p className="text-[11px] text-white/35 leading-snug">
          Neural super-resolution and blind face restoration.
        </p>
      </div>

      {/* ── Upscale ── */}
      <div className="px-5 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
          Super Resolution
        </p>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {SCALE_OPTIONS.map(opt => {
            const isActive = settings.scale === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSettingsChange({ ...settings, scale: opt.value })}
                disabled={isProcessing}
                className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all select-none cursor-pointer ${
                  isActive
                    ? 'bg-white text-black border-white shadow-[0_2px_12px_rgba(255,255,255,0.12)]'
                    : 'bg-white/[0.03] border-white/10 text-white/90 hover:bg-white/[0.07] hover:border-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}
              >
                <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-black' : 'text-white'}`}>
                  {opt.label}
                </span>
                <span className={`text-[9px] uppercase tracking-wider font-semibold mt-0.5 ${isActive ? 'text-black/55' : 'text-white/35'}`}>
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onUpscale}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all bg-primary text-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && activeAction === 'upscale' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Maximize size={14} />
          )}
          {isProcessing && activeAction === 'upscale' ? 'Upscaling…' : `Upscale ${settings.scale}×`}
        </button>
        <p className="mt-2 text-[11px] text-white/25 leading-snug">
          Tiled Real-ESRGAN — large photos stay within VRAM budget. Rewrites the photo file.
        </p>
      </div>

      {/* ── Face Restore ── */}
      <div className="px-5 pb-4 border-t border-white/5 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
          Face Restoration
        </p>
        <div className="mb-4">
          <EditorSlider
            label="Restore Strength"
            value={Math.round(settings.restoreStrength * 100)}
            onChange={val => onSettingsChange({ ...settings, restoreStrength: val / 100 })}
            min={0}
            max={100}
            step={5}
            defaultValue={100}
            unit="%"
            disabled={isProcessing}
          />
        </div>
        <button
          onClick={onFaceRestore}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && activeAction === 'face-restore' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <User size={14} />
          )}
          {isProcessing && activeAction === 'face-restore' ? 'Restoring…' : 'Restore Faces'}
        </button>
        <p className="mt-2 text-[11px] text-white/25 leading-snug">
          Detects faces (SCRFD), restores each crop with GFPGAN v1.4, blends back seamlessly.
        </p>
      </div>

      {/* ── Denoise ── */}
      <div className="px-5 pb-4 border-t border-white/5 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
          Blind Denoise
        </p>
        <button
          onClick={onDenoise}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && activeAction === 'denoise' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {isProcessing && activeAction === 'denoise' ? 'Denoising…' : 'Denoise Image'}
        </button>
        <p className="mt-2 text-[11px] text-white/25 leading-snug">
          SCUNet blind denoising — removes Gaussian, JPEG, and sensor noise without knowing the noise level.
        </p>
      </div>

      {/* ── AI Caption (Florence-2) ── */}
      {onCaption && (
        <div className="px-5 pb-4 border-t border-white/5 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
            AI Caption
          </p>

          {/* Caption output display */}
          {caption && (
            <div className="mb-3 relative group">
              <div className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03]">
                <p className="text-[12px] text-white/70 leading-relaxed">
                  {caption}
                </p>
              </div>
              <button
                onClick={handleCopyCaption}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all opacity-0 group-hover:opacity-100"
                title="Copy caption"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          )}

          {/* Task selector + generate button */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {([
              { value: 'caption' as CaptionTask, label: 'Brief', hint: 'Quick' },
              { value: 'detailed' as CaptionTask, label: 'Detailed', hint: 'Balanced' },
              { value: 'more_detailed' as CaptionTask, label: 'Full', hint: 'Thorough' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => onCaption(opt.value)}
                disabled={isProcessing || captionLoading}
                className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-white/90 hover:bg-white/[0.07] hover:border-white/20 transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <span className="text-[11px] font-bold text-white tracking-tight">{opt.label}</span>
                <span className="text-[8px] uppercase tracking-wider font-semibold text-white/40 mt-0.5">
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/25 leading-snug">
            Florence-2 vision-language model — generates descriptive captions for search and organization.
          </p>
        </div>
      )}

      {/* ── Info ── */}
      {infoMessage && (
        <div className="mx-5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03]">
          <p className="text-[11px] text-white/45 leading-snug">{infoMessage}</p>
        </div>
      )}
    </div>
  );
};
