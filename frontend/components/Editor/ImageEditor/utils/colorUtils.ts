/**
 * colorUtils.ts
 * Central color conversion utilities (RGB, HSL, Hex, RGBA) for the Image Editor.
 */

/**
 * Converts RGB numbers (0-255) to a standard #RRGGBB hex string.
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const clampR = Math.max(0, Math.min(255, Math.round(r)));
  const clampG = Math.max(0, Math.min(255, Math.round(g)));
  const clampB = Math.max(0, Math.min(255, Math.round(b)));
  return `#${((1 << 24) + (clampR << 16) + (clampG << 8) + clampB).toString(16).slice(1)}`;
};

/**
 * Converts a hex color string to rgba() format with custom opacity (0..1).
 */
export const hexToRgba = (hex: string, opacity = 1): string => {
  if (!hex) return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Converts RGB (0-255) to HSL ([0-360, 0-1, 0-1]).
 */
export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  h = (h / 6) * 360;
  return [h, s, l];
};

const hueToRgb = (p: number, q: number, t: number): number => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

/**
 * Converts HSL ([0-360, 0-1, 0-1]) to RGB ([0-255, 0-255, 0-255]).
 */
export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const hn = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hn) * 255),
    Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  ];
};
