import { useState, useEffect, useMemo, RefObject } from 'react';
import { Photo } from '@/types';
import { resolveUrl } from '@/constants';

export interface ImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Computes the on-screen pixel bounds of the displayed image (object-contain fit)
 * including zoom and pan offset. Also tracks natural image size and container size.
 * @param photo - Photo whose dimensions/path are used to resolve natural size.
 * @param containerRef - Preferred container element ref for measuring bounds.
 * @param fallbackElementRef - Fallback ref whose parent is measured if containerRef is absent.
 * @param zoomScale - Current zoom multiplier (1 = fitted).
 * @param offset - Current pan offset in pixels.
 * @returns Pixel bounds {left, top, width, height} in viewport coordinates.
 */
export function useImageBounds(
  photo: Photo,
  containerRef?: RefObject<HTMLDivElement | null>,
  fallbackElementRef?: RefObject<HTMLElement | null>,
  zoomScale: number = 1,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): ImageBounds {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: photo.width || 0,
    height: photo.height || 0,
  });

  useEffect(() => {
    if (photo.width && photo.height) {
      setNaturalSize({ width: photo.width, height: photo.height });
      return;
    }
    const img = new Image();
    img.src = resolveUrl(photo.url || (photo.path ? `local://${photo.path}` : `/api/v1/photos/${photo.id}/file`));
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
  }, [photo.id, photo.url, photo.path, photo.width, photo.height]);

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSize = () => {
      const el = containerRef?.current || fallbackElementRef?.current?.parentElement;
      if (el) {
        setContainerSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    updateSize();

    const targetEl = containerRef?.current || fallbackElementRef?.current?.parentElement;
    let observer: ResizeObserver | null = null;
    if (targetEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateSize);
      observer.observe(targetEl);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [containerRef, fallbackElementRef]);

  return useMemo<ImageBounds>(() => {
    const cWidth = containerSize.width || window.innerWidth;
    const cHeight = containerSize.height || window.innerHeight;
    const iWidth = naturalSize.width || cWidth;
    const iHeight = naturalSize.height || cHeight;

    const imgAspect = iWidth / iHeight;
    const containerAspect = cWidth / cHeight;

    let fittedWidth = cWidth;
    let fittedHeight = cHeight;

    if (containerAspect > imgAspect) {
      fittedHeight = cHeight;
      fittedWidth = cHeight * imgAspect;
    } else {
      fittedWidth = cWidth;
      fittedHeight = cWidth / imgAspect;
    }

    const scale = zoomScale || 1;
    const offX = offset?.x || 0;
    const offY = offset?.y || 0;

    const displayedWidth = fittedWidth * scale;
    const displayedHeight = fittedHeight * scale;
    const displayedLeft = (cWidth - displayedWidth) / 2 + offX;
    const displayedTop = (cHeight - displayedHeight) / 2 + offY;

    return {
      left: displayedLeft,
      top: displayedTop,
      width: displayedWidth,
      height: displayedHeight,
    };
  }, [containerSize, naturalSize, zoomScale, offset.x, offset.y]);
}
