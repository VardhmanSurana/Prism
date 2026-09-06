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

import React, { useState } from 'react';
import {
  RawSettings,
  DEFAULT_RAW_SETTINGS,
  RawWhitebalancePreset,
  WB_PRESET_MAP,
} from '../rawEngine';
import { RotateCcw } from 'lucide-react';
import { RawEnginePanelProps } from './types';
import { RawWhiteBalanceSection } from './RawWhiteBalanceSection';
import { RawExposureSection } from './RawExposureSection';
import { RawDetailSection } from './RawDetailSection';

export const RawEnginePanel: React.FC<RawEnginePanelProps> = ({
  settings = DEFAULT_RAW_SETTINGS,
  onChange,
}) => {
  const [openSections, setOpenSections] = useState({
    wb: true,
    exposure: true,
    details: true,
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

      {/* ── 1. White Balance (Planckian Locus Kelvin & Tint) ── */}
      <RawWhiteBalanceSection
        settings={settings}
        isOpen={openSections.wb}
        onToggle={() => toggleSection('wb')}
        update={update}
        onPresetSelect={handlePresetSelect}
      />

      {/* ── 2. Sensor Dynamic Range & Linear Exposure ── */}
      <RawExposureSection
        settings={settings}
        isOpen={openSections.exposure}
        onToggle={() => toggleSection('exposure')}
        update={update}
      />

      {/* ── 3. Sensor Demosaicing & Detail Optimization ── */}
      <RawDetailSection
        settings={settings}
        isOpen={openSections.details}
        onToggle={() => toggleSection('details')}
        update={update}
      />
    </div>
  );
};

