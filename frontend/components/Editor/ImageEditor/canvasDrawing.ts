import { Adjustments, HslBand, toFilterString } from './filterEngine';
import { isIdentityCurve } from './curves';
import { applyHslToImageData, applySpecializedCurvesToImageData } from './hslEngine';
import { applyColorWheelsToImageData } from './colorWheelsEngine';
import { applyLutToImageData, getBuiltinLutData } from './lutEngine';
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
  applyDefringeAndOpticalVignetting,
  applyBackgroundReplacementToCanvas,
} from './exportPipeline';
import { isCtxFilterSupported, applyBaseFiltersToImageData, applyNonLinearHighlightsAndShadows, applyTemperatureAndTintToImageData } from './filterFallback';
import { applyRawProcessingToImageData } from './rawEngine';
import { applyPortraitToImageData, LoadedPortraitMasks } from './portraitEngine';

export function drawFilteredImageToCanvas(
  canvas: HTMLCanvasElement,
  sourceImg: HTMLImageElement,
  blendImg: HTMLImageElement | null,
  adjustments: Adjustments,
  curvesTable: { r: string; g: string; b: string },
  isDraggingSlider: boolean,
  portraitMasks?: LoadedPortraitMasks,
  backgroundMaskImg?: HTMLImageElement | null,
  customBackdropImg?: HTMLImageElement | null,
) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  if (!sourceImg || sourceImg.naturalWidth <= 0 || sourceImg.naturalHeight <= 0) {
    return;
  }

  // 1. Full native image resolution for 100% pixel-perfect sharpness
  // (Proxy-scale to 1200px only during active 60fps slider dragging for responsiveness)
  const maxDim = isDraggingSlider ? 1200 : Math.max(sourceImg.naturalWidth, sourceImg.naturalHeight);

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

  if (drawW <= 0 || drawH <= 0) return;

  if (canvas.width !== drawW || canvas.height !== drawH) {
    canvas.width = drawW;
    canvas.height = drawH;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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

  const localFilterString = toFilterString(effectiveAdj);
  const canvasSafeFilter = localFilterString
    .replace(/url\([^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'none';

  // 3. Draw base image with CSS filters.
  if (canvasSafeFilter === 'none') {
    ctx.drawImage(sourceImg, 0, 0, drawW, drawH);
  } else if (isCtxFilterSupported()) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawW;
    tempCanvas.height = drawH;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
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

  // 3.3. Apply True Color Temperature & Tint (Warmth/Coolness without hue distortion)
  if (isCtxFilterSupported() && ((adjustments.temperature ?? 0) !== 0 || (adjustments.tint ?? 0) !== 0)) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyTemperatureAndTintToImageData(imgData, adjustments.temperature, adjustments.tint);
    ctx.putImageData(imgData, 0, 0);
  }

  // 3.4. Apply Camera RAW Development (Kelvin White Balance, Tint, EV Exposure, Highlight Recovery, Wavelet Denoise)
  if (adjustments.raw) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyRawProcessingToImageData(imgData, adjustments.raw);
    ctx.putImageData(imgData, 0, 0);
  }

  // 3.5. Apply Non-linear Highlights and Shadows
  if (adjustments.highlights !== 0 || adjustments.shadows !== 0) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyNonLinearHighlightsAndShadows(imgData, adjustments.highlights, adjustments.shadows);
    ctx.putImageData(imgData, 0, 0);
  }

  // 3.6. AI Portrait Retouching Studio (Skin, Eyes, Teeth, Lips, Eyebrows)
  if (adjustments.portrait && portraitMasks) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyPortraitToImageData(imgData, adjustments.portrait, portraitMasks);
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

  // 6.2. Specialized Color Curves (Hue vs Hue, Hue vs Sat, etc.)
  if (adjustments.specializedCurves) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applySpecializedCurvesToImageData(imgData, adjustments.specializedCurves);
    ctx.putImageData(imgData, 0, 0);
  }

  // 6.4. Professional 3-Way & Log Color Wheels
  if (adjustments.colorWheels) {
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    applyColorWheelsToImageData(imgData, adjustments.colorWheels);
    ctx.putImageData(imgData, 0, 0);
  }

  // 6.5. LUT (3D Look-Up Table) — Canvas2D pixel-based, no SVG filter overhead
  if (adjustments.lut && (adjustments.lut.builtinId || adjustments.lut.customData)) {
    const lutData = adjustments.lut.customData || getBuiltinLutData(adjustments.lut.builtinId!);
    if (lutData) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const opacity = (adjustments.lut.opacity ?? 100) / 100;
      const result = applyLutToImageData(imgData, lutData, opacity);
      ctx.putImageData(result, 0, 0);
    }
  }

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

  // 7.5. Defringe & Cosine-Fourth Vignetting
  if (adjustments.defringe) {
    applyDefringeAndOpticalVignetting(canvas, adjustments.defringe);
  }

  // 8. Split Toning
  applySplitToning(canvas, adjustments);

  // 9. Film Grain
  applyGrain(canvas, adjustments);

  // 10. Light Leaks
  // 10.5. AI Background Cutout & Backdrop Replacement
  if (adjustments.background?.enabled && backgroundMaskImg) {
    applyBackgroundReplacementToCanvas(canvas, adjustments.background, backgroundMaskImg, customBackdropImg);
  }

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
