/**
 * DepthPanel.tsx
 * Monocular depth effects powered by Depth Anything V2 Small.
 * Two modes: depth-map export and depth-weighted background blur (bokeh).
 */

import React from 'react';
import { Layers, Aperture, Loader2, Download } from 'lucide-react';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

export type DepthMode = 'map' | 'bokeh';

export interface DepthSettings {
  /** Gaussian sigma in px applied to out-of-focus regions. */
  strengthPx: number;
  /** Focus point on the nearness scale: 0 = farthest, 1 = nearest. */
  focus: number;
}

export interface DepthPanelProps {
  mode: DepthMode;
  settings: DepthSettings;
  onModeChange: (mode: DepthMode) => void;
  onSettingsChange: (settings: DepthSettings) => void;
  onProcess: () => void;
  isProcessing: boolean;
  /** Data-URI preview of the computed depth map (map mode). */
  depthMapData: string | null;
  infoMessage?: string | null;
}

export const DepthPanel: React.FC<DepthPanelProps> = ({
  mode,
  settings,
  onModeChange,
  onSettingsChange,
  onProcess,
  isProcessing,
  depthMapData,
  infoMessage,
}) => {
  return (
    <div className="pb-6">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1">
          Depth Effects
        </p>
        <p className="text-[11px] text-white/35 leading-snug">
          Monocular depth estimation for focus falloff and map export.
        </p>
      </div>

      {/* ── Mode ── */}
      <div className="px-5 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
          Mode
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onModeChange('bokeh')}
            className={`editor-btn editor-card-btn ${mode === 'bokeh' ? 'active' : ''} py-3 px-2 text-[10px] font-bold uppercase tracking-wider`}
          >
            <Aperture size={16} className="mx-auto mb-2" />
            Bokeh Blur
          </button>
          <button
            onClick={() => onModeChange('map')}
            className={`editor-btn editor-card-btn ${mode === 'map' ? 'active' : ''} py-3 px-2 text-[10px] font-bold uppercase tracking-wider`}
          >
            <Layers size={16} className="mx-auto mb-2" />
            Depth Map
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      {mode === 'bokeh' ? (
        <div className="px-5 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
            Bokeh
          </p>
          <div className="mb-4">
            <EditorSlider
              label="Blur Strength"
              value={settings.strengthPx}
              onChange={val => onSettingsChange({ ...settings, strengthPx: val })}
              min={1}
              max={24}
              step={0.5}
              defaultValue={6}
              unit="px"
            />
          </div>
          <EditorSlider
            label="Focus Point"
            value={Math.round(settings.focus * 100)}
            onChange={val => onSettingsChange({ ...settings, focus: val / 100 })}
            min={5}
            max={95}
            step={1}
            defaultValue={50}
            unit="%"
            formatValue={(v: number) => `${v}%${v >= 50 ? ' near' : ' far'}`}
          />
          <p className="mt-2 text-[11px] text-white/30 leading-snug">
            Regions nearer than the focus point stay sharp; farther regions blur.
          </p>
        </div>
      ) : (
        <div className="px-5 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-3">
            Preview
          </p>
          {depthMapData ? (
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40">
              <img src={depthMapData} alt="Depth map" className="w-full block" />
            </div>
          ) : (
            <p className="text-[11px] text-white/30 leading-snug">
              Compute the map to preview nearness (bright = near).
            </p>
          )}
        </div>
      )}

      {/* ── Info ── */}
      {infoMessage && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03]">
          <p className="text-[11px] text-white/45 leading-snug">{infoMessage}</p>
        </div>
      )}

      {/* ── Apply ── */}
      <div className="px-5">
        <button
          onClick={onProcess}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all bg-primary text-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : mode === 'map' ? (
            <Download size={14} />
          ) : (
            <Aperture size={14} />
          )}
          {isProcessing
            ? 'Processing…'
            : mode === 'map'
              ? 'Compute Depth Map'
              : 'Apply Bokeh'}
        </button>
        <p className="mt-2 text-[11px] text-white/25 leading-snug">
          Requires the Depth Anything V2 model (Model Manager). Bokeh writes back to the photo.
        </p>
      </div>
    </div>
  );
};
