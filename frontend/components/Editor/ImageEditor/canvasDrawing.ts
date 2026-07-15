import { Adjustments, HslBand, toFilterString } from './filterEngine';
import { isIdentityCurve } from './curves';
import { applyHslToImageData } from './hslEngine';
import {
  applySplitToning,
  applyGrain,
  applyLightLeak,
  applyTiltShift,
  applyVignette,
  drawBlendOverlay,
  applyUnsharpMask,
  applyCurveLutsToCanvas,
  applyBlur,
  applyLensCorrection,
} from './exportPipeline';
import { isCtxFilterSupported, applyBaseFiltersToImageData, applyNonLinearHighlightsAndShadows } from './filterFallback';

export function drawFilteredImageToCanvas(
  canvas: HTMLCanvasElement,
  sourceImg: HTMLImageElement,
  blendImg: HTMLImageElement | null,
  adjustments: Adjustments,
  isComparing: boolean,
  curvesTable: { r: string; g: string; b: string },
  isDraggingSlider: boolean
) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // 1. Calculate internal resolution (max bounding size of 1000px for speed)
  // Reduce resolution to 450px during active slider drag for 60fps real-time preview.
  const maxDim = isDraggingSlider ? 450 : 1000;
  let drawW = sourceImg.naturalWidth;
  let drawH = sourceImg.naturalHeight;
  if (drawW > maxDim || drawH > maxDim) {
    if (drawW > drawH) {
      drawH = Math.round((drawH * maxDim) / drawW);
      drawW = maxDim;
    } else {
      drawW = Math.round((drawW * maxDim) / drawH);
      drawH = maxDim;
    }
  }

  if (canvas.width !== drawW || canvas.height !== drawH) {
    canvas.width = drawW;
    canvas.height = drawH;
  }

  ctx.clearRect(0, 0, drawW, drawH);

  // 2. Build a canvas-safe filter string with guarded adjustments.
  const noise = adjustments.noiseReduction || 0;
  const sharp = adjustments.sharpness || 0;
  const effectiveNoise = Math.max(0, noise - sharp * 0.5);
  const effectiveSharp = sharp > 0 ? Math.max(0, sharp - noise * 0.5) : sharp;

  const effectiveAdj = {
    ...adjustments,
    noiseReduction: effectiveNoise,
    sharpness: effectiveSharp,
  };

  const localFilterString = isComparing ? 'none' : toFilterString(effectiveAdj);
  const canvasSafeFilter = localFilterString
    .replace(/url\([^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'none';

  // 3. Draw base image with CSS filters.
  if (isComparing || canvasSafeFilter === 'none') {
    ctx.drawImage(sourceImg, 0, 0, drawW, drawH);
  } else if (isCtxFilterSupported()) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawW;
    tempCanvas.height = drawH;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.filter = canvasSafeFilter;
    tempCtx.drawImage(sourceImg, 0, 0, drawW, drawH);
    tempCtx.filter = 'none';
    ctx.drawImage(tempCanvas, 0, 0);
  } else {
    ctx.drawImage(sourceImg, 0, 0, drawW, drawH);
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyBaseFiltersToImageData(imgData, effectiveAdj);
    ctx.putImageData(imgData, 0, 0);
  }

  if (isComparing) {
    return; // Show original only — skip all effects
  }

  // 3.5. Apply Non-linear Highlights and Shadows
  if (adjustments.highlights !== 0 || adjustments.shadows !== 0) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyNonLinearHighlightsAndShadows(imgData, adjustments.highlights, adjustments.shadows);
    ctx.putImageData(imgData, 0, 0);
  }

  // 4. Noise reduction
  if (effectiveSharp < 0) {
    const softenBlur = Math.abs(effectiveSharp) / 100 * 1.5;
    applyBlur(canvas, softenBlur);
  }

  // 5. Sharpness
  if (effectiveSharp > 0) {
    applyUnsharpMask(canvas, effectiveSharp, 1.2, 2.5);
  }

  // 6. Curves
  applyCurveLutsToCanvas(canvas, adjustments);

  // 7. HSL Color Mixer
  if (adjustments.hsl) {
    const activeBands = (Object.keys(adjustments.hsl) as HslBand[]).filter(band => {
      const b = adjustments.hsl![band];
      return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
    });
    if (activeBands.length > 0) {
      const imgData = ctx.getImageData(0, 0, drawW, drawH);
      applyHslToImageData(imgData, adjustments.hsl);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  // 8. Split Toning
  applySplitToning(canvas, adjustments);

  // 9. Film Grain
  applyGrain(canvas, adjustments);

  // 10. Light Leaks
  applyLightLeak(canvas, adjustments);

  // 11. Double Exposure
  if (adjustments.blend && blendImg) {
    drawBlendOverlay(canvas, blendImg, adjustments.blend);
  }

  // 12. Tilt-Shift depth blur
  applyTiltShift(canvas, adjustments);

  // 13. Vignette
  applyVignette(canvas, adjustments.vignette);

  // 13.5. Lens Distortion Correction
  if (adjustments.distortion !== 0) {
    applyLensCorrection(canvas, adjustments.distortion, false);
  }

  // 14. Frame border preview
  const frame = adjustments.frame;
  if (frame && frame.style !== 'none') {
    const ctx2 = canvas.getContext('2d');
    if (ctx2) {
      ctx2.save();
      const w = canvas.width;
      const h = canvas.height;
      const border = Math.max(w, h) * (frame.thickness / 100) * 0.6;

      if (frame.style === 'polaroid') {
        ctx2.fillStyle = '#f8f8f6';
        ctx2.fillRect(0, 0, w, border);
        ctx2.fillRect(0, h - border * 3.5, w, border * 3.5);
        ctx2.fillRect(0, 0, border, h);
        ctx2.fillRect(w - border, 0, border, h);
      } else if (frame.style === 'matte') {
        ctx2.fillStyle = frame.color;
        ctx2.fillRect(0, 0, w, border);
        ctx2.fillRect(0, h - border, w, border);
        ctx2.fillRect(0, 0, border, h);
        ctx2.fillRect(w - border, 0, border, h);
      } else if (frame.style === 'filmstrip') {
        const barH = Math.round(h * 0.12);
        ctx2.fillStyle = '#080808';
        ctx2.fillRect(0, 0, w, barH);
        ctx2.fillRect(0, h - barH, w, barH);
        const spW = Math.max(8, w * 0.018);
        const spH = barH * 0.45;
        const gap = spW * 1.5;
        ctx2.fillStyle = '#1c1c1c';
        for (let x = gap / 2; x < w; x += spW + gap) {
          ctx2.beginPath();
          ctx2.roundRect(x, barH * 0.25, spW, spH, 2);
          ctx2.fill();
          ctx2.beginPath();
          ctx2.roundRect(x, h - barH * 0.7, spW, spH, 2);
          ctx2.fill();
        }
      } else if (frame.style === 'rounded') {
        const r = Math.min(w, h) * 0.05;
        ctx2.globalCompositeOperation = 'destination-in';
        ctx2.beginPath();
        ctx2.roundRect(0, 0, w, h, r);
        ctx2.fill();
      } else if (frame.style === 'thinline') {
        ctx2.strokeStyle = frame.color;
        ctx2.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
        ctx2.strokeRect(0, 0, w, h);
      } else if (frame.style === 'shadowbox') {
        const grad = ctx2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.65);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx2.globalCompositeOperation = 'source-over';
        ctx2.fillStyle = grad;
        ctx2.fillRect(0, 0, w, h);
      }
      ctx2.restore();
    }
  }
}
