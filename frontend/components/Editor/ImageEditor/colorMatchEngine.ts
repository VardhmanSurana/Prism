function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface ColorStats {
  meanR: number;
  meanG: number;
  meanB: number;
  stdR: number;
  stdG: number;
  stdB: number;
}

export function computeImageColorStats(imageData: ImageData): ColorStats {
  const data = imageData.data;
  let sumR = 0, sumG = 0, sumB = 0;
  const count = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < data.length; i += 4) {
    varR += Math.pow(data[i] - meanR, 2);
    varG += Math.pow(data[i + 1] - meanG, 2);
    varB += Math.pow(data[i + 2] - meanB, 2);
  }

  return {
    meanR,
    meanG,
    meanB,
    stdR: Math.sqrt(varR / count) || 1,
    stdG: Math.sqrt(varG / count) || 1,
    stdB: Math.sqrt(varB / count) || 1,
  };
}

export function applyColorMatch(
  targetData: ImageData,
  referenceData: ImageData,
  matchStrength: number = 100
): void {
  const refStats = computeImageColorStats(referenceData);
  const targetStats = computeImageColorStats(targetData);
  const strength = matchStrength / 100;

  const data = targetData.data;
  const scaleR = refStats.stdR / targetStats.stdR;
  const scaleG = refStats.stdG / targetStats.stdG;
  const scaleB = refStats.stdB / targetStats.stdB;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const matchedR = refStats.meanR + scaleR * (r - targetStats.meanR);
    const matchedG = refStats.meanG + scaleG * (g - targetStats.meanG);
    const matchedB = refStats.meanB + scaleB * (b - targetStats.meanB);

    data[i] = clamp(Math.round(r * (1 - strength) + matchedR * strength), 0, 255);
    data[i + 1] = clamp(Math.round(g * (1 - strength) + matchedG * strength), 0, 255);
    data[i + 2] = clamp(Math.round(b * (1 - strength) + matchedB * strength), 0, 255);
  }
}
