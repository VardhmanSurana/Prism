/**
 * editedPreviewHelper.ts
 * Generates an image preview URL containing all active edits (live canvas
 * adjustments, healing strokes, and vector annotations) for transform & crop operations,
 * and remaps annotations when an image is cropped.
 */

import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { applyAnnotations } from './exportPipeline/stages/annotationsStages';

export async function getEditedPreviewUrl(
  liveCanvas: HTMLCanvasElement | null,
  healingCanvas: HTMLCanvasElement | null,
  annotations?: Annotation[],
): Promise<string | null> {
  if (!liveCanvas || liveCanvas.width <= 0 || liveCanvas.height <= 0) return null;

  const hasHealing = !!healingCanvas && healingCanvas.width > 0 && healingCanvas.height > 0;
  const hasAnnotations = !!annotations && annotations.some(a => a.visible !== false);

  if (!hasHealing && !hasAnnotations) {
    try {
      return liveCanvas.toDataURL('image/jpeg', 0.95);
    } catch {
      return null;
    }
  }

  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = liveCanvas.width;
    tempCanvas.height = liveCanvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return liveCanvas.toDataURL('image/jpeg', 0.95);

    ctx.drawImage(liveCanvas, 0, 0);

    if (hasHealing) {
      ctx.drawImage(healingCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    if (hasAnnotations) {
      await applyAnnotations(tempCanvas, annotations);
    }

    return tempCanvas.toDataURL('image/jpeg', 0.95);
  } catch (err) {
    console.warn('[getEditedPreviewUrl] Failed to composite preview:', err);
    try {
      return liveCanvas.toDataURL('image/jpeg', 0.95);
    } catch {
      return null;
    }
  }
}

/**
 * Remap annotation points and bounds from the original image coordinate space
 * (0..1000 percentage units) to match newly cropped image bounds.
 */
export function remapAnnotationToCrop(
  ann: Annotation,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  natW: number,
  natH: number,
): Annotation {
  if (cropW <= 0 || cropH <= 0 || natW <= 0 || natH <= 0) return ann;

  const newAnn = { ...ann };

  if (newAnn.points && newAnn.points.length > 0) {
    newAnn.points = newAnn.points.map(pt => {
      const pxX = (pt.x / 1000) * natW;
      const pxY = (pt.y / 1000) * natH;
      const newX = ((pxX - cropX) / cropW) * 1000;
      const newY = ((pxY - cropY) / cropH) * 1000;
      return {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      };
    });
  }

  if (newAnn.bounds) {
    const pxX = (newAnn.bounds.x / 1000) * natW;
    const pxY = (newAnn.bounds.y / 1000) * natH;
    const pxW = (newAnn.bounds.w / 1000) * natW;
    const pxH = (newAnn.bounds.h / 1000) * natH;

    const newX = ((pxX - cropX) / cropW) * 1000;
    const newY = ((pxY - cropY) / cropH) * 1000;
    const newW = (pxW / cropW) * 1000;
    const newH = (pxH / cropH) * 1000;

    newAnn.bounds = {
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
      w: Math.round(newW * 10) / 10,
      h: Math.round(newH * 10) / 10,
    };
  }

  return newAnn;
}
