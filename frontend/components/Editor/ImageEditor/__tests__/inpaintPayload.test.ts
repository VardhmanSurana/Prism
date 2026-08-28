import { describe, expect, it } from 'vitest';
import { fitInpaintDimensions } from '../utils/inpaintPayload';

describe('fitInpaintDimensions', () => {
  it('preserves small image dimensions', () => {
    expect(fitInpaintDimensions(1600, 900)).toEqual({ width: 1600, height: 900 });
  });

  it('caps the longest side while preserving aspect ratio', () => {
    expect(fitInpaintDimensions(6000, 4000)).toEqual({ width: 2048, height: 1365 });
  });
});
