/**
 * cubeLutParser.ts — Parser for Adobe 3D Color LUT (.cube) files.
 * Converts raw ASCII .cube text into raw Float32Array RGB pixel buffers for WebGL 3D textures.
 */

export interface ParsedCubeLut {
  title?: string;
  size: number;
  data: Float32Array; // RGB float values [0..1]
}

/**
 * parseCubeLut - Formats parse cube lut.
 */
export function parseCubeLut(lutText: string): ParsedCubeLut {
  const lines = lutText.split(/\r?\n/);
  let size = 0;
  let title = 'Custom LUT';
  const rgbValues: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('TITLE')) {
      const match = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (match) title = match[1];
      continue;
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    // Parse float RGB triplets: e.g. "0.0123 0.4567 0.8901"
    /**
     * numbers - Performs numbers.
     */
    const numbers = line.split(/\s+/).map((n) => parseFloat(n));
    if (numbers.length >= 3 && !isNaN(numbers[0])) {
      rgbValues.push(numbers[0], numbers[1], numbers[2]);
    }
  }

  if (size === 0) {
    // Infer cubic size if missing in header
    size = Math.round(Math.cbrt(rgbValues.length / 3));
  }

  const expectedLength = size * size * size * 3;
  const floatData = new Float32Array(expectedLength);

  for (let i = 0; i < Math.min(rgbValues.length, expectedLength); i++) {
    floatData[i] = Math.max(0, Math.min(1, rgbValues[i]));
  }

  return { title, size, data: floatData };
}
