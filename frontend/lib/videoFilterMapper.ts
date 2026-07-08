import type { ClipEffects } from '@/types/nle';

export function effectsToCSSFilter(effects: ClipEffects): string {
  const parts: string[] = [];

  // brightness: -100..100 → 0..2 (1 = neutral), combined with highlights
  const hlB = effects.highlights !== 0 ? effects.highlights / 200 : 0;
  const b = 1 + effects.brightness / 100 + hlB;
  if (b !== 1) parts.push(`brightness(${b.toFixed(2)})`);

  // contrast: -100..100 → 0..2 (1 = neutral), combined with shadows
  const shC = effects.shadows !== 0 ? effects.shadows / 200 : 0;
  const c = 1 + effects.contrast / 100 + shC;
  if (c !== 1) parts.push(`contrast(${c.toFixed(2)})`);

  // saturation: -100..100 → 0..2 (1 = neutral)
  const s = 1 + effects.saturation / 100;
  if (s !== 1) parts.push(`saturate(${s.toFixed(2)})`);

  // temperature: positive = warm (sepia shift), negative = cool (hue-rotate)
  if (effects.temperature !== 0) {
    const deg = effects.temperature * 0.6;
    parts.push(`hue-rotate(${deg.toFixed(1)}deg)`);
  }

  // vignette: rendered as an SVG overlay (VignetteOverlay component), not a CSS filter

  // sharpness & noiseReduction: no CSS equivalent — applied during MLT export only.
  // Preview shows these effects only in compare mode via MLT segment renders.

  return parts.length > 0 ? parts.join(' ') : 'none';
}

