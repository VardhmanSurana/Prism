/**
 * useHslState.ts
 * Centralizes HSL state derivations and all `onChange`-emitting handlers so
 * each sub-tab receives a small, focused prop bag.
 */
import { useCallback, useMemo, useState } from 'react';
import { Adjustments, ColorWheelsAdjustments, HSL_BAND_DEFAULTS, HslAdjustments, HslBand } from '../filterEngine';
import { WbOption } from './bands';

export interface UseHslStateParams {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export interface UseHslStateApi {
  // Sub-tab navigation
  subTab: 'mixer' | 'basic' | 'grading' | 'toning';
  setSubTab: React.Dispatch<React.SetStateAction<'mixer' | 'basic' | 'grading' | 'toning'>>;

  // Mixer state
  activeBand: HslBand;
  setActiveBand: React.Dispatch<React.SetStateAction<HslBand>>;
  hsl: HslAdjustments;
  isHslModified: boolean;
  isBandModified: (band: HslBand) => boolean;
  handleSliderChange: (key: 'hue' | 'saturation' | 'luminance', value: number) => void;
  handleResetBand: () => void;
  handleResetHslAll: () => void;

  // Basic (white balance) state
  wbOption: WbOption;
  isBasicModified: boolean;
  handleBasicChange: (key: keyof Adjustments, value: number) => void;
  handleWbPresetChange: (val: WbOption) => void;
  handleResetBasicAll: () => void;

  // Grading
  handleColorWheelsChange: (val: ColorWheelsAdjustments) => void;

  // Toning
  isToningModified: boolean;
  handleResetToningAll: () => void;
  updateHighlights: (key: 'hue' | 'saturation', value: number) => void;
  updateShadows: (key: 'hue' | 'saturation', value: number) => void;
  updateBalance: (value: number) => void;
  applySplitPreset: (preset: { highlights: { hue: number; saturation: number }; shadows: { hue: number; saturation: number }; balance: number }) => void;
}

export function useHslState({ adjustments, onChange }: UseHslStateParams): UseHslStateApi {
  const [subTab, setSubTab] = useState<'mixer' | 'basic' | 'grading' | 'toning'>('mixer');
  const [activeBand, setActiveBand] = useState<HslBand>('reds');
  const [wbOption, setWbOption] = useState<WbOption>('as_shot');

  const hsl: HslAdjustments = adjustments.hsl ?? { ...HSL_BAND_DEFAULTS };
  const splitToning = adjustments.splitToning ?? {
    shadows: { hue: 0, saturation: 0 },
    highlights: { hue: 0, saturation: 0 },
    balance: 0,
  };

  const isHslModified = useMemo(
    () => (Object.keys(hsl) as HslBand[]).some(b =>
      hsl[b].hue !== 0 || hsl[b].saturation !== 0 || hsl[b].luminance !== 0,
    ),
    [hsl],
  );

  const isBasicModified = useMemo(
    () =>
      (adjustments.temperature ?? 0) !== 0 ||
      (adjustments.tint ?? 0) !== 0 ||
      (adjustments.vibrance ?? 0) !== 0 ||
      (adjustments.saturation ?? 0) !== 0 ||
      (adjustments.hue ?? 0) !== 0,
    [adjustments],
  );

  const isToningModified = useMemo(
    () =>
      splitToning.shadows.saturation !== 0 ||
      splitToning.highlights.saturation !== 0 ||
      splitToning.balance !== 0,
    [splitToning],
  );

  const isBandModified = useCallback(
    (band: HslBand) => {
      const b = hsl[band];
      return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
    },
    [hsl],
  );

  const handleSliderChange = useCallback(
    (key: 'hue' | 'saturation' | 'luminance', value: number) => {
      const newHsl: HslAdjustments = {
        ...hsl,
        [activeBand]: { ...hsl[activeBand], [key]: value },
      };
      onChange({ ...adjustments, hsl: newHsl });
    },
    [hsl, activeBand, adjustments, onChange],
  );

  const handleResetBand = useCallback(() => {
    const newHsl: HslAdjustments = {
      ...hsl,
      [activeBand]: { hue: 0, saturation: 0, luminance: 0 },
    };
    onChange({ ...adjustments, hsl: newHsl });
  }, [hsl, activeBand, adjustments, onChange]);

  const handleResetHslAll = useCallback(() => {
    onChange({ ...adjustments, hsl: { ...HSL_BAND_DEFAULTS } });
  }, [adjustments, onChange]);

  const handleResetBasicAll = useCallback(() => {
    onChange({
      ...adjustments,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      saturation: 0,
      hue: 0,
    });
    setWbOption('as_shot');
  }, [adjustments, onChange]);

  const handleResetToningAll = useCallback(() => {
    onChange({
      ...adjustments,
      splitToning: {
        shadows: { hue: 0, saturation: 0 },
        highlights: { hue: 0, saturation: 0 },
        balance: 0,
      },
    });
  }, [adjustments, onChange]);

  const handleBasicChange = useCallback(
    (key: keyof Adjustments, value: number) => {
      onChange({ ...adjustments, [key]: value });
      if (key === 'temperature' || key === 'tint') {
        setWbOption('custom');
      }
    },
    [adjustments, onChange],
  );

  const handleWbPresetChange = useCallback(
    (val: WbOption) => {
      setWbOption(val);
      let newTemp = adjustments.temperature ?? 0;
      let newTint = adjustments.tint ?? 0;
      switch (val) {
        case 'as_shot':     newTemp = 0;   newTint = 0; break;
        case 'daylight':    newTemp = 10;  newTint = 2; break;
        case 'cloudy':      newTemp = 25;  newTint = 5; break;
        case 'shade':       newTemp = 40;  newTint = 8; break;
        case 'tungsten':    newTemp = -35; newTint = -5; break;
        case 'fluorescent': newTemp = -15; newTint = 12; break;
        case 'custom':      break;
      }
      onChange({ ...adjustments, temperature: newTemp, tint: newTint });
    },
    [adjustments, onChange],
  );

  const updateHighlights = useCallback(
    (key: 'hue' | 'saturation', value: number) => {
      onChange({
        ...adjustments,
        splitToning: {
          ...splitToning,
          highlights: { ...splitToning.highlights, [key]: value },
        },
      });
    },
    [splitToning, adjustments, onChange],
  );

  const updateShadows = useCallback(
    (key: 'hue' | 'saturation', value: number) => {
      onChange({
        ...adjustments,
        splitToning: {
          ...splitToning,
          shadows: { ...splitToning.shadows, [key]: value },
        },
      });
    },
    [splitToning, adjustments, onChange],
  );

  const updateBalance = useCallback(
    (value: number) => {
      onChange({
        ...adjustments,
        splitToning: { ...splitToning, balance: value },
      });
    },
    [splitToning, adjustments, onChange],
  );

  const applySplitPreset = useCallback(
    (preset: { highlights: { hue: number; saturation: number }; shadows: { hue: number; saturation: number }; balance: number }) => {
      onChange({
        ...adjustments,
        splitToning: {
          highlights: { ...preset.highlights },
          shadows: { ...preset.shadows },
          balance: preset.balance,
        },
      });
    },
    [adjustments, onChange],
  );

  const handleColorWheelsChange = useCallback(
    (val: ColorWheelsAdjustments) => {
      onChange({ ...adjustments, colorWheels: val });
    },
    [adjustments, onChange],
  );

  return {
    subTab, setSubTab,
    activeBand, setActiveBand,
    hsl, isHslModified, isBandModified,
    handleSliderChange, handleResetBand, handleResetHslAll,
    wbOption, isBasicModified,
    handleBasicChange, handleWbPresetChange, handleResetBasicAll,
    handleColorWheelsChange,
    isToningModified, handleResetToningAll,
    updateHighlights, updateShadows, updateBalance, applySplitPreset,
  };
}
