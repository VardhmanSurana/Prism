import type { ClipEffects } from '@/types/nle';

export function effectsToCSSFilter(e: ClipEffects): string {
  const b = 1 + e.brightness / 100 + (e.highlights / 200);
  const c = 1 + e.contrast / 100 + (e.shadows / 200);
  const s = 1 + e.saturation / 100;
  const parts: string[] = [];

  if (b !== 1) parts.push(`brightness(${b.toFixed(2)})`);
  if (c !== 1) parts.push(`contrast(${c.toFixed(2)})`);
  if (s !== 1) parts.push(`saturate(${s.toFixed(2)})`);
  if (e.temperature) parts.push(`hue-rotate(${(e.temperature * 0.6).toFixed(1)}deg)`);

  return parts.join(' ') || 'none';
}
