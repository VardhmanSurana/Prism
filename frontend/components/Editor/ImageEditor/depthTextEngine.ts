/**
 * depthTextEngine.ts
 * Core engine for Depth Typography (Text Behind Subject).
 * Composites typography between background and foreground subject cutouts,
 * with support for dual-pass front-layer holographic strokes and interactive positioning.
 */

export interface DepthTextSettings {
  enabled: boolean;
  text: string;
  fontFamily: string;
  fontSize: number; // 20 -> 240
  fontWeight: '300' | '400' | '600' | '700' | '800' | '900' | string;
  letterSpacing: number; // -10 -> 40 px
  lineHeight: number; // 0.8 -> 2.0
  textAlign: 'left' | 'center' | 'right';
  textTransform: 'none' | 'uppercase' | 'lowercase';
  x: number; // 0 -> 100 percentage of image width
  y: number; // 0 -> 100 percentage of image height
  rotation: number; // -180 -> 180 degrees
  fillColor: string;
  fillOpacity: number; // 0 -> 100
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number; // 1 -> 20
  strokePlacement: 'front' | 'behind' | 'both';
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number; // 0 -> 50
  shadowOffsetX: number;
  shadowOffsetY: number;
  maskSource: 'auto' | 'sam';
  maskUrl?: string | null;
  maskData?: string | null;
}

export const DEFAULT_DEPTH_TEXT_SETTINGS: DepthTextSettings = {
  enabled: false,
  text: 'NEVER\nGIVE\nUP',
  fontFamily: 'Anton',
  fontSize: 110,
  fontWeight: '900',
  letterSpacing: 2,
  lineHeight: 0.95,
  textAlign: 'center',
  textTransform: 'uppercase',
  x: 50,
  y: 45,
  rotation: 0,
  fillColor: '#e4e4e7',
  fillOpacity: 90,
  strokeEnabled: true,
  strokeColor: '#22c55e',
  strokeWidth: 3,
  strokePlacement: 'front',
  shadowEnabled: true,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 20,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  maskSource: 'auto',
  maskUrl: null,
  maskData: null,
};

export interface DepthTextPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<DepthTextSettings>;
}

export const DEPTH_TEXT_PRESETS: DepthTextPreset[] = [
  {
    id: 'gym-motivation',
    name: 'Gym Motivation',
    description: 'Solid light gray text behind + neon green outline in front',
    settings: {
      text: 'NEVER\nGIVE\nUP',
      fontFamily: 'Anton',
      fontSize: 110,
      fontWeight: '900',
      letterSpacing: 2,
      lineHeight: 0.92,
      textAlign: 'center',
      textTransform: 'uppercase',
      fillColor: '#d4d4d8',
      fillOpacity: 85,
      strokeEnabled: true,
      strokeColor: '#22c55e',
      strokeWidth: 3,
      strokePlacement: 'front',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Electric cyan fill behind + hot pink outline in front',
    settings: {
      text: 'CYBER\nPUNK',
      fontFamily: 'Bebas Neue',
      fontSize: 120,
      fontWeight: '900',
      letterSpacing: 4,
      lineHeight: 0.95,
      textAlign: 'center',
      textTransform: 'uppercase',
      fillColor: '#06b6d4',
      fillOpacity: 90,
      strokeEnabled: true,
      strokeColor: '#ec4899',
      strokeWidth: 4,
      strokePlacement: 'front',
    },
  },
  {
    id: 'vogue-editorial',
    name: 'Vogue Editorial',
    description: 'High-fashion serif magazine style with wide letter-spacing',
    settings: {
      text: 'ELEGANCE',
      fontFamily: 'Playfair Display',
      fontSize: 85,
      fontWeight: '700',
      letterSpacing: 10,
      lineHeight: 1.1,
      textAlign: 'center',
      textTransform: 'uppercase',
      fillColor: '#f5f5f4',
      fillOpacity: 95,
      strokeEnabled: false,
    },
  },
  {
    id: 'cinematic-gold',
    name: 'Cinematic Gold',
    description: 'Warm gold typography with deep volumetric drop shadow',
    settings: {
      text: 'ORIGINS',
      fontFamily: 'Montserrat',
      fontSize: 90,
      fontWeight: '800',
      letterSpacing: 12,
      lineHeight: 1.0,
      textAlign: 'center',
      textTransform: 'uppercase',
      fillColor: '#fbbf24',
      fillOpacity: 90,
      strokeEnabled: true,
      strokeColor: '#f59e0b',
      strokeWidth: 2,
      strokePlacement: 'behind',
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 25,
    },
  },
  {
    id: 'street-bold',
    name: 'Streetwear Bold',
    description: 'Heavy stark white typography with dual pass front & back stroke',
    settings: {
      text: 'STREET\nLEGEND',
      fontFamily: 'Space Grotesk',
      fontSize: 100,
      fontWeight: '900',
      letterSpacing: 3,
      lineHeight: 0.95,
      textAlign: 'center',
      textTransform: 'uppercase',
      fillColor: '#ffffff',
      fillOpacity: 90,
      strokeEnabled: true,
      strokeColor: '#ffffff',
      strokeWidth: 2.5,
      strokePlacement: 'both',
    },
  },
];

/**
 * Helper to render multi-line text with custom letter-spacing on HTML5 2D Canvas.
 */
function renderCustomTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startX: number,
  startY: number,
  lineHeightPx: number,
  letterSpacingPx: number,
  textAlign: 'left' | 'center' | 'right',
  mode: 'fill' | 'stroke' | 'both',
) {
  lines.forEach((line, lineIndex) => {
    const y = startY + lineIndex * lineHeightPx;

    if (letterSpacingPx === 0) {
      if (mode === 'fill' || mode === 'both') ctx.fillText(line, startX, y);
      if (mode === 'stroke' || mode === 'both') ctx.strokeText(line, startX, y);
      return;
    }

    // Letter-by-letter rendering for custom tracking
    const characters = Array.from(line);
    const charWidths = characters.map(c => ctx.measureText(c).width);
    const totalLineWidth = charWidths.reduce((sum, w) => sum + w, 0) + (characters.length - 1) * letterSpacingPx;

    let currentX = startX;
    if (textAlign === 'center') {
      currentX = startX - totalLineWidth / 2;
    } else if (textAlign === 'right') {
      currentX = startX - totalLineWidth;
    }

    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';

    characters.forEach((char, charIdx) => {
      if (mode === 'fill' || mode === 'both') ctx.fillText(char, currentX, y);
      if (mode === 'stroke' || mode === 'both') ctx.strokeText(char, currentX, y);
      currentX += charWidths[charIdx] + letterSpacingPx;
    });

    ctx.textAlign = prevAlign;
  });
}

/**
 * Composites Depth Typography (Text Behind Subject) onto the canvas.
 * Multi-pass pipeline:
 * 1. Backing scene (canvas base)
 * 2. Behind-subject Text Fill (+ optional behind stroke)
 * 3. Cutout Subject overlay via SAM/matting alpha mask
 * 4. Front-subject Text Stroke (holographic front outline)
 */
export function drawDepthTextToCanvas(
  canvas: HTMLCanvasElement,
  settings: DepthTextSettings,
  maskImage: HTMLImageElement | HTMLCanvasElement | null,
) {
  if (!settings.enabled || !settings.text || settings.text.trim().length === 0) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w <= 0 || h <= 0) return;

  // 1. Snapshot the initial background image before text is applied
  const bgSnapshot = document.createElement('canvas');
  bgSnapshot.width = w;
  bgSnapshot.height = h;
  const bgSnapshotCtx = bgSnapshot.getContext('2d', { willReadFrequently: true });
  if (!bgSnapshotCtx) return;
  bgSnapshotCtx.drawImage(canvas, 0, 0);

  // 2. Prepare text lines and layout
  let rawText = settings.text;
  if (settings.textTransform === 'uppercase') rawText = rawText.toUpperCase();
  if (settings.textTransform === 'lowercase') rawText = rawText.toLowerCase();
  const lines = rawText.split('\n');

  // Scale font size proportionally to canvas width (standardized on 1000px base)
  const scale = Math.min(w, h) / 1000;
  const computedFontSize = Math.max(12, Math.round(settings.fontSize * scale));
  const letterSpacingPx = (settings.letterSpacing || 0) * scale;
  const lineHeightPx = computedFontSize * (settings.lineHeight || 1.0);

  const posX = (settings.x / 100) * w;
  const posY = (settings.y / 100) * h;
  const totalTextHeight = lines.length * lineHeightPx;
  const startY = posY - totalTextHeight / 2 + computedFontSize * 0.8;

  // Helper to configure text style on a context
  const applyFontStyles = (targetCtx: CanvasRenderingContext2D) => {
    targetCtx.font = `${settings.fontWeight || '900'} ${computedFontSize}px "${settings.fontFamily || 'Anton'}", sans-serif`;
    targetCtx.textAlign = settings.textAlign;
    targetCtx.textBaseline = 'alphabetic';
  };

  // 3. Render Pass 1: Text Behind Subject (Fill + optional Behind Stroke)
  ctx.save();
  ctx.translate(posX, posY);
  if (settings.rotation !== 0) {
    ctx.rotate((settings.rotation * Math.PI) / 180);
  }
  ctx.translate(-posX, -posY);

  applyFontStyles(ctx);

  // Shadow
  if (settings.shadowEnabled) {
    ctx.shadowColor = settings.shadowColor || 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = (settings.shadowBlur || 20) * scale;
    ctx.shadowOffsetX = (settings.shadowOffsetX || 0) * scale;
    ctx.shadowOffsetY = (settings.shadowOffsetY || 8) * scale;
  }

  // Behind Fill
  ctx.globalAlpha = Math.max(0, Math.min(1, (settings.fillOpacity ?? 90) / 100));
  ctx.fillStyle = settings.fillColor || '#ffffff';

  const shouldStrokeBehind = settings.strokeEnabled && (settings.strokePlacement === 'behind' || settings.strokePlacement === 'both');
  if (shouldStrokeBehind) {
    ctx.strokeStyle = settings.strokeColor || '#22c55e';
    ctx.lineWidth = Math.max(1, (settings.strokeWidth || 3) * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  renderCustomTextLines(
    ctx,
    lines,
    posX,
    startY,
    lineHeightPx,
    letterSpacingPx,
    settings.textAlign,
    shouldStrokeBehind ? 'both' : 'fill',
  );

  ctx.restore();

  // 4. Render Pass 2: Foreground Subject Cutout (via SAM / AI Alpha Mask)
  if (maskImage) {
    // Create high-res mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

    if (maskCtx) {
      maskCtx.drawImage(maskImage, 0, 0, w, h);
      const maskImgData = maskCtx.getImageData(0, 0, w, h);
      const mData = maskImgData.data;

      // Ensure grayscale luminance is mapped cleanly to the alpha channel
      for (let i = 0; i < mData.length; i += 4) {
        mData[i + 3] = mData[i]; // Alpha = Luminance
      }
      maskCtx.putImageData(maskImgData, 0, 0);

      // Create isolated subject canvas by applying destination-in on the original unedited photo snapshot
      const subjectCanvas = document.createElement('canvas');
      subjectCanvas.width = w;
      subjectCanvas.height = h;
      const subjectCtx = subjectCanvas.getContext('2d', { willReadFrequently: true });

      if (subjectCtx) {
        subjectCtx.drawImage(bgSnapshot, 0, 0);
        subjectCtx.globalCompositeOperation = 'destination-in';
        subjectCtx.drawImage(maskCanvas, 0, 0);
        subjectCtx.globalCompositeOperation = 'source-over';

        // Draw the subject cutout directly over the text layer
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.drawImage(subjectCanvas, 0, 0);
        ctx.restore();
      }
    }
  }

  // 5. Render Pass 3: Front-layer Stroke / Holographic Outline
  const shouldStrokeFront = settings.strokeEnabled && (settings.strokePlacement === 'front' || settings.strokePlacement === 'both');
  if (shouldStrokeFront) {
    ctx.save();
    ctx.translate(posX, posY);
    if (settings.rotation !== 0) {
      ctx.rotate((settings.rotation * Math.PI) / 180);
    }
    ctx.translate(-posX, -posY);

    applyFontStyles(ctx);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = settings.strokeColor || '#22c55e';
    ctx.lineWidth = Math.max(1, (settings.strokeWidth || 3) * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    renderCustomTextLines(
      ctx,
      lines,
      posX,
      startY,
      lineHeightPx,
      letterSpacingPx,
      settings.textAlign,
      'stroke',
    );

    ctx.restore();
  }
}

