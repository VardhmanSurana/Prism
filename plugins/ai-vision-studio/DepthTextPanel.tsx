/**
 * DepthTextPanel.tsx
 * Control panel for 3D Depth Typography (Text Behind Subject).
 * Integrates SAM (Segment Anything Model) and AI matting to composite typography
 * between background and foreground subjects with dual-pass front-stroke effects.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Type,
  Layers,
  Sliders,
  Check,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Scissors,
  Eye,
  Loader2,
  Wand2,
  Palette,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import {
  Adjustments,
  DepthTextSettings,
  DEFAULT_DEPTH_TEXT_SETTINGS,
  DEPTH_TEXT_PRESETS,
  DepthTextPreset,
} from '@/components/Editor/ImageEditor/filterEngine';

interface DepthTextPanelProps {
  photoId?: string | number;
  photoUrl: string;
  adjustments: Adjustments;
  onChange: (adjustments: Adjustments) => void;
  onResetTool?: () => void;
}

const FONT_OPTIONS = [
  { id: 'Anton', name: 'Anton (Ultra Bold Poster)' },
  { id: 'Bebas Neue', name: 'Bebas Neue (Tall Condensed)' },
  { id: 'Space Grotesk', name: 'Space Grotesk (Modern Tech)' },
  { id: 'Montserrat', name: 'Montserrat (Clean Geometric)' },
  { id: 'Playfair Display', name: 'Playfair Display (Editorial Serif)' },
  { id: 'Cinzel', name: 'Cinzel (Cinematic Classical)' },
  { id: 'Impact', name: 'Impact (Heavy Solid)' },
  { id: 'Arial', name: 'Arial (Neutral Sans)' },
];

const PRESET_COLORS = [
  '#ffffff',
  '#22c55e',
  '#06b6d4',
  '#ec4899',
  '#fbbf24',
  '#ef4444',
  '#a855f7',
  '#64748b',
  '#000000',
];

export const DepthTextPanel: React.FC<DepthTextPanelProps> = ({
  photoId,
  photoUrl,
  adjustments,
  onChange,
  onResetTool,
}) => {
  const depthText = adjustments.depthText || DEFAULT_DEPTH_TEXT_SETTINGS;
  const isEnabled = depthText.enabled;

  const [isDetectingSubject, setIsDetectingSubject] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateDepthText = useCallback(
    (patch: Partial<DepthTextSettings>) => {
      const updated: DepthTextSettings = {
        ...depthText,
        ...patch,
      };
      onChange({
        ...adjustments,
        depthText: updated,
      });
    },
    [adjustments, depthText, onChange]
  );

  // Apply a preset
  const handleApplyPreset = (preset: DepthTextPreset) => {
    updateDepthText({
      ...preset.settings,
      enabled: true,
    });
  };

  // 1-Click Auto-Detect Subject using AI Matting
  const handleAutoDetectSubject = async () => {
    if (!photoId) {
      setErrorMessage('Photo ID not available for AI segmentation');
      return;
    }

    setIsDetectingSubject(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // First check if background-mask is available via local segmentation engine
      const res = await fetch(`${API_BASE}/api/v1/photos/background-mask/${photoId}?model=isnet-general-use`);
      if (res.ok) {
        const maskBlob = await res.blob();
        const maskDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(maskBlob);
        });

        updateDepthText({
          enabled: true,
          maskSource: 'auto',
          maskData: maskDataUrl,
        });
        setSuccessMessage('✓ Subject detected & isolated!');
      } else {
        // Fallback to built-in fast matting
        const fallbackRes = await fetch(`${API_BASE}/api/v1/photos/background-mask/${photoId}?model=builtin-u2netp`);
        if (fallbackRes.ok) {
          const maskBlob = await fallbackRes.blob();
          const maskDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(maskBlob);
          });

          updateDepthText({
            enabled: true,
            maskSource: 'auto',
            maskData: maskDataUrl,
          });
          setSuccessMessage('✓ Subject detected & isolated!');
        } else {
          setErrorMessage('Could not extract subject mask automatically. Please try SAM selector.');
        }
      }
    } catch (err: any) {
      console.error('Auto detect subject failed:', err);
      setErrorMessage(err.message || 'Failed to communicate with AI segmentation server');
    } finally {
      setIsDetectingSubject(false);
    }
  };

  // Interactive SAM Center Subject Selection
  const handleSamSelectCenter = async () => {
    if (!photoId) {
      setErrorMessage('Photo ID required for SAM');
      return;
    }

    setIsDetectingSubject(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/sam/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: photoId,
          points: [
            { x: 0.5, y: 0.45, positive: true },
            { x: 0.5, y: 0.65, positive: true },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.mask_data) {
          updateDepthText({
            enabled: true,
            maskSource: 'sam',
            maskData: data.mask_data,
          });
          setSuccessMessage('✓ SAM subject segmentation complete!');
        } else {
          setErrorMessage(data.error || 'SAM segmentation was unable to find subject');
        }
      } else {
        setErrorMessage('SAM service unavailable on backend');
      }
    } catch (err: any) {
      console.error('SAM request failed:', err);
      setErrorMessage('Failed to run MobileSAM segmentation');
    } finally {
      setIsDetectingSubject(false);
    }
  };

  const hasMask = Boolean(depthText.maskData || depthText.maskUrl || adjustments.background?.maskUrl);

  return (
    <div className="flex flex-col h-full bg-[#12141a] text-white p-4 space-y-5 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Type size={15} className="text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Depth Typography</h3>
            <p className="text-[10px] text-white/40">3D Text Behind Subject</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onResetTool && (
            <button
              type="button"
              onClick={onResetTool}
              title="Reset depth text"
              className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => updateDepthText({ enabled: !isEnabled })}
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isEnabled
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {isEnabled ? 'Enabled' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Preset Styles Carousel / Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-1.5">
            <Sparkles size={11} className="text-amber-400" />
            Style Presets
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEPTH_TEXT_PRESETS.map((preset) => {
            const isPresetActive = depthText.fontFamily === preset.settings.fontFamily && depthText.strokeColor === preset.settings.strokeColor;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between h-20 ${
                  isPresetActive
                    ? 'bg-white/10 border-blue-500 ring-1 ring-blue-500 shadow-md shadow-black/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                }`}
              >
                <div>
                  <p className="text-[11px] font-bold text-white truncate">{preset.name}</p>
                  <p className="text-[9px] text-white/40 line-clamp-2 mt-0.5 leading-tight">{preset.description}</p>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div
                    className="w-3 h-3 rounded-full border border-black/40 shadow-sm"
                    style={{ backgroundColor: preset.settings.fillColor || '#fff' }}
                  />
                  {preset.settings.strokeEnabled && (
                    <div
                      className="w-3 h-3 rounded-full border-2 border-black/40 shadow-sm"
                      style={{ borderColor: preset.settings.strokeColor || '#22c55e', backgroundColor: 'transparent' }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject Isolation Stage */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Scissors size={13} className="text-blue-400" />
            <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
              Subject Isolation (Mask)
            </span>
          </div>
          <span
            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
              hasMask ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {hasMask ? 'Subject Ready' : 'Mask Needed'}
          </span>
        </div>

        <p className="text-[10px] text-white/50 leading-relaxed">
          To sandwich text behind the person, Prism cuts out the foreground subject using local AI matting.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={isDetectingSubject}
            onClick={handleAutoDetectSubject}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
          >
            {isDetectingSubject ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            Auto-Detect
          </button>

          <button
            type="button"
            disabled={isDetectingSubject}
            onClick={handleSamSelectCenter}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-all active:scale-95"
          >
            <Crosshair size={13} className="text-cyan-400" />
            MobileSAM
          </button>
        </div>

        {errorMessage && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-center gap-1.5">
            <ShieldAlert size={12} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] flex items-center gap-1.5">
            <Check size={12} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Text Content Input */}
      <div className="space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-widest text-white/50 block">Text Content</label>
        <textarea
          rows={3}
          value={depthText.text}
          onChange={(e) => updateDepthText({ text: e.target.value, enabled: true })}
          placeholder="Enter typography (multi-line supported)..."
          className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors font-mono resize-y"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateDepthText({ textTransform: 'uppercase' })}
            className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
              depthText.textTransform === 'uppercase'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            UPPERCASE
          </button>
          <button
            type="button"
            onClick={() => updateDepthText({ textTransform: 'none' })}
            className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
              depthText.textTransform === 'none'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            Normal
          </button>
        </div>
      </div>

      {/* Typography Configuration */}
      <div className="space-y-4 pt-2">
        {/* Font Family */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-white/50 block">Font Family</label>
          <select
            value={depthText.fontFamily}
            onChange={(e) => updateDepthText({ fontFamily: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} className="bg-[#18181b] text-white">
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/60 font-medium">Font Size</span>
            <span className="text-white/40 font-mono">{depthText.fontSize}px</span>
          </div>
          <input
            type="range"
            min={30}
            max={220}
            value={depthText.fontSize}
            onChange={(e) => updateDepthText({ fontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Letter Spacing / Tracking Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/60 font-medium">Letter Spacing (Tracking)</span>
            <span className="text-white/40 font-mono">{depthText.letterSpacing}px</span>
          </div>
          <input
            type="range"
            min={-5}
            max={30}
            value={depthText.letterSpacing}
            onChange={(e) => updateDepthText({ letterSpacing: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Line Height Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/60 font-medium">Line Height</span>
            <span className="text-white/40 font-mono">{depthText.lineHeight.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.6}
            step={0.02}
            value={depthText.lineHeight}
            onChange={(e) => updateDepthText({ lineHeight: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Text Alignment */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-white/60 font-medium">Alignment</span>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => updateDepthText({ textAlign: align })}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  depthText.textAlign === align ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {align === 'left' && <AlignLeft size={13} />}
                {align === 'center' && <AlignCenter size={13} />}
                {align === 'right' && <AlignRight size={13} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solid Fill Color (Behind Subject) */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest flex items-center gap-1.5">
            <Palette size={12} className="text-purple-400" />
            Behind Fill Color
          </span>
          <span className="text-[10px] text-white/40 font-mono">{depthText.fillOpacity}% opacity</span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateDepthText({ fillColor: c })}
              className={`h-7 rounded-full border transition-all cursor-pointer ${
                depthText.fillColor.toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-blue-500 scale-105 border-white shadow-md'
                  : 'border-white/10 hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="color"
            value={depthText.fillColor}
            onChange={(e) => updateDepthText({ fillColor: e.target.value })}
            className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer p-0"
          />
          <input
            type="text"
            value={depthText.fillColor}
            onChange={(e) => updateDepthText({ fillColor: e.target.value })}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono text-white"
          />
        </div>

        <div className="space-y-1 pt-1">
          <span className="text-[10px] text-white/60 font-medium">Fill Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={depthText.fillOpacity}
            onChange={(e) => updateDepthText({ fillOpacity: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Front-Layer Outline / Holographic Stroke */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-400" />
            <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
              Front Outline / Stroke
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateDepthText({ strokeEnabled: !depthText.strokeEnabled })}
            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer transition-colors ${
              depthText.strokeEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40'
            }`}
          >
            {depthText.strokeEnabled ? 'Active' : 'Off'}
          </button>
        </div>

        {depthText.strokeEnabled && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <span className="text-[10px] text-white/60 font-medium">Stroke Placement</span>
              <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                {(['front', 'behind', 'both'] as const).map((placement) => (
                  <button
                    key={placement}
                    type="button"
                    onClick={() => updateDepthText({ strokePlacement: placement })}
                    className={`py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      depthText.strokePlacement === placement ? 'bg-emerald-600 text-white' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {placement}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-white/60 font-medium">Stroke Color</span>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateDepthText({ strokeColor: c })}
                    className={`h-6 rounded-full border transition-all cursor-pointer ${
                      depthText.strokeColor.toLowerCase() === c.toLowerCase()
                        ? 'ring-2 ring-emerald-500 scale-105 border-white shadow-md'
                        : 'border-white/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/60 font-medium">Stroke Width</span>
                <span className="text-white/40 font-mono">{depthText.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={depthText.strokeWidth}
                onChange={(e) => updateDepthText({ strokeWidth: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Position & Alignment Sliders */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
        <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest block">
          Position & Placement
        </span>

        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/60 font-medium">Vertical Position (Y)</span>
              <span className="text-white/40 font-mono">{depthText.y}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={depthText.y}
              onChange={(e) => updateDepthText({ y: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/60 font-medium">Horizontal Position (X)</span>
              <span className="text-white/40 font-mono">{depthText.x}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={depthText.x}
              onChange={(e) => updateDepthText({ x: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/60 font-medium">Rotation</span>
              <span className="text-white/40 font-mono">{depthText.rotation}°</span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              value={depthText.rotation}
              onChange={(e) => updateDepthText({ rotation: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
