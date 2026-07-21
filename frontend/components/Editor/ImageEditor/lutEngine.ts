/**
 * lutEngine.ts
 * 3D LUT (.cube) parser and Canvas2D pixel-mapping engine.
 *
 * Architecture note: Uses Canvas2D ImageData pixel manipulation instead of
 * SVG filters, directly addressing the SVG filter performance bottleneck
 * weakness for high-res images.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LutData {
  size: number;           // LUT cube dimension (e.g. 17, 33)
  title: string;
  table: Float32Array;    // Flattened RGB table: [r0,g0,b0, r1,g1,b1, ...]
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

export interface BuiltinLut {
  id: string;
  name: string;
  category: 'cinematic' | 'vintage' | 'portrait' | 'creative' | 'bw';
  description: string;
  /** Compact 5×5×5 LUT table as flattened array [r,g,b, ...] in 0-1 range */
  generate: () => LutData;
}

// ── .cube file parser ────────────────────────────────────────────────────────

export function parseCubeFile(text: string): LutData | null {
  try {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let size = 0;
    let title = 'Imported LUT';
    let domainMin: [number, number, number] = [0, 0, 0];
    let domainMax: [number, number, number] = [1, 1, 1];
    const data: number[] = [];

    for (const line of lines) {
      if (line.startsWith('#')) continue;
      if (line.startsWith('TITLE')) {
        title = line.replace('TITLE', '').replace(/"/g, '').trim();
      } else if (line.startsWith('LUT_3D_SIZE')) {
        size = parseInt(line.split(/\s+/)[1], 10);
      } else if (line.startsWith('DOMAIN_MIN')) {
        const parts = line.split(/\s+/);
        domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      } else if (line.startsWith('DOMAIN_MAX')) {
        const parts = line.split(/\s+/);
        domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      } else if (/^[\d.\-+e]/.test(line)) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          data.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
        }
      }
    }

    if (size === 0 || data.length !== size * size * size * 3) return null;

    return { size, title, table: new Float32Array(data), domainMin, domainMax };
  } catch {
    return null;
  }
}

// ── Trilinear interpolation lookup ───────────────────────────────────────────

function trilinearLookup(lut: LutData, r: number, g: number, b: number): [number, number, number] {
  const { size, table } = lut;
  const s = size - 1;

  // Clamp + scale to LUT space
  r = Math.max(0, Math.min(1, r)) * s;
  g = Math.max(0, Math.min(1, g)) * s;
  b = Math.max(0, Math.min(1, b)) * s;

  const r0 = Math.floor(r), r1 = Math.min(r0 + 1, s);
  const g0 = Math.floor(g), g1 = Math.min(g0 + 1, s);
  const b0 = Math.floor(b), b1 = Math.min(b0 + 1, s);

  const fr = r - r0, fg = g - g0, fb = b - b0;

  // Index into the flattened table (B changes slowest in .cube format)
  const idx = (bv: number, gv: number, rv: number) => (bv * size * size + gv * size + rv) * 3;

  const i000 = idx(b0, g0, r0), i001 = idx(b0, g0, r1);
  const i010 = idx(b0, g1, r0), i011 = idx(b0, g1, r1);
  const i100 = idx(b1, g0, r0), i101 = idx(b1, g0, r1);
  const i110 = idx(b1, g1, r0), i111 = idx(b1, g1, r1);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c000 = table[i000 + c], c001 = table[i001 + c];
    const c010 = table[i010 + c], c011 = table[i011 + c];
    const c100 = table[i100 + c], c101 = table[i101 + c];
    const c110 = table[i110 + c], c111 = table[i111 + c];

    out[c] = lerp(
      lerp(lerp(c000, c001, fr), lerp(c010, c011, fr), fg),
      lerp(lerp(c100, c101, fr), lerp(c110, c111, fr), fg),
      fb
    );
  }
  return out;
}

// ── Apply LUT to ImageData ───────────────────────────────────────────────────

export function applyLutToImageData(imageData: ImageData, lut: LutData, opacity: number = 1.0): ImageData {
  const { data } = imageData;
  const out = new ImageData(
    new Uint8ClampedArray(data),
    imageData.width,
    imageData.height
  );

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]     / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const [nr, ng, nb] = trilinearLookup(lut, r, g, b);

    // Blend with original based on opacity
    out.data[i]     = Math.round((nr * opacity + r * (1 - opacity)) * 255);
    out.data[i + 1] = Math.round((ng * opacity + g * (1 - opacity)) * 255);
    out.data[i + 2] = Math.round((nb * opacity + b * (1 - opacity)) * 255);
    out.data[i + 3] = data[i + 3]; // preserve alpha
  }
  return out;
}

// ── Apply LUT to Canvas ───────────────────────────────────────────────────────

export function applyLutToCanvas(
  canvas: HTMLCanvasElement,
  lut: LutData,
  opacity: number = 1.0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = applyLutToImageData(imageData, lut, opacity);
  ctx.putImageData(result, 0, 0);
}

// ── Built-in LUT generators ──────────────────────────────────────────────────
// Each LUT is expressed as a 17×17×17 cube (4913 entries × 3 channels = 14739 values)
// Generated via mathematical transforms for zero external dependencies.

function generateLut(size: number, transform: (r: number, g: number, b: number) => [number, number, number]): LutData {
  const total = size * size * size * 3;
  const table = new Float32Array(total);
  let idx = 0;
  for (let bv = 0; bv < size; bv++) {
    for (let gv = 0; gv < size; gv++) {
      for (let rv = 0; rv < size; rv++) {
        const r = rv / (size - 1);
        const g = gv / (size - 1);
        const b = bv / (size - 1);
        const [nr, ng, nb] = transform(r, g, b);
        table[idx++] = Math.max(0, Math.min(1, nr));
        table[idx++] = Math.max(0, Math.min(1, ng));
        table[idx++] = Math.max(0, Math.min(1, nb));
      }
    }
  }
  return { size, title: '', table, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
}

// Helper: RGB to HSL and back
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)];
}

// S-curve for cinematic contrast
function sCurve(x: number, strength: number = 0.3): number {
  // Sigmoid: produces smooth S-curve contrast enhancement
  const a = strength;
  return x < 0.5
    ? 0.5 * Math.pow(2 * x, 1 + a)
    : 1 - 0.5 * Math.pow(2 * (1 - x), 1 + a);
}

// ── 10 Cinematic Built-in LUTs ───────────────────────────────────────────────

export const BUILTIN_LUTS: BuiltinLut[] = [
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    category: 'cinematic',
    description: 'Warm amber highlights, deep teal shadows — a classic Hollywood sunset grade',
    generate: () => generateLut(17, (r, g, b) => {
      // Teal-orange split toning + S-curve
      const [h, s, l] = rgbToHsl(r, g, b);
      // Warm up highlights, cool down shadows
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const warmShift = luminance * 0.08;
      const coolShift = (1 - luminance) * 0.05;
      return [
        sCurve(Math.min(1, r + warmShift), 0.2),
        sCurve(Math.min(1, g + warmShift * 0.3), 0.2),
        sCurve(Math.max(0, b - coolShift + warmShift * 0.1), 0.25),
      ];
    }),
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    category: 'cinematic',
    description: 'The iconic blockbuster color grade — skin tones pop against teal environments',
    generate: () => generateLut(17, (r, g, b) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      // Boost orange (reds/yellows) and push neutrals toward teal
      const isWarm = h > 0.0 && h < 0.15 || h > 0.9;
      const satBoost = isWarm ? 1.25 : 0.9;
      const ns = Math.min(1, s * satBoost);
      let nh = h;
      // Shift non-warm hues slightly toward teal (0.5)
      if (!isWarm && s > 0.1) nh = h + (0.5 - h) * 0.12;
      const [nr, ng, nb] = hslToRgb(nh, ns, sCurve(l, 0.25));
      return [nr, ng, nb];
    }),
  },
  {
    id: 'matte-fade',
    name: 'Matte Fade',
    category: 'cinematic',
    description: 'Lifted blacks and crushed whites for a faded film look',
    generate: () => generateLut(17, (r, g, b) => {
      // Lift shadows, compress highlights — faded matte effect
      const lift = 0.07;
      const compress = 0.88;
      return [
        lift + r * compress,
        lift + g * compress,
        lift + b * (compress - 0.02),
      ];
    }),
  },
  {
    id: 'bleach-bypass',
    name: 'Bleach Bypass',
    category: 'cinematic',
    description: 'High contrast silver retention — desaturated with punchy midtones',
    generate: () => generateLut(17, (r, g, b) => {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Blend toward luminance (desaturate) + strong contrast
      const blend = 0.55;
      const nr = r * (1 - blend) + luma * blend;
      const ng = g * (1 - blend) + luma * blend;
      const nb = b * (1 - blend) + luma * blend;
      return [sCurve(nr, 0.5), sCurve(ng, 0.5), sCurve(nb, 0.5)];
    }),
  },
  {
    id: 'film-print',
    name: 'Film Print',
    category: 'vintage',
    description: 'Emulates Kodak Portra 400 — slightly warm, slight grain palette shift',
    generate: () => generateLut(17, (r, g, b) => {
      // Kodak Portra: warm shadows, cyan-shifted highlights, slight orange cast
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const warmR = r + (1 - luma) * 0.04 + luma * 0.06;
      const warmG = g + (1 - luma) * 0.01;
      const warmB = b - (1 - luma) * 0.03 + luma * 0.03;
      return [
        Math.min(1, sCurve(warmR, 0.15)),
        Math.min(1, sCurve(warmG, 0.15)),
        Math.min(1, sCurve(warmB, 0.1)),
      ];
    }),
  },
  {
    id: 'fuji-provia',
    name: 'Fuji Provia',
    category: 'vintage',
    description: 'Vibrant, punchy slide film look — greens and blues pop',
    generate: () => generateLut(17, (r, g, b) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      // Fuji: boost cool tones (blues, greens), slight cyan push
      const isCool = h > 0.3 && h < 0.7;
      const ns = Math.min(1, s * (isCool ? 1.3 : 1.05));
      let nh = h;
      if (isCool) nh = h - 0.02; // slight cyan shift
      const [nr, ng, nb] = hslToRgb(nh, ns, sCurve(l, 0.2));
      return [nr, ng, nb];
    }),
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'bw',
    description: 'Deep black and white — high contrast with rich shadow detail',
    generate: () => generateLut(17, (r, g, b) => {
      // Luminosity with weighted channel mix (like Ilford HP5)
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const contrast = sCurve(luma, 0.4);
      return [contrast, contrast, contrast];
    }),
  },
  {
    id: 'emerald-city',
    name: 'Emerald City',
    category: 'creative',
    description: 'Lush green palette — cinematic jungle and nature grade',
    generate: () => generateLut(17, (r, g, b) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      // Boost greens and yellows, cool blues slightly
      const isGreen = h > 0.22 && h < 0.5;
      const ns = Math.min(1, s * (isGreen ? 1.4 : 0.95));
      let nh = isGreen ? h - 0.03 : h; // shift toward green
      const nl = isGreen ? l * 1.05 : l;
      const [nr, ng, nb] = hslToRgb(nh, ns, sCurve(Math.min(1, nl), 0.2));
      // Cool down shadows
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return [nr, ng + 0.01, nb + (1 - luma) * 0.04];
    }),
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    category: 'portrait',
    description: 'Soft warm pink-gold glow — flattering for portraits and fashion',
    generate: () => generateLut(17, (r, g, b) => {
      // Rose gold: warm pinks, lifted shadows, soft highlights
      const lift = 0.04;
      const nr = Math.min(1, r * 1.05 + lift + 0.02);
      const ng = Math.min(1, g * 0.98 + lift);
      const nb = Math.min(1, b * 0.90 + lift - 0.01);
      return [sCurve(nr, 0.1), sCurve(ng, 0.1), sCurve(nb, 0.1)];
    }),
  },
  {
    id: 'arctic-blue',
    name: 'Arctic Blue',
    category: 'creative',
    description: 'Cool desaturated blue grade — perfect for winter and sci-fi',
    generate: () => generateLut(17, (r, g, b) => {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Desaturate + push toward blue
      const desatBlend = 0.35;
      const nr = r * (1 - desatBlend) + luma * desatBlend - luma * 0.04;
      const ng = g * (1 - desatBlend) + luma * desatBlend - luma * 0.02;
      const nb = b * (1 - desatBlend) + luma * desatBlend + luma * 0.08;
      return [
        Math.max(0, Math.min(1, sCurve(nr, 0.2))),
        Math.max(0, Math.min(1, sCurve(ng, 0.2))),
        Math.max(0, Math.min(1, sCurve(nb, 0.15))),
      ];
    }),
  },
];

// Cache for lazy-generated LUT data
const lutCache = new Map<string, LutData>();

export function getBuiltinLutData(id: string): LutData | null {
  if (lutCache.has(id)) return lutCache.get(id)!;
  const builtin = BUILTIN_LUTS.find(l => l.id === id);
  if (!builtin) return null;
  const data = builtin.generate();
  data.title = builtin.name;
  lutCache.set(id, data);
  return data;
}

// ── Export .cube file from LutData ───────────────────────────────────────────

export function exportToCubeFile(lut: LutData, title?: string): string {
  const lines: string[] = [
    `TITLE "${title || lut.title || 'Exported LUT'}"`,
    ``,
    `# Generated by Prism`,
    `# LUT size: ${lut.size}`,
    ``,
    `LUT_3D_SIZE ${lut.size}`,
    ``,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
    ``,
  ];

  for (let i = 0; i < lut.table.length; i += 3) {
    const r = lut.table[i].toFixed(6);
    const g = lut.table[i + 1].toFixed(6);
    const b = lut.table[i + 2].toFixed(6);
    lines.push(`${r} ${g} ${b}`);
  }
  return lines.join('\n');
}
