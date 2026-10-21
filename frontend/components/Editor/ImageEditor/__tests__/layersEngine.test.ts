import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Layer,
  createDefaultBaseLayer,
  compositeLayersToCanvas,
  isLayerStackEmpty,
} from '../layersEngine';

function makeMockCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    fillStyle: '',
  };
}

let mockCtx: ReturnType<typeof makeMockCtx>;

beforeEach(() => {
  mockCtx = makeMockCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
});

function makeBase(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 2;
  return c;
}

describe('layersEngine', () => {
  it('base-only stack is considered empty (compositing no-op)', () => {
    expect(isLayerStackEmpty(undefined)).toBe(true);
    expect(isLayerStackEmpty(null)).toBe(true);
    expect(isLayerStackEmpty([])).toBe(true);
    expect(isLayerStackEmpty([createDefaultBaseLayer()])).toBe(true);
  });

  it('a stack with fill/adjustment layers is not empty', () => {
    const fill: Layer = { id: 'l1', name: 'Fill', type: 'fill', visible: true, opacity: 100, blendMode: 'source-over', fillColor: '#ff0000' };
    expect(isLayerStackEmpty([createDefaultBaseLayer(), fill])).toBe(false);
  });

  it('draws the base first, then applies fill layers bottom-to-top', () => {
    const base = makeBase();
    const bottom: Layer = { id: 'l1', name: 'Fill 1', type: 'fill', visible: true, opacity: 50, blendMode: 'multiply', fillColor: '#00ff00' };
    const top: Layer = { id: 'l2', name: 'Fill 2', type: 'fill', visible: true, opacity: 100, blendMode: 'screen', fillColor: '#0000ff' };

    const out = compositeLayersToCanvas([top, bottom], base);

    expect(out).toBeInstanceOf(HTMLCanvasElement);
    // First drawImage = the base render; fill layers paint via fillRect only
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    // Fill layers painted exactly twice, in bottom-to-top order with their own blend/alpha
    expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    expect(mockCtx.globalCompositeOperation).toBe('screen');
    expect(mockCtx.globalAlpha).toBe(1);
  });

  it('skips hidden and zero-opacity layers', () => {
    const base = makeBase();
    const hidden: Layer = { id: 'h', name: 'Hidden', type: 'fill', visible: false, opacity: 100, blendMode: 'source-over', fillColor: '#123456' };
    const transparent: Layer = { id: 't', name: 'Transparent', type: 'fill', visible: true, opacity: 0, blendMode: 'source-over', fillColor: '#654321' };
    const visible: Layer = { id: 'v', name: 'Visible', type: 'fill', visible: true, opacity: 100, blendMode: 'source-over', fillColor: '#abcdef' };

    compositeLayersToCanvas([hidden, transparent, visible], base);

    expect(mockCtx.fillRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.fillStyle).toBe('#abcdef');
  });

  it('adjustment layers re-draw the composite through a snapshot (filter path)', () => {
    const base = makeBase();
    const adj: Layer = {
      id: 'a1',
      name: 'Adjustment',
      type: 'adjustment',
      visible: true,
      opacity: 80,
      blendMode: 'source-over',
      adjustmentData: { exposure: 25, contrast: -10 },
    };

    compositeLayersToCanvas([adj], base);

    // Base draw + snapshot capture + snapshot redraw (mock ctx is shared by
    // the snapshot canvas, so its internal draw is counted too)
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(3);
    // Third drawImage is the filtered snapshot being redrawn onto the target
    const snapArg = mockCtx.drawImage.mock.calls[2][0] as HTMLCanvasElement;
    expect(snapArg.tagName).toBe('CANVAS');
    expect(mockCtx.globalAlpha).toBeCloseTo(0.8);
  });

  it('clamps out-of-range opacity into [0, 1]', () => {
    const base = makeBase();
    const layer: Layer = { id: 'x', name: 'X', type: 'fill', visible: true, opacity: 250, blendMode: 'source-over', fillColor: '#ffffff' };
    compositeLayersToCanvas([layer], base);
    expect(mockCtx.globalAlpha).toBe(1);
  });
});