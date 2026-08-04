import { ColorWheelsAdjustments, ColorWheelVal } from './filterEngine';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-5), 0, 1);
  return t * t * (3 - 2 * t);
}

export function applyColorWheelsToImageData(imgData: ImageData, wheels: ColorWheelsAdjustments): void {
  if (!wheels) return;

  const data = imgData.data;
  const isLog = wheels.mode === 'log';

  // Check if identity
  const isValZero = (v: ColorWheelVal) => v.x === 0 && v.y === 0 && v.yuma === 0;
  if (
    isValZero(wheels.lift) &&
    isValZero(wheels.gamma) &&
    isValZero(wheels.gain) &&
    isValZero(wheels.offset) &&
    isValZero(wheels.shadows) &&
    isValZero(wheels.midtones) &&
    isValZero(wheels.highlights)
  ) {
    return;
  }

  // Pre-calculate vector RGB deltas for Primary (3-Way)
  // X axis shifts Red (+X) vs Cyan (-X), Y axis shifts Magenta (+Y) vs Green (-Y)
  const getRgbDelta = (v: ColorWheelVal, scale: number = 0.35) => {
    const normX = (v.x / 100) * scale;
    const normY = (v.y / 100) * scale;
    return {
      r: normX + normY * 0.5,
      g: -normX * 0.5 - normY * 0.5,
      b: -normX * 0.5 + normY,
      yuma: (v.yuma / 100) * 0.4,
    };
  };

  const liftD = getRgbDelta(wheels.lift);
  const gammaD = getRgbDelta(wheels.gamma);
  const gainD = getRgbDelta(wheels.gain);
  const offsetD = getRgbDelta(wheels.offset);

  const shadowD = getRgbDelta(wheels.shadows);
  const midtoneD = getRgbDelta(wheels.midtones);
  const highlightD = getRgbDelta(wheels.highlights);

  const lowPivot = (wheels.lowPivot ?? 20) / 100;
  const highPivot = (wheels.highPivot ?? 80) / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (!isLog) {
      // Primary 3-Way LIFT / GAMMA / GAIN / OFFSET
      // Offset global shift
      r += offsetD.r + offsetD.yuma;
      g += offsetD.g + offsetD.yuma;
      b += offsetD.b + offsetD.yuma;

      // Lift (Shadows)
      const shadowWeight = 1 - y;
      r += (liftD.r + liftD.yuma) * shadowWeight;
      g += (liftD.g + liftD.yuma) * shadowWeight;
      b += (liftD.b + liftD.yuma) * shadowWeight;

      // Gain (Highlights)
      const highlightWeight = y;
      r += (gainD.r + gainD.yuma) * highlightWeight;
      g += (gainD.g + gainD.yuma) * highlightWeight;
      b += (gainD.b + gainD.yuma) * highlightWeight;

      // Gamma (Midtones power)
      const gammaPowR = Math.exp(-gammaD.r - gammaD.yuma);
      const gammaPowG = Math.exp(-gammaD.g - gammaD.yuma);
      const gammaPowB = Math.exp(-gammaD.b - gammaD.yuma);

      r = r > 0 ? Math.pow(r, gammaPowR) : r;
      g = g > 0 ? Math.pow(g, gammaPowG) : g;
      b = b > 0 ? Math.pow(b, gammaPowB) : b;
    } else {
      // Log Wheels (Shadows, Midtones, Highlights with zone pivots)
      const shadowW = 1 - smoothstep(0, lowPivot, y);
      const highlightW = smoothstep(highPivot, 1, y);
      const midtoneW = Math.max(0, 1 - shadowW - highlightW);

      r += (shadowD.r + shadowD.yuma) * shadowW + (midtoneD.r + midtoneD.yuma) * midtoneW + (highlightD.r + highlightD.yuma) * highlightW;
      g += (shadowD.g + shadowD.yuma) * shadowW + (midtoneD.g + midtoneD.yuma) * midtoneW + (highlightD.g + highlightD.yuma) * highlightW;
      b += (shadowD.b + shadowD.yuma) * shadowW + (midtoneD.b + midtoneD.yuma) * midtoneW + (highlightD.b + highlightD.yuma) * highlightW;
    }

    data[i] = clamp(Math.round(r * 255), 0, 255);
    data[i + 1] = clamp(Math.round(g * 255), 0, 255);
    data[i + 2] = clamp(Math.round(b * 255), 0, 255);
  }
}
