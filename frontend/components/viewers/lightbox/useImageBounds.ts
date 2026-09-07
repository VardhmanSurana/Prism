import { useState, useEffect, useCallback, RefObject } from 'react';
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
 * including zoom and pan offset. Measures the active <img> element directly from the DOM
 * to guarantee pixel-perfect alignment against all CSS aspect-ratios, max-heights, and flexboxes.
 * Falls back to mathematical containment when DOM rects are not yet available.
 *
 * @param photo - Photo whose dimensions/path are used to resolve natural size.
 * @param containerRef - Outer container element ref.
 * @param fallbackElementRef - Ref to the overlay's root container.
 * @param zoomScale - Current zoom multiplier (1 = fitted).
 * @param offset - Current pan offset in pixels.
 * @returns Pixel bounds {left, top, width, height} relative to fallbackElementRef.
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

  const computeBounds = useCallback((): ImageBounds => {
    const rootEl = fallbackElementRef?.current;
    const parentEl = rootEl?.parentElement;
    const containerEl = containerRef?.current || parentEl;

    // Directly inspect the active <img> rendered on screen by ImageDisplay
    const imgEl = (
      parentEl?.querySelector('img:not(.opacity-0)') ||
      parentEl?.querySelector('img') ||
      containerEl?.querySelector('img:not(.opacity-0)') ||
      containerEl?.querySelector('img')
    ) as HTMLImageElement | null;

    if (rootEl && imgEl) {
      const rootRect = rootEl.getBoundingClientRect();
      const imgRect = imgEl.getBoundingClientRect();

      if (rootRect.width > 0 && rootRect.height > 0 && imgRect.width > 0 && imgRect.height > 0) {
        const iWidth = naturalSize.width || imgEl.naturalWidth || imgRect.width;
        const iHeight = naturalSize.height || imgEl.naturalHeight || imgRect.height;
        const imageRatio = iWidth / iHeight;
        const elementRatio = imgRect.width / imgRect.height;

        let renderedWidth = imgRect.width;
        let renderedHeight = imgRect.height;
        let renderedLeft = 0;
        let renderedTop = 0;

        // W3C object-fit: contain calculation
        if (elementRatio > imageRatio) {
          // Element is wider than image -> pillarboxed horizontally
          renderedHeight = imgRect.height;
          renderedWidth = imgRect.height * imageRatio;
          renderedLeft = (imgRect.width - renderedWidth) / 2;
        } else if (elementRatio < imageRatio) {
          // Element is taller than image -> letterboxed vertically
          renderedWidth = imgRect.width;
          renderedHeight = imgRect.width / imageRatio;
          renderedTop = (imgRect.height - renderedHeight) / 2;
        }

        return {
          left: (imgRect.left - rootRect.left) + renderedLeft,
          top: (imgRect.top - rootRect.top) + renderedTop,
          width: renderedWidth,
          height: renderedHeight,
        };
      }
    }

    // Mathematical fallback if DOM elements are not yet laid out (e.g. initial tick or JSDOM)
    const cWidth = containerEl?.clientWidth || window.innerWidth;
    const cHeight = containerEl?.clientHeight || window.innerHeight;
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
  }, [containerRef, fallbackElementRef, naturalSize, zoomScale, offset.x, offset.y]);

  const [bounds, setBounds] = useState<ImageBounds>(computeBounds);

  useEffect(() => {
    const update = () => {
      setBounds(computeBounds());
    };

    update();

    const rootEl = fallbackElementRef?.current;
    const parentEl = rootEl?.parentElement;
    const containerEl = containerRef?.current || parentEl;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      if (containerEl) observer.observe(containerEl);
      if (parentEl && parentEl !== containerEl) observer.observe(parentEl);
      const imgEl = parentEl?.querySelector('img') || containerEl?.querySelector('img');
      if (imgEl) observer.observe(imgEl);
    }

    window.addEventListener('resize', update);
    const raf1 = requestAnimationFrame(update);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(update));

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [computeBounds, containerRef, fallbackElementRef]);

  return bounds;
}
