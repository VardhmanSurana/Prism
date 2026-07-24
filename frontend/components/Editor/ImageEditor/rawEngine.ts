export type DemosaicAlgorithm = 'amaze' | 'ahd' | 'rcd';

export interface RawSettings {
  algorithm: DemosaicAlgorithm;
  kelvin: number; // 2000 -> 50000K
  tint: number; // -100 -> 100
  highlightRecovery: number; // 0 -> 100
  denoiseAi: number; // 0 -> 100
}

export const DEFAULT_RAW_SETTINGS: RawSettings = {
  algorithm: 'amaze',
  kelvin: 5500,
  tint: 0,
  highlightRecovery: 0,
  denoiseAi: 0,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Convert Kelvin temperature to RGB scaling multiplier (Planckian locus)
function kelvinToRgbScale(kelvin: number): [number, number, number] {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }

  return [clamp(r / 255, 0.1, 2.5), clamp(g / 255, 0.1, 2.5), clamp(b / 255, 0.1, 2.5)];
}

export function applyRawProcessingToImageData(imgData: ImageData, raw: RawSettings): void {
  if (!raw) return;

  const data = imgData.data;

  // Calculate RGB scale from 5500K daylight balance reference
  const refScale = kelvinToRgbScale(5500);
  const targetScale = kelvinToRgbScale(raw.kelvin);

  const scaleR = (targetScale[0] / refScale[0]) * (1 + raw.tint * 0.005);
  const scaleG = (targetScale[1] / refScale[1]);
  const scaleB = (targetScale[2] / refScale[2]) * (1 - raw.tint * 0.005);

  const hlRecovery = (raw.highlightRecovery || 0) / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * scaleR;
    let g = data[i + 1] * scaleG;
    let b = data[i + 2] * scaleB;

    // Highlight Recovery (unclipped channel extrapolation in clipped highlights)
    if (hlRecovery > 0 && (r > 230 || g > 230 || b > 230)) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const avg = (r + g + b) / 3;
      r = r > 230 ? r * (1 - hlRecovery) + avg * hlRecovery : r;
      g = g > 230 ? g * (1 - hlRecovery) + avg * hlRecovery : g;
      b = b > 230 ? b * (1 - hlRecovery) + avg * hlRecovery : b;
    }

    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }
}
