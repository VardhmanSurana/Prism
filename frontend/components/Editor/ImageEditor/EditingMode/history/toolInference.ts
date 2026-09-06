/**
 * toolInference.ts
 * Maps standard adjustment keys to their corresponding editor tool tabs.
 */

export function inferToolId(key: string): string {
  // Detail
  if (
    key === 'clarity' ||
    key === 'sharpness' ||
    key === 'noiseReduction' ||
    key === 'tiltShift'
  ) {
    return 'detail';
  }

  // HSL & White Balance
  if (
    key === 'hsl' ||
    key === 'splitToning' ||
    key === 'colorWheels' ||
    key === 'temperature' ||
    key === 'tint' ||
    key === 'vibrance' ||
    key === 'saturation' ||
    key === 'hue'
  ) {
    return 'hsl';
  }

  // Geometry / Transform
  if (
    key === 'perspective' ||
    key === 'verticalPerspective' ||
    key === 'distortion'
  ) {
    return 'transform';
  }

  // Texture & Effects
  if (
    key === 'vignette' ||
    key === 'grain' ||
    key === 'lightLeak' ||
    key === 'blend'
  ) {
    return 'texture';
  }

  // Other explicit panels
  if (key === 'frame') return 'frame';
  if (key === 'layers') return 'layers';
  if (key === 'portrait') return 'portrait';
  if (key === 'background') return 'background';
  if (key === 'lut') return 'lut';
  if (key === 'raw') return 'raw';

  // Light & Tone Adjustments
  if (
    key === 'exposure' ||
    key === 'contrast' ||
    key === 'brightness' ||
    key === 'highlights' ||
    key === 'shadows' ||
    key === 'whites' ||
    key === 'blacks' ||
    key === 'ambiance' ||
    key === 'dehaze' ||
    key === 'curves' ||
    key === 'specializedCurves'
  ) {
    return 'adjust';
  }

  return 'adjust';
}

