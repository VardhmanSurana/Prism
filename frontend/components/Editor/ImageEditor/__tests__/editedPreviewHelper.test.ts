import { describe, it, expect, vi } from 'vitest';
import { getEditedPreviewUrl, remapAnnotationToCrop } from '../editedPreviewHelper';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

describe('editedPreviewHelper', () => {
  describe('remapAnnotationToCrop', () => {
    it('returns unchanged annotation if crop or natural dimensions are non-positive', () => {
      const ann: Annotation = {
        id: '1',
        type: 'rect',
        color: '#ff0000',
        strokeWidth: 2,
        bounds: { x: 100, y: 100, w: 200, h: 200 },
      };

      expect(remapAnnotationToCrop(ann, 0, 0, 0, 100, 1000, 1000)).toBe(ann);
      expect(remapAnnotationToCrop(ann, 0, 0, 100, 0, 1000, 1000)).toBe(ann);
      expect(remapAnnotationToCrop(ann, 0, 0, 100, 100, 0, 1000)).toBe(ann);
      expect(remapAnnotationToCrop(ann, 0, 0, 100, 100, 1000, 0)).toBe(ann);
    });

    it('correctly remaps point-based annotations to crop coordinates', () => {
      // Natural: 1000 x 800
      // Points in 0..1000 coords:
      // pt1: x=250 (250px), y=250 (200px)
      // pt2: x=750 (750px), y=750 (600px)
      const ann: Annotation = {
        id: 'stroke-1',
        type: 'freehand',
        color: '#00ff00',
        strokeWidth: 3,
        points: [
          { x: 250, y: 250 },
          { x: 750, y: 750 },
        ],
      };

      // Crop: x=250, y=200, w=500, h=400
      // pt1 in crop: x = (250 - 250) / 500 * 1000 = 0, y = (200 - 200) / 400 * 1000 = 0
      // pt2 in crop: x = (750 - 250) / 500 * 1000 = 1000, y = (600 - 200) / 400 * 1000 = 1000
      const remapped = remapAnnotationToCrop(ann, 250, 200, 500, 400, 1000, 800);

      expect(remapped.points).toEqual([
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
      ]);
    });

    it('correctly remaps bounds-based annotations to crop coordinates', () => {
      // Natural: 800 x 600
      // Bounds: x=250 (200px), y=250 (150px), w=500 (400px), h=500 (300px)
      const ann: Annotation = {
        id: 'rect-1',
        type: 'rect',
        color: '#0000ff',
        strokeWidth: 2,
        bounds: { x: 250, y: 250, w: 500, h: 500 },
      };

      // Crop: x=200, y=150, w=400, h=300 (exactly the bounds)
      // New bounds in crop: x=0, y=0, w=1000, h=1000
      const remapped = remapAnnotationToCrop(ann, 200, 150, 400, 300, 800, 600);

      expect(remapped.bounds).toEqual({
        x: 0,
        y: 0,
        w: 1000,
        h: 1000,
      });
    });
  });

  describe('getEditedPreviewUrl', () => {
    it('returns null if liveCanvas is null or has zero dimension', async () => {
      expect(await getEditedPreviewUrl(null, null)).toBeNull();

      const zeroCanvas = document.createElement('canvas');
      zeroCanvas.width = 0;
      zeroCanvas.height = 0;
      expect(await getEditedPreviewUrl(zeroCanvas, null)).toBeNull();
    });

    it('returns toDataURL directly if no healing and no annotations', async () => {
      const liveCanvas = document.createElement('canvas');
      liveCanvas.width = 200;
      liveCanvas.height = 150;
      const dataUrl = 'data:image/jpeg;base64,mockpreview';
      vi.spyOn(liveCanvas, 'toDataURL').mockReturnValue(dataUrl);

      const res = await getEditedPreviewUrl(liveCanvas, null, []);
      expect(res).toBe(dataUrl);
    });

    it('composites healing and live canvas when healing canvas is present', async () => {
      const mockCtx = {
        drawImage: vi.fn(),
      };
      const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
      const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,composited');

      const liveCanvas = document.createElement('canvas');
      liveCanvas.width = 200;
      liveCanvas.height = 150;

      const healingCanvas = document.createElement('canvas');
      healingCanvas.width = 200;
      healingCanvas.height = 150;

      const res = await getEditedPreviewUrl(liveCanvas, healingCanvas);
      expect(res).toBe('data:image/jpeg;base64,composited');
      expect(mockCtx.drawImage).toHaveBeenCalledWith(liveCanvas, 0, 0);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(healingCanvas, 0, 0, 200, 150);

      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
    });
  });
});
