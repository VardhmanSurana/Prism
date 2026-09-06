/**
 * AdjustPanel.tsx
 * Renders all adjustment sliders, grouped by category (LIGHT, TONE CURVE, COLOR) matching the design.
 * Completely stateless — parent owns the Adjustments object.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp, Sun } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { apiClient } from '@/services/apiClient';
import { CurveEditor } from './CurveEditor';
import { CurveState, DEFAULT_CURVE, isIdentityCurve } from './curves';
import { EditorSlider } from './ui/EditorSlider';

export type AdjustSliderKey =
  | 'brightness' | 'contrast'   | 'exposure'
  | 'highlights' | 'shadows'    | 'whites'    | 'blacks'
  | 'ambiance'   | 'dehaze';

export interface AdjItem {
  key:   AdjustSliderKey;
  label: string;
  min:   number;
  max:   number;
  step?: number;
}

const DEFAULT_ADJUST_SLIDERS: Pick<Adjustments, AdjustSliderKey> = {
  brightness:  0,
  contrast:    0,
  exposure:    0,
  highlights:  0,
  shadows:     0,
  whites:      0,
  blacks:      0,
  ambiance:    0,
  dehaze:      0,
};

interface AdjustPanelProps {
  adjustments: Adjustments;
  onChange:    (adj: Adjustments) => void;
  photoId?:    number | string;
  imageSrc?:   string;
  filterString?: string;
  onAutoEnhance?: () => Promise<void> | void;
  isAutoEnhancing?: boolean;
}

/**
 * AdjustPanel - Renders adjust panel.
 */
export const AdjustPanel: React.FC<AdjustPanelProps> = ({ adjustments, onChange, photoId, imageSrc, filterString, onAutoEnhance: onAutoEnhanceProp, isAutoEnhancing: isAutoEnhancingProp }) => {
  const [isAutoEnhancingInternal, setIsAutoEnhancingInternal] = useState(false);
  const isAutoEnhancing = isAutoEnhancingProp !== undefined ? isAutoEnhancingProp : isAutoEnhancingInternal;

  // Collapsible Accordion states
  const [lightOpen, setLightOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(true);

  // Sub-collapsible sections for extra controls (keeps primary list matching screenshot)
  const [showExtraLight, setShowExtraLight] = useState(false);

  const isDefault = useMemo(() => {
    const keys: AdjustSliderKey[] = [
      'brightness', 'contrast', 'exposure', 'highlights', 'shadows', 'whites', 'blacks',
      'ambiance', 'dehaze'
    ];
    return keys.every(k => adjustments[k] === DEFAULT_ADJUST_SLIDERS[k]) && isIdentityCurve(adjustments.curves);
  }, [adjustments]);

  /**
   * handleReset - Handles reset.
   */
  const handleReset = useCallback(() => {
    onChange({ ...adjustments, ...DEFAULT_ADJUST_SLIDERS, curves: DEFAULT_CURVE });
  }, [onChange, adjustments]);

  /**
   * handleCurvesChange - Handles curves change.
   */
  const handleCurvesChange = useCallback((val: CurveState) => {
    onChange({ ...adjustments, curves: val });
  }, [adjustments, onChange]);

  /**
   * handleAutoEnhance - Handles auto enhance.
   */
  const handleAutoEnhance = useCallback(async () => {
    // If parent controls auto-enhance (e.g. for keyboard shortcut sharing), delegate to parent
    if (onAutoEnhanceProp) {
      await onAutoEnhanceProp();
      return;
    }
    if (!photoId) return;
    setIsAutoEnhancingInternal(true);
    try {
      const params = await apiClient.post<Partial<Adjustments>>(`/api/v1/photos/auto-enhance/${photoId}`, {});
      onChange({
        ...adjustments,
        ...params
      });
    } catch (e) {
      console.error("Auto enhance failed", e);
    } finally {
      setIsAutoEnhancingInternal(false);
    }
  }, [photoId, onChange, adjustments, onAutoEnhanceProp]);

  const handleChange = useCallback(
    (key: keyof Adjustments, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

  // Sliders display helpers
  /**
   * formatExposure - Formats format exposure.
   */
  const formatExposure = (val: number) => {
    const dec = val / 100;
    if (dec > 0) return `+${dec.toFixed(2)}`;
    return dec.toFixed(2);
  };

  const formatGeneric = (val: number) => {
    if (val > 0) return `+${val}`;
    return String(val);
  };

  // Check if Curve Editor has any active nodes (i.e. is not straight identity diagonal)
  const hasActiveCurves = !isIdentityCurve(adjustments.curves);

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white">
      {/* ── Action buttons ── */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <button
          onClick={handleAutoEnhance}
          disabled={!photoId || isAutoEnhancing}
          className="flex-[2] flex items-center justify-center gap-1.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] font-medium text-white/95 transition-colors 150ms ease, background-color 150ms ease cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {isAutoEnhancing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-white/60" />}
          Auto Enhance
        </button>

        <button
          onClick={handleReset}
          disabled={isDefault}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-colors 150ms ease, background-color 150ms ease border ${
            !isDefault
              ? 'border-white/5 text-white/70 hover:text-white hover:bg-white/5 cursor-pointer bg-white/5'
              : 'border-transparent text-white/20 cursor-default'
          }`}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* ── 1. LIGHT ACCORDION ── */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setLightOpen(!lightOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-white/40" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Light</span>
          </div>
          {lightOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </button>

        {lightOpen && (
          <div className="px-4 pb-4 pt-2 space-y-3.5">
            {([
              { key: 'exposure', label: 'Exposure', min: -100, max: 100, formatter: formatExposure },
              { key: 'contrast', label: 'Contrast', min: -100, max: 100, formatter: formatGeneric },
              { key: 'highlights', label: 'Highlights', min: -100, max: 100, formatter: formatGeneric },
              { key: 'shadows', label: 'Shadows', min: -100, max: 100, formatter: formatGeneric },
              { key: 'whites', label: 'Whites', min: -100, max: 100, formatter: formatGeneric },
              { key: 'blacks', label: 'Blacks', min: -100, max: 100, formatter: formatGeneric },
            ] as const).map(item => (
              <EditorSlider
                key={item.key}
                label={item.label}
                value={adjustments[item.key] ?? 0}
                onChange={val => handleChange(item.key, val)}
                min={item.min}
                max={item.max}
                defaultValue={0}
                formatValue={item.formatter}
                bipolar
              />
            ))}

            {/* Sub-collapsible extra options for other Tone adjusters */}
            <div className="pt-1">
              <button
                onClick={() => setShowExtraLight(!showExtraLight)}
                className="text-[10px] font-medium text-white/30 hover:text-white/50 flex items-center gap-1 cursor-pointer"
              >
                {showExtraLight ? 'Hide details' : 'Show advanced tone settings...'}
              </button>
              
              {showExtraLight && (
                <div className="mt-3.5 space-y-3.5 border-t border-white/5 pt-3.5">
                  {([
                    { key: 'brightness', label: 'Brightness', min: -100, max: 100, formatter: formatGeneric },
                    { key: 'ambiance', label: 'Ambiance', min: -100, max: 100, formatter: formatGeneric },
                    { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, formatter: formatGeneric },
                  ] as const).map(item => (
                    <EditorSlider
                      key={item.key}
                      label={item.label}
                      value={adjustments[item.key] ?? 0}
                      onChange={val => handleChange(item.key, val)}
                      min={item.min}
                      max={item.max}
                      defaultValue={0}
                      formatValue={item.formatter}
                      bipolar
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. TONE & COLOR CURVES ACCORDION ── */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setCurvesOpen(!curvesOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-white/40" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Curves (RGB & Color)</span>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveCurves && <span className="text-[10px] text-white/35 font-bold select-none mr-1 font-sans">✓</span>}
            {curvesOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
          </div>
        </button>

        {curvesOpen && (
          <div className="px-4 pb-5 pt-1">
            <CurveEditor
              value={adjustments.curves}
              onChange={handleCurvesChange}
              specializedValue={adjustments.specializedCurves}
              onSpecializedChange={(sc) => onChange({ ...adjustments, specializedCurves: sc })}
              imageSrc={imageSrc}
              filterString={filterString}
            />
          </div>
        )}
      </div>

    </div>
  );
};
