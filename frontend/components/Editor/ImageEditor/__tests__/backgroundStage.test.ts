import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_BACKGROUND_ADJUSTMENTS, BackgroundAdjustments } from '../filterEngine';
import { applyBackgroundReplacementToCanvas } from '@plugins/ai-vision-studio/backgroundStage';

describe('Background Replacement & Matting Stage', () => {
  it('has valid default background adjustment values', () => {
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.enabled).toBe(false);
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.modelId).toBe('isnet-general-use');
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.mode).toBe('remove_bg');
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.backdrop).toBe('transparent');
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.refine.feather).toBe(0);
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.refine.smooth).toBe(0);
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.refine.shiftEdge).toBe(0);
    expect(DEFAULT_BACKGROUND_ADJUSTMENTS.refine.contrast).toBe(0);
  });

  it('does not crash or execute when background adjustment is disabled', () => {
    const bg: BackgroundAdjustments = {
      ...DEFAULT_BACKGROUND_ADJUSTMENTS,
      enabled: false,
    };

    const dummyCanvas = document.createElement('canvas');
    const dummyMask = document.createElement('canvas');

    // Should return early without throwing
    expect(() => applyBackgroundReplacementToCanvas(dummyCanvas, bg, dummyMask)).not.toThrow();
  });

  it('handles null or missing mask gracefully', () => {
    const bg: BackgroundAdjustments = {
      ...DEFAULT_BACKGROUND_ADJUSTMENTS,
      enabled: true,
    };

    const dummyCanvas = document.createElement('canvas');
    expect(() => applyBackgroundReplacementToCanvas(dummyCanvas, bg, null as any)).not.toThrow();
  });

  it('correctly composites solid color background with a mask', () => {
    const mockCtx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
      })),
      putImageData: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;

    const mask = document.createElement('canvas');
    mask.width = 2;
    mask.height = 1;

    const bg: BackgroundAdjustments = {
      ...DEFAULT_BACKGROUND_ADJUSTMENTS,
      enabled: true,
      backdrop: 'color',
      backdropColor: '#00ff00',
    };

    applyBackgroundReplacementToCanvas(canvas, bg, mask);
    expect(mockCtx.putImageData).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalled();
  });
});

