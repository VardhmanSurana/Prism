/**
 * RawEnginePanel.tsx
 * Professional Camera RAW Studio control panel for Prism.
 * Features:
 *  - Planckian Locus White Balance (2000K – 20000K Kelvin & Green/Magenta Tint).
 *  - Standard WB Presets (Daylight, Cloudy, Shade, Tungsten, Fluorescent, Flash, As Shot).
 *  - Logarithmic Linear Sensor Exposure (-5.0 EV to +5.0 EV).
 *  - Highlight Recovery & Shadow Dynamic Range Boost.
 *  - Sensor CFA Demosaicing Algorithm selection (AMaZE, AHD, RCD).
 *  - Wavelet Luminance and Chrominance Noise Reduction.
 *  - Camera / Lens EXIF metadata inspector card.
 */

import React, { useState, useEffect } from 'react';
import {
  RawSettings,
  DEFAULT_RAW_SETTINGS,
  DemosaicAlgorithm,
  RawWhitebalancePreset,
  WB_PRESET_MAP,
} from './rawEngine';
import {
  Sun,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Info,
  Sliders,
} from 'lucide-react';
import { API_BASE } from '@/constants';
import { EditorSlider } from './ui/EditorSlider';

interface RawEnginePanelProps {
  settings?: RawSettings;
  onChange: (s: RawSettings) => void;
  photoId?: number | string;
  imageSrc?: string;
}

interface PhotoMetadata {
  camera_make?: string;
  camera_model?: string;
  exif_make?: string;
  exif_model?: string;
  lens_model?: string;
  iso?: number;
  exif_iso?: number;
  f_number?: number;
  exposure_time?: string;
  focal_length?: number;
  exif_focal_length?: number;
  color_space?: string;
}

export const RawEnginePanel: React.FC<RawEnginePanelProps> = ({
  settings = DEFAULT_RAW_SETTINGS,
  onChange,
  photoId,
}) => {
  const [metadata, setMetadata] = useState<PhotoMetadata | null>(null);
  const [openSections, setOpenSections] = useState({
    wb: true,
    exposure: true,
    details: true,
    info: true,
  });

  const update = (patch: Partial<RawSettings>) => {
    onChange({
      ...settings,
      enabled: true,
      ...patch,
    });
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch camera/sensor metadata if available
  useEffect(() => {
    if (!photoId) return;
    fetch(`${API_BASE}/api/v1/photos/${photoId}/metadata`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setMetadata(data);
      })
      .catch(() => {});
  }, [photoId]);

  const handlePresetSelect = (preset: RawWhitebalancePreset) => {
    if (preset === 'custom') {
      update({ wbPreset: 'custom' });
      return;
    }
    const mapped = WB_PRESET_MAP[preset];
    if (mapped) {
      update({
        wbPreset: preset,
        kelvin: mapped.kelvin,
        tint: mapped.tint,
      });
    }
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_RAW_SETTINGS });
  };

  const isChanged =
    settings.kelvin !== DEFAULT_RAW_SETTINGS.kelvin ||
    settings.tint !== DEFAULT_RAW_SETTINGS.tint ||
    settings.exposure !== DEFAULT_RAW_SETTINGS.exposure ||
    settings.highlightRecovery !== DEFAULT_RAW_SETTINGS.highlightRecovery ||
    settings.shadowBoost !== DEFAULT_RAW_SETTINGS.shadowBoost ||
    settings.whites !== DEFAULT_RAW_SETTINGS.whites ||
    settings.blacks !== DEFAULT_RAW_SETTINGS.blacks ||
    settings.denoiseAi !== DEFAULT_RAW_SETTINGS.denoiseAi ||
    settings.chromaDenoise !== DEFAULT_RAW_SETTINGS.chromaDenoise ||
    settings.rawClarity !== DEFAULT_RAW_SETTINGS.rawClarity ||
    settings.algorithm !== DEFAULT_RAW_SETTINGS.algorithm;

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white p-4 space-y-4 select-none">
      {/* ── Sub-header & Reset ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          16-bit Sensor Pipeline
        </span>

        {isChanged && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Reset RAW development"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* ── Camera & Sensor Info Badge ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-2">
        <div
          onClick={() => toggleSection('info')}
          className="flex items-center justify-between cursor-pointer group/info"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 group-hover/info:text-white/80">
            <Info size={11} className="text-primary" />
            <span>Camera & Sensor Profile</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform ${
              openSections.info ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.info && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-[10px] animate-in fade-in duration-150">
            <div>
              <span className="text-white/30 block text-[9px]">Camera Model</span>
              <span className="font-semibold text-white/80 truncate block">
                {metadata?.camera_make || metadata?.camera_model
                  ? `${metadata.camera_make || ''} ${metadata.camera_model || ''}`.trim()
                  : metadata?.exif_make || metadata?.exif_model
                  ? `${metadata.exif_make || ''} ${metadata.exif_model || ''}`.trim()
                  : 'Digital Sensor (CFA)'}
              </span>
            </div>
            <div>
              <span className="text-white/30 block text-[9px]">Lens</span>
              <span className="font-semibold text-white/80 truncate block">
                {metadata?.lens_model
                  ? metadata.lens_model
                  : metadata?.focal_length || metadata?.exif_focal_length
                  ? `${Math.round(metadata.focal_length || metadata.exif_focal_length!)}mm Prime`
                  : 'Primary Sensor'}
              </span>
            </div>
            <div>
              <span className="text-white/30 block text-[9px]">Exposure</span>
              <span className="font-mono text-primary font-bold">
                {metadata?.exposure_time ? `${metadata.exposure_time}s` : '1/250s'}
                {metadata?.f_number ? ` • ƒ/${metadata.f_number}` : ' • ƒ/2.8'}
              </span>
            </div>
            <div>
              <span className="text-white/30 block text-[9px]">ISO / Profile</span>
              <span className="font-mono text-white/70">
                ISO {metadata?.iso ?? metadata?.exif_iso ?? 100} • Linear RAW
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 1. White Balance (Planckian Locus Kelvin & Tint) ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('wb')}
          className="w-full flex items-center justify-between p-3 cursor-pointer group/sec text-left"
        >
          <div className="flex items-center gap-2">
            <Sun size={12} className="text-amber-400" />
            <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
              White Balance (Kelvin)
            </span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 group-hover/sec:text-white/60 transition-transform ${
              openSections.wb ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {openSections.wb && (
          <div className="px-3 pb-3.5 space-y-4 border-t border-white/5 pt-3 animate-in fade-in duration-150">
            {/* WB Preset Pills */}
            <div className="grid grid-cols-2 gap-1.5">
              {(['as_shot', 'daylight', 'cloudy', 'shade', 'tungsten', 'fluorescent', 'flash', 'custom'] as RawWhitebalancePreset[]).map(
                presetKey => {
                  const isSelected = settings.wbPreset === presetKey;
                  const label =
                    presetKey === 'as_shot'
                      ? 'As Shot'
                      : presetKey === 'daylight'
                      ? 'Daylight'
                      : presetKey === 'cloudy'
                      ? 'Cloudy'
                      : presetKey === 'shade'
                      ? 'Shade'
                      : presetKey === 'tungsten'
                      ? 'Tungsten'
                      : presetKey === 'fluorescent'
                      ? 'Fluorescent'
                      : presetKey === 'flash'
                      ? 'Flash'
                      : 'Custom';

                  return (
                    <button
                      key={presetKey}
                      onClick={() => handlePresetSelect(presetKey)}
                      className={`editor-btn editor-chip-btn ${
                        isSelected ? 'active' : ''
                      } py-1.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider truncate`}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>

            {/* Color Temperature (Kelvin) Slider */}
            <EditorSlider
              label="Color Temperature"
              value={settings.kelvin}
              onChange={val => update({ kelvin: val, wbPreset: 'custom' })}
              min={2000}
              max={20000}
              step={50}
              defaultValue={5500}
              unit=" K"
              trackBackground="linear-gradient(to right, #38bdf8 0%, #a5f3fc 15%, #fef08a 35%, #fbbf24 55%, #f97316 80%, #ea580c 100%)"
            />

            {/* Tint Slider */}
            <EditorSlider
              label="Tint (Green / Magenta)"
              value={settings.tint}
              onChange={val => update({ tint: val, wbPreset: 'custom' })}
              min={-100}
              max={100}
              defaultValue={0}
              trackBackground="linear-gradient(to right, #10b981 0%, #4b5563 50%, #ec4899 100%)"
              bipolar
            />
          </div>
        )}
      </div>

      {/* ── 2. Sensor Dynamic Range & Linear Exposure ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('exposure')}
          className="w-full flex items-center justify-between p-3 cursor-pointer group/sec text-left"
        >
          <div className="flex items-center gap-2">
            <Sliders size={12} className="text-primary" />
            <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
              Dynamic Range & Exposure
            </span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 group-hover/sec:text-white/60 transition-transform ${
              openSections.exposure ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {openSections.exposure && (
          <div className="px-3 pb-3.5 space-y-3.5 border-t border-white/5 pt-3 animate-in fade-in duration-150">
            {/* Raw EV Exposure Slider */}
            <EditorSlider
              label="Exposure (EV Compensation)"
              value={settings.exposure}
              onChange={val => update({ exposure: val })}
              min={-5.0}
              max={5.0}
              step={0.05}
              defaultValue={0}
              formatValue={val => val > 0 ? `+${val.toFixed(2)} EV` : `${val.toFixed(2)} EV`}
              bipolar
            />

            {/* Highlight Recovery */}
            <EditorSlider
              label="Highlight Recovery"
              value={settings.highlightRecovery}
              onChange={val => update({ highlightRecovery: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit="%"
            />

            {/* Shadow Dynamic Range Boost */}
            <EditorSlider
              label="Shadow Lift"
              value={settings.shadowBoost}
              onChange={val => update({ shadowBoost: val })}
              min={-100}
              max={100}
              defaultValue={0}
              unit="%"
              bipolar
            />

            {/* Whites */}
            <EditorSlider
              label="Whites"
              value={settings.whites}
              onChange={val => update({ whites: val })}
              min={-100}
              max={100}
              defaultValue={0}
              bipolar
            />

            {/* Blacks */}
            <EditorSlider
              label="Blacks"
              value={settings.blacks}
              onChange={val => update({ blacks: val })}
              min={-100}
              max={100}
              defaultValue={0}
              bipolar
            />
          </div>
        )}
      </div>

      {/* ── 3. Sensor Demosaicing & Detail Optimization ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('details')}
          className="w-full flex items-center justify-between p-3 cursor-pointer group/sec text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-cyan-400" />
            <span className="text-xs font-bold text-white/80 group-hover/sec:text-white">
              Sensor Demosaicing & Denoise
            </span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 group-hover/sec:text-white/60 transition-transform ${
              openSections.details ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {openSections.details && (
          <div className="px-3 pb-3.5 space-y-3.5 border-t border-white/5 pt-3 animate-in fade-in duration-150">
            {/* Demosaicing Algorithm */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase">
                Bayer CFA Demosaic Method
              </label>
              <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                {(['amaze', 'ahd', 'rcd'] as DemosaicAlgorithm[]).map(algo => (
                  <button
                    key={algo}
                    onClick={() => update({ algorithm: algo })}
                    className={`editor-btn editor-chip-btn ${
                      settings.algorithm === algo ? 'active' : ''
                    } py-1.5 text-[10px] font-bold uppercase`}
                  >
                    {algo === 'amaze' ? 'AMaZE' : algo.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Wavelet Luminance Denoise */}
            <EditorSlider
              label="Luminance Wavelet Denoise"
              value={settings.denoiseAi}
              onChange={val => update({ denoiseAi: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit="%"
            />

            {/* Chrominance Denoise */}
            <EditorSlider
              label="Color Noise Reduction (Chroma)"
              value={settings.chromaDenoise}
              onChange={val => update({ chromaDenoise: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit="%"
            />

            {/* RAW Micro-contrast Clarity */}
            <EditorSlider
              label="RAW Micro-Contrast"
              value={settings.rawClarity}
              onChange={val => update({ rawClarity: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit="%"
            />
          </div>
        )}
      </div>
    </div>
  );
};
