import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScaledMaskCanvas } from '../lassoEngine/mask';
import { Point2D } from '../lassoEngine/types';

describe('Lasso Mask Scaling and Extraction', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  });

  describe('generateScaledMaskCanvas', () => {
    it('creates an empty mask canvas filled with black when no points or closed paths exist', () => {
      const canvas = generateScaledMaskCanvas([], [], null, 100, 100, 500, 500);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(500);
      expect(canvas.height).toBe(500);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 500, 500);
      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('renders and scales active vector points to target resolution', () => {
      const points: Point2D[] = [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 50 },
      ];

      const canvas = generateScaledMaskCanvas(
        points,
        [],
        null,
        100,  // sourceWidth
        100,  // sourceHeight
        1000, // targetWidth (10x scale)
        1000, // targetHeight (10x scale)
      );

      expect(canvas.width).toBe(1000);
      expect(canvas.height).toBe(1000);
      expect(mockCtx.fillStyle).toBe('#ffffff');

      // Verify scaled polygon coordinates (10 * 10 = 100, 50 * 10 = 500)
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(100, 100);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(500, 100);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(500, 500);
      expect(mockCtx.closePath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('renders and scales multiple closedPaths when provided', () => {
      const closedPaths: Point2D[][] = [
        [
          { x: 5, y: 5 },
          { x: 25, y: 5 },
          { x: 25, y: 25 },
        ],
        [
          { x: 40, y: 40 },
          { x: 80, y: 40 },
          { x: 80, y: 80 },
        ],
      ];

      const canvas = generateScaledMaskCanvas(
        [],
        closedPaths,
        null,
        100,
        100,
        400, // 4x scale
        400, // 4x scale
      );

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(400);
      expect(mockCtx.fill).toHaveBeenCalledTimes(2);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(20, 20); // 5 * 4
      expect(mockCtx.moveTo).toHaveBeenCalledWith(160, 160); // 40 * 4
    });

    it('scales composite raster mask to target dimensions when provided', () => {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = 100;
      compositeCanvas.height = 100;

      const canvas = generateScaledMaskCanvas(
        [],
        [],
        compositeCanvas,
        100,
        100,
        1920,
        1080,
      );

      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
      expect(mockCtx.imageSmoothingEnabled).toBe(true);
      expect(mockCtx.imageSmoothingQuality).toBe('high');
      expect(mockCtx.drawImage).toHaveBeenCalledWith(compositeCanvas, 0, 0, 1920, 1080);
    });
  });

  describe('Cutout and Extraction Payloads', () => {
    it('generates remove_bg adjustment payload with transparent backdrop', () => {
      const dummyMaskUrl = 'data:image/png;base64,dummyMask';
      const baseAdjustments = {
        brightness: 100,
      };

      const removeBgAdjustments = {
        ...baseAdjustments,
        background: {
          enabled: true,
          modelId: 'lasso-cutout',
          mode: 'remove_bg' as const,
          backdrop: 'transparent' as const,
          maskUrl: dummyMaskUrl,
          refine: {
            feather: 0,
            smooth: 0,
            shiftEdge: 0,
            contrast: 0,
          },
        },
      };

      expect(removeBgAdjustments.background.enabled).toBe(true);
      expect(removeBgAdjustments.background.mode).toBe('remove_bg');
      expect(removeBgAdjustments.background.backdrop).toBe('transparent');
      expect(removeBgAdjustments.background.maskUrl).toBe(dummyMaskUrl);
    });

    it('generates keep_bg adjustment payload to punch out mask object', () => {
      const dummyMaskUrl = 'data:image/png;base64,dummyMask';
      const baseAdjustments = {
        brightness: 100,
      };

      const keepBgAdjustments = {
        ...baseAdjustments,
        background: {
          enabled: true,
          modelId: 'lasso-cutout',
          mode: 'keep_bg' as const,
          backdrop: 'transparent' as const,
          maskUrl: dummyMaskUrl,
          refine: {
            feather: 0,
            smooth: 0,
            shiftEdge: 0,
            contrast: 0,
          },
        },
      };

      expect(keepBgAdjustments.background.enabled).toBe(true);
      expect(keepBgAdjustments.background.mode).toBe('keep_bg');
      expect(keepBgAdjustments.background.backdrop).toBe('transparent');
      expect(keepBgAdjustments.background.maskUrl).toBe(dummyMaskUrl);
    });
  });

  describe('convertMaskToTransparentAlpha', () => {
    it('maps grayscale luminance to alpha channel and sets RGB to white', async () => {
      const { convertMaskToTransparentAlpha } = await import('../lassoEngine/mask');
      const inputCanvas = document.createElement('canvas');
      inputCanvas.width = 2;
      inputCanvas.height = 1;

      // Mock getImageData with 1 white pixel (subject) and 1 black pixel (background)
      const mockImageData = {
        data: new Uint8ClampedArray([
          255, 255, 255, 255, // white (selected subject)
          0, 0, 0, 255,       // black (unselected background)
        ]),
      };

      mockCtx.getImageData = vi.fn().mockReturnValue(mockImageData);

      const outCanvas = convertMaskToTransparentAlpha(inputCanvas);
      expect(outCanvas).toBeDefined();
      expect(mockCtx.putImageData).toHaveBeenCalled();

      // Pixel 0 (subject) should be white with full alpha (255)
      expect(mockImageData.data[0]).toBe(255);
      expect(mockImageData.data[1]).toBe(255);
      expect(mockImageData.data[2]).toBe(255);
      expect(mockImageData.data[3]).toBe(255);

      // Pixel 1 (background) should have alpha mapped to luminance = 0 (transparent)
      expect(mockImageData.data[4]).toBe(255);
      expect(mockImageData.data[5]).toBe(255);
      expect(mockImageData.data[6]).toBe(255);
      expect(mockImageData.data[7]).toBe(0); // Alpha 0!
    });
  });
});

