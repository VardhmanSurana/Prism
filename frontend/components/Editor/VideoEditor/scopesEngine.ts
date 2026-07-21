/**
 * scopesEngine.ts — High-performance real-time Color Grading Scopes.
 * Calculates and renders Luma Waveform, RGB Parade, and Cb/Cr Vectorscope
 * from a WebGL or 2D HTMLCanvasElement.
 */

export type ScopeMode = 'waveform' | 'rgbParade' | 'vectorscope' | 'all';

export interface ScopeOptions {
  mode: ScopeMode;
  gain?: number; // Brightness multiplier for scope trace (0.5 to 3.0)
  showGraticule?: boolean;
}

// Sample canvas for downsampling video frames
let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;

function getSampleCtx(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
  }
  if (sampleCanvas.width !== width || sampleCanvas.height !== height) {
    sampleCanvas.width = width;
    sampleCanvas.height = height;
  }
  if (!sampleCtx) {
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sampleCtx;
}

/**
 * Render selected scope onto target canvas.
 */
export function renderColorScope(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  options: ScopeOptions
) {
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx || !sourceCanvas.width || !sourceCanvas.height) return;

  const width = targetCanvas.width;
  const height = targetCanvas.height;

  // Clear target background
  targetCtx.fillStyle = '#0e0e0e';
  targetCtx.fillRect(0, 0, width, height);

  // Downsample source frame to ~256x144 for ultra-fast processing
  const sampleW = 256;
  const sampleH = 144;
  const sCtx = getSampleCtx(sampleW, sampleH);
  if (!sCtx) return;

  try {
    sCtx.drawImage(sourceCanvas, 0, 0, sampleW, sampleH);
  } catch (e) {
    // Canvas might be tainted or detached
    return;
  }

  const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const gain = options.gain ?? 1.2;

  switch (options.mode) {
    case 'waveform':
      drawLumaWaveform(targetCtx, data, sampleW, sampleH, width, height, gain, options.showGraticule ?? true);
      break;
    case 'rgbParade':
      drawRGBParade(targetCtx, data, sampleW, sampleH, width, height, gain, options.showGraticule ?? true);
      break;
    case 'vectorscope':
      drawVectorscope(targetCtx, data, sampleW, sampleH, width, height, gain, options.showGraticule ?? true);
      break;
    case 'all':
      drawAllScopes(targetCtx, data, sampleW, sampleH, width, height, gain);
      break;
  }
}

/**
 * Draw Luma (Y) Waveform (0 to 100 IRE)
 */
function drawLumaWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  sw: number,
  sh: number,
  tw: number,
  th: number,
  gain: number,
  showGraticule: boolean
) {
  const padding = 24; // Left/Right padding for IRE labels
  const plotW = tw - padding * 2;
  const plotH = th - 20;
  const plotTop = 10;
  const plotLeft = padding;

  if (showGraticule) {
    drawWaveformGraticule(ctx, plotLeft, plotTop, plotW, plotH, tw);
  }

  // Accumator array: [plotH * plotW]
  const countBuffer = new Uint16Array(plotW * plotH);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // ITU-R BT.709 Luma calculation
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255

      // Map to plot coordinates
      const px = Math.floor((x / sw) * plotW);
      const py = Math.floor((1 - luma / 255) * (plotH - 1));

      if (px >= 0 && px < plotW && py >= 0 && py < plotH) {
        countBuffer[py * plotW + px]++;
      }
    }
  }

  // Create output image pixels
  const outputImg = ctx.createImageData(plotW, plotH);
  const outData = outputImg.data;

  for (let i = 0; i < countBuffer.length; i++) {
    const count = countBuffer[i];
    if (count > 0) {
      const intensity = Math.min(255, Math.pow(count * gain * 8, 0.75));
      const pixelIdx = i * 4;
      outData[pixelIdx] = Math.min(255, intensity * 0.2);     // R
      outData[pixelIdx + 1] = Math.min(255, intensity * 1.0); // G (Phosphor Green)
      outData[pixelIdx + 2] = Math.min(255, intensity * 0.6); // B
      outData[pixelIdx + 3] = Math.min(255, intensity * 1.2); // Alpha
    }
  }

  ctx.putImageData(outputImg, plotLeft, plotTop);
}

/**
 * Draw Waveform Graticule (0%, 25%, 50%, 75%, 100% / IRE)
 */
function drawWaveformGraticule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  totalWidth: number
) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';

  const ireLevels = [
    { label: '100', ratio: 0 },
    { label: '75', ratio: 0.25 },
    { label: '50', ratio: 0.5 },
    { label: '25', ratio: 0.75 },
    { label: '0', ratio: 1.0 },
  ];

  for (const level of ireLevels) {
    const lineY = y + level.ratio * (h - 1);

    ctx.strokeStyle = level.ratio === 0 || level.ratio === 1.0 ? '#3a3a3a' : '#222222';
    ctx.setLineDash(level.ratio === 0 || level.ratio === 1.0 ? [] : [2, 2]);

    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + w, lineY);
    ctx.stroke();

    ctx.fillStyle = '#666';
    ctx.fillText(level.label, x - 4, lineY + 3);
  }

  ctx.restore();
}

/**
 * Draw RGB Parade (R, G, B side-by-side)
 */
function drawRGBParade(
  ctx: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  sw: number,
  sh: number,
  tw: number,
  th: number,
  gain: number,
  showGraticule: boolean
) {
  const paddingLeft = 20;
  const gap = 8;
  const availableW = tw - paddingLeft - gap * 2 - 8;
  const sectionW = Math.floor(availableW / 3);
  const plotH = th - 20;
  const plotTop = 10;

  const channels = [
    { name: 'RED', color: [255, 60, 60], offset: 0 },
    { name: 'GREEN', color: [40, 220, 90], offset: 1 },
    { name: 'BLUE', color: [60, 140, 255], offset: 2 },
  ];

  channels.forEach((ch, cIdx) => {
    const sectionX = paddingLeft + cIdx * (sectionW + gap);

    if (showGraticule) {
      drawWaveformGraticule(ctx, sectionX, plotTop, sectionW, plotH, tw);
      ctx.fillStyle = ch.name === 'RED' ? '#ef4444' : ch.name === 'GREEN' ? '#22c55e' : '#3b82f6';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ch.name, sectionX + sectionW / 2, plotTop - 2);
    }

    const countBuffer = new Uint16Array(sectionW * plotH);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const val = data[(y * sw + x) * 4 + ch.offset]; // R, G, or B

        const px = Math.floor((x / sw) * sectionW);
        const py = Math.floor((1 - val / 255) * (plotH - 1));

        if (px >= 0 && px < sectionW && py >= 0 && py < plotH) {
          countBuffer[py * sectionW + px]++;
        }
      }
    }

    const outputImg = ctx.createImageData(sectionW, plotH);
    const outData = outputImg.data;

    for (let i = 0; i < countBuffer.length; i++) {
      const count = countBuffer[i];
      if (count > 0) {
        const intensity = Math.min(255, Math.pow(count * gain * 12, 0.75));
        const pixelIdx = i * 4;
        outData[pixelIdx] = Math.min(255, (ch.color[0] / 255) * intensity);
        outData[pixelIdx + 1] = Math.min(255, (ch.color[1] / 255) * intensity);
        outData[pixelIdx + 2] = Math.min(255, (ch.color[2] / 255) * intensity);
        outData[pixelIdx + 3] = Math.min(255, intensity * 1.3);
      }
    }

    ctx.putImageData(outputImg, sectionX, plotTop);
  });
}

/**
 * Draw Cb/Cr Vectorscope with Rec.709 color target boxes & Skin Tone line
 */
function drawVectorscope(
  ctx: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  sw: number,
  sh: number,
  tw: number,
  th: number,
  gain: number,
  showGraticule: boolean
) {
  const size = Math.min(tw, th) - 20;
  const cx = Math.floor(tw / 2);
  const cy = Math.floor(th / 2);
  const radius = Math.floor(size / 2);

  if (showGraticule) {
    drawVectorscopeGraticule(ctx, cx, cy, radius);
  }

  // Draw vector trace directly using canvas arc / imageData around center
  const vSize = radius * 2;
  const vLeft = cx - radius;
  const vTop = cy - radius;

  const countBuffer = new Uint16Array(vSize * vSize);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Convert RGB to Cb/Cr (Range: -128..127)
      const cb = -0.168736 * r - 0.331264 * g + 0.500000 * b;
      const cr = 0.500000 * r - 0.418688 * g - 0.081312 * b;

      // Scale to radius (128 max chroma -> radius)
      const vx = Math.floor((cb / 128) * (radius - 10)) + radius;
      const vy = Math.floor((-cr / 128) * (radius - 10)) + radius; // Invert Y

      if (vx >= 0 && vx < vSize && vy >= 0 && vy < vSize) {
        countBuffer[vy * vSize + vx]++;
      }
    }
  }

  const outputImg = ctx.getImageData(vLeft, vTop, vSize, vSize);
  const outData = outputImg.data;

  for (let i = 0; i < countBuffer.length; i++) {
    const count = countBuffer[i];
    if (count > 0) {
      const intensity = Math.min(255, Math.pow(count * gain * 10, 0.75));
      const pixelIdx = i * 4;
      // Vibrant yellow/cyan vector phosphor glow
      outData[pixelIdx] = Math.min(255, outData[pixelIdx] + intensity * 0.9);
      outData[pixelIdx + 1] = Math.min(255, outData[pixelIdx + 1] + intensity * 1.0);
      outData[pixelIdx + 2] = Math.min(255, outData[pixelIdx + 2] + intensity * 0.4);
      outData[pixelIdx + 3] = 255;
    }
  }

  ctx.putImageData(outputImg, vLeft, vTop);
}

/**
 * Draw Vectorscope Graticule (Target boxes & skin-tone line)
 */
function drawVectorscopeGraticule(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();

  // Outer reference circle (100% chroma) & Inner circle (75% chroma)
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#222';
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.arc(cx, cy, (radius - 10) * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - radius + 10, cy);
  ctx.lineTo(cx + radius - 10, cy);
  ctx.moveTo(cx, cy - radius + 10);
  ctx.lineTo(cx, cy + radius - 10);
  ctx.stroke();

  // Skin-tone line (I-axis / approx 123 degrees -> -Cr / Cb ratio)
  // Skin tone line angle in Cb/Cr is at approx angle = 123 deg from +Cb axis
  const skinAngle = (123 * Math.PI) / 180;
  const skinLen = radius - 10;
  const skinX = cx + Math.cos(skinAngle) * skinLen;
  const skinY = cy - Math.sin(skinAngle) * skinLen;

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'; // Amber yellow skin tone indicator
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(skinX, skinY);
  ctx.stroke();

  ctx.fillStyle = '#eab308';
  ctx.font = '8px sans-serif';
  ctx.fillText('SKIN', skinX + (skinX > cx ? 2 : -22), skinY + (skinY > cy ? 10 : -4));

  // Rec.709 75% Primary & Secondary Target Boxes
  // Positions in normalized Cb, Cr (-1..1):
  const targets = [
    { label: 'R', cb: -0.1146 / 0.75, cr: 0.5000 / 0.75, color: '#ef4444' },
    { label: 'Mg', cb: 0.3854 / 0.75, cr: 0.4187 / 0.75, color: '#ec4899' },
    { label: 'B', cb: 0.5000 / 0.75, cr: -0.0813 / 0.75, color: '#3b82f6' },
    { label: 'Cy', cb: 0.1146 / 0.75, cr: -0.5000 / 0.75, color: '#06b6d4' },
    { label: 'G', cb: -0.3854 / 0.75, cr: -0.4187 / 0.75, color: '#22c55e' },
    { label: 'Yl', cb: -0.5000 / 0.75, cr: 0.0813 / 0.75, color: '#eab308' },
  ];

  const targetBoxSize = 8;
  const rScale = (radius - 10) * 0.75;

  targets.forEach((t) => {
    const tx = cx + t.cb * rScale;
    const ty = cy - t.cr * rScale;

    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - targetBoxSize / 2, ty - targetBoxSize / 2, targetBoxSize, targetBoxSize);

    ctx.fillStyle = '#aaa';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, tx, ty - targetBoxSize / 2 - 2);
  });

  ctx.restore();
}

/**
 * Draw All 3 Scopes in a 2x2 multi-view layout
 */
function drawAllScopes(
  ctx: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  sw: number,
  sh: number,
  tw: number,
  th: number,
  gain: number
) {
  const halfW = Math.floor(tw / 2);
  const halfH = Math.floor(th / 2);

  // Top-left: Luma Waveform
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, halfW, halfH);
  ctx.clip();
  drawLumaWaveform(ctx, data, sw, sh, halfW, halfH, gain, true);
  ctx.restore();

  // Top-right: Vectorscope
  ctx.save();
  ctx.beginPath();
  ctx.rect(halfW, 0, halfW, halfH);
  ctx.clip();
  ctx.translate(halfW, 0);
  drawVectorscope(ctx, data, sw, sh, halfW, halfH, gain, true);
  ctx.restore();

  // Bottom: RGB Parade (full width)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, halfH, tw, halfH);
  ctx.clip();
  ctx.translate(0, halfH);
  drawRGBParade(ctx, data, sw, sh, tw, halfH, gain, true);
  ctx.restore();
}
