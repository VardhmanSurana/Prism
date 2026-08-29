/**
 * useLassoImageData.ts
 * Loads the source image and pre-computes the Intelligent-Scissors cost map.
 */
import { useEffect, useState } from 'react';
import { LiveWireCostMap, buildLiveWireCostMap } from '../lassoEngine';

export function useLassoImageData(
  imageSrc: string | undefined,
  width: number,
  height: number,
): { sourceImgData: ImageData | null; costMap: LiveWireCostMap | null } {
  const [sourceImgData, setSourceImgData] = useState<ImageData | null>(null);
  const [costMap, setCostMap] = useState<LiveWireCostMap | null>(null);

  useEffect(() => {
    if (!imageSrc || width <= 0 || height <= 0) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const temp = document.createElement('canvas');
      temp.width = width;
      temp.height = height;
      const ctx = temp.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        setSourceImgData(imgData);
        try {
          const map = buildLiveWireCostMap(imgData, 480);
          setCostMap(map);
        } catch (e) {
          console.warn('Could not build live-wire cost map:', e);
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc, width, height]);

  return { sourceImgData, costMap };
}
