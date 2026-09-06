import { describe, it, expect } from 'vitest';
import {
  rgbToHex,
  hexToRgba,
  rgbToHsl,
  hslToRgb,
  getPerceptualLuminance,
  getColorHarmonies,
} from '../utils/colorUtils';

describe('colorUtils with colord', () => {
  it('converts RGB numbers to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts hex to rgba string with custom alpha', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(hexToRgba('#00ff00', 1)).toBe('rgb(0, 255, 0)');
    expect(hexToRgba('', 0.5)).toBe('transparent');
  });

  it('converts RGB to HSL and back', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBe(0);
    expect(s).toBe(1);
    expect(l).toBe(0.5);

    const [r, g, b] = hslToRgb(h, s, l);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('calculates perceptual luminance accurately', () => {
    const whiteLum = getPerceptualLuminance('#ffffff');
    const blackLum = getPerceptualLuminance('#000000');
    expect(whiteLum).toBe(1);
    expect(blackLum).toBe(0);
    expect(getPerceptualLuminance('invalid')).toBe(0.5);
  });

  it('generates harmonies (complementary, analogous, triadic)', () => {
    const harmonies = getColorHarmonies('#ff0000');
    expect(harmonies.complementary).toBeDefined();
    expect(harmonies.analogous).toHaveLength(3);
    expect(harmonies.triadic).toHaveLength(3);
  });
});
