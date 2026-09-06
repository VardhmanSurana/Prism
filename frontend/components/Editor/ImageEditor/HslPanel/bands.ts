/**
 * bands.ts
 * 8-band HSL color metadata + slider definitions + split-toning presets.
 */
import { HslBand } from '../filterEngine';

export interface BandMeta {
  id: HslBand;
  label: string;
  name: string;
  color: string;
  baseHue: number;
}

export const BANDS: BandMeta[] = [
  { id: 'reds',    label: 'R',  name: 'Red',    color: '#ef4444', baseHue: 0 },
  { id: 'oranges', label: 'Or', name: 'Orange', color: '#f97316', baseHue: 30 },
  { id: 'yellows', label: 'Y',  name: 'Yellow', color: '#eab308', baseHue: 60 },
  { id: 'greens',  label: 'G',  name: 'Green',  color: '#22c55e', baseHue: 120 },
  { id: 'aquas',   label: 'Aq', name: 'Aqua',   color: '#06b6d4', baseHue: 180 },
  { id: 'blues',   label: 'B',  name: 'Blue',   color: '#3b82f6', baseHue: 240 },
  { id: 'purples', label: 'Pu', name: 'Purple', color: '#a855f7', baseHue: 280 },
  { id: 'pinks',   label: 'Pk', name: 'Pink',   color: '#ec4899', baseHue: 330 },
];

export interface SliderDef {
  key: 'hue' | 'saturation' | 'luminance';
  label: string;
  min: number;
  max: number;
}

export const SLIDERS: SliderDef[] = [
  { key: 'hue',        label: 'Hue Shift',   min: -180, max: 180 },
  { key: 'saturation', label: 'Saturation',  min: -100, max: 100 },
  { key: 'luminance',  label: 'Luminance',   min: -100, max: 100 },
];

export interface SplitPreset {
  name: string;
  highlights: { hue: number; saturation: number };
  shadows: { hue: number; saturation: number };
  balance: number;
}

export const SPLIT_PRESETS: SplitPreset[] = [
  { name: 'Teal & Orange', highlights: { hue: 35, saturation: 25 }, shadows: { hue: 210, saturation: 30 }, balance: 0 },
  { name: 'Warm & Cool',   highlights: { hue: 45, saturation: 20 }, shadows: { hue: 220, saturation: 20 }, balance: 10 },
  { name: 'Sepia Tone',    highlights: { hue: 40, saturation: 15 }, shadows: { hue: 35,  saturation: 35 }, balance: -20 },
  { name: 'Cyberpunk',     highlights: { hue: 320, saturation: 40 }, shadows: { hue: 190, saturation: 45 }, balance: 0 },
];

export type WbOption = 'as_shot' | 'daylight' | 'cloudy' | 'shade' | 'tungsten' | 'fluorescent' | 'custom';

export type ColorSubTab = 'mixer' | 'basic' | 'grading' | 'toning';
