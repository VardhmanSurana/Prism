/**
 * useImageLoader.ts
 * Custom hook encapsulating source image, blend image, and portrait mask loading.
 */

import React from 'react';
import { loadMaskBuffer, LoadedPortraitMasks } from './portraitEngine';
import type { Adjustments } from './filterEngine';
import { SingleFaceAdjustments } from './adjustmentTypes';
import { API_BASE } from '@/constants';

interface UseImageLoaderOptions {
  currentImageSrc: string;
  adjustments: Adjustments;
}

interface UseImageLoaderReturn {
  sourceImg: HTMLImageElement | null;
  blendImg: HTMLImageElement | null;
  backgroundMaskImg: HTMLImageElement | null;
  customBackdropImg: HTMLImageElement | null;
  portraitMasksRef: React.RefObject<LoadedPortraitMasks>;
  canvasDrawKey: number;
  setCanvasDrawKey: React.Dispatch<React.SetStateAction<number>>;
}

export function useImageLoader({
  currentImageSrc,
  adjustments,
}: UseImageLoaderOptions): UseImageLoaderReturn {
  const [sourceImg, setSourceImg] = React.useState<HTMLImageElement | null>(null);
  const [blendImg, setBlendImg] = React.useState<HTMLImageElement | null>(null);
  const [backgroundMaskImg, setBackgroundMaskImg] = React.useState<HTMLImageElement | null>(null);
  const [customBackdropImg, setCustomBackdropImg] = React.useState<HTMLImageElement | null>(null);
  const portraitMasksRef = React.useRef<LoadedPortraitMasks>({});
  const [canvasDrawKey, setCanvasDrawKey] = React.useState(0);

  // Load source image
  React.useEffect(() => {
    if (!currentImageSrc) {
      setSourceImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setSourceImg(img);
    };
    img.onerror = () => {
      if (active) setSourceImg(null);
    };
    img.src = currentImageSrc;
    return () => {
      active = false;
    };
  }, [currentImageSrc]);

  // Load background mask image
  React.useEffect(() => {
    const maskUrl = adjustments.background?.enabled ? adjustments.background?.maskUrl : null;
    if (!maskUrl) {
      setBackgroundMaskImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) {
        setBackgroundMaskImg(img);
        setCanvasDrawKey(k => k + 1);
      }
    };
    img.onerror = () => {
      if (active) setBackgroundMaskImg(null);
    };
    img.src = maskUrl.startsWith('data:') || maskUrl.startsWith('blob:') || maskUrl.startsWith('http')
      ? maskUrl
      : `${API_BASE}${maskUrl}`;
    return () => {
      active = false;
    };
  }, [adjustments.background?.enabled, adjustments.background?.maskUrl]);

  // Load custom backdrop image
  React.useEffect(() => {
    const src = adjustments.background?.enabled && adjustments.background?.backdrop === 'custom'
      ? adjustments.background?.customImageSrc
      : null;
    if (!src) {
      setCustomBackdropImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) {
        setCustomBackdropImg(img);
        setCanvasDrawKey(k => k + 1);
      }
    };
    img.onerror = () => {
      if (active) setCustomBackdropImg(null);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [adjustments.background?.enabled, adjustments.background?.backdrop, adjustments.background?.customImageSrc]);

  // Load blend overlay image
  React.useEffect(() => {
    const src = adjustments.blend?.blendImageSrc;
    if (!src) {
      setBlendImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setBlendImg(img);
    };
    img.onerror = () => {
      if (active) setBlendImg(null);
    };
    const separator = src.includes('?') ? '&' : '?';
    img.src = `${src}${separator}timestamp=${Date.now()}`;
    return () => {
      active = false;
    };
  }, [adjustments.blend?.blendImageSrc]);

  // Memoize mask URLs string to prevent re-fetching/re-loading when slider values change
  const portraitMaskUrlsKey = React.useMemo(() => {
    const p = adjustments.portrait;
    if (!p) return '';
    const m = p.masks || {};
    const primary = `${m.skin || ''}|${m.eyes || ''}|${m.lips || ''}|${m.teeth || ''}|${m.eyebrows || ''}`;
    const faces = Object.entries(p.faces || {})
      .map(([id, f]) => {
        const fm = f.masks || {};
        return `${id}:${fm.skin || ''}|${fm.eyes || ''}|${fm.lips || ''}|${fm.teeth || ''}|${fm.eyebrows || ''}`;
      })
      .join(';');
    return `${primary}__${faces}`;
  }, [
    adjustments.portrait?.masks?.skin,
    adjustments.portrait?.masks?.eyes,
    adjustments.portrait?.masks?.lips,
    adjustments.portrait?.masks?.teeth,
    adjustments.portrait?.masks?.eyebrows,
    adjustments.portrait?.faces,
  ]);

  // Load and cache portrait mask buffers for instantaneous live retouching
  React.useEffect(() => {
    const portrait = adjustments.portrait;
    if (!portrait || !sourceImg || !portraitMaskUrlsKey || portraitMaskUrlsKey === '__') {
      return;
    }

    let active = true;

    async function loadAll() {
      const facesObj = portrait?.faces || {};
      const faceKeys = Object.keys(facesObj);
      const pMasks = portrait?.masks || {};

      // 1. Load primary / fallback masks
      const [primarySkin, primaryEyes, primaryLips, primaryTeeth, primaryEyebrows] = await Promise.all([
        pMasks.skin ? loadMaskBuffer(pMasks.skin) : null,
        pMasks.eyes ? loadMaskBuffer(pMasks.eyes) : null,
        pMasks.lips ? loadMaskBuffer(pMasks.lips) : null,
        pMasks.teeth ? loadMaskBuffer(pMasks.teeth) : null,
        pMasks.eyebrows ? loadMaskBuffer(pMasks.eyebrows) : null,
      ]);

      const loadedFaces: Record<string, import('./portraitEngine').SingleFaceMasks> = {};

      // 2. Load all individual face masks
      for (const fId of faceKeys) {
        const fm = facesObj[fId]?.masks;
        if (fm) {
          const [skin, eyes, lips, teeth, eyebrows] = await Promise.all([
            fm.skin ? loadMaskBuffer(fm.skin) : null,
            fm.eyes ? loadMaskBuffer(fm.eyes) : null,
            fm.lips ? loadMaskBuffer(fm.lips) : null,
            fm.teeth ? loadMaskBuffer(fm.teeth) : null,
            fm.eyebrows ? loadMaskBuffer(fm.eyebrows) : null,
          ]);
          loadedFaces[fId] = {
            skin: skin || primarySkin,
            eyes: eyes || primaryEyes,
            lips: lips || primaryLips,
            teeth: teeth || primaryTeeth,
            eyebrows: eyebrows || primaryEyebrows,
          };
        }
      }

      if (active) {
        portraitMasksRef.current = {
          skin: primarySkin,
          eyes: primaryEyes,
          lips: primaryLips,
          teeth: primaryTeeth,
          eyebrows: primaryEyebrows,
          faces: Object.keys(loadedFaces).length > 0 ? loadedFaces : undefined,
        };
        setCanvasDrawKey(k => k + 1);
      }
    }

    loadAll();

    return () => {
      active = false;
    };
  }, [
    portraitMaskUrlsKey,
    sourceImg,
  ]);

  return {
    sourceImg,
    blendImg,
    backgroundMaskImg,
    customBackdropImg,
    portraitMasksRef,
    canvasDrawKey,
    setCanvasDrawKey,
  };
}
