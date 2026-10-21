/**
 * colorUtils.ts
 * Central color conversion utilities (RGB, HSL, Hex, RGBA, Harmonies) for the Image Editor,
 * powered by the ultra-lightweight `colord` library with backward-compatible legacy helpers.
 */

import { colord, extend } from 'colord';
import harmoniesPlugin from 'colord/plugins/harmonies';
import a11yPlugin from 'colord/plugins/a11y';

extend([harmoniesPlugin, a11yPlugin]);

/**
 * Converts RGB numbers (0-255) to a standard #RRGGBB hex string.
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  return colord({ r, g, b }).toHex();
};

/**
 * Converts a hex color string to rgba() format with custom opacity (0..1).
 */
export const hexToRgba = (hex: string, opacity = 1): string => {
  if (!hex) return 'transparent';
  const c = colord(hex);
  if (!c.isValid()) return hex;
  return c.alpha(opacity).toRgbString();
};

/**
 * Converts RGB (0-255) to HSL ([0-360, 0-1, 0-1]).
 */
export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const { h, s, l } = colord({ r, g, b }).toHsl();
  return [h, s / 100, l / 100];
};

/**
 * Converts HSL ([0-360, 0-1, 0-1]) to RGB ([0-255, 0-255, 0-255]).
 */
export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const { r, g, b } = colord({ h, s: s * 100, l: l * 100 }).toRgb();
  return [r, g, b];
};

/**
 * Computes perceptual luminance (0 to 1) according to WCAG/Rec.709.
 */
export const getPerceptualLuminance = (color: string): number => {
  const c = colord(color);
  return c.isValid() ? c.luminance() : 0.5;
};

/**
 * Generates color harmonies (complementary, analogous, triadic) for palette tools.
 */
export const getColorHarmonies = (hex: string): {
  complementary: string;
  analogous: string[];
  triadic: string[];
} => {
  const c = colord(hex);
  if (!c.isValid()) {
    return { complementary: hex, analogous: [hex, hex], triadic: [hex, hex, hex] };
  }
  return {
    complementary: c.harmonies('complementary')[1]?.toHex() || hex,
    analogous: c.harmonies('analogous').map(h => h.toHex()),
    triadic: c.harmonies('triadic').map(h => h.toHex()),
  };
};

export { colord };
