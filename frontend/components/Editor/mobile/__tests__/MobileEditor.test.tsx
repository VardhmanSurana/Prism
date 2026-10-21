import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  MobileEditor,
  applyMobileAdjustmentsToImageData,
  DEFAULT_MOBILE_ADJUSTMENTS,
  MOBILE_TOOLS,
} from '../MobileEditor';
import type { Photo } from '@/types';

const mockPhoto: Photo = {
  id: 42,
  filename: 'sunset_beach.jpg',
  url: '/api/v1/photos/42/thumbnail',
  path: '/media/sunset_beach.jpg',
  width: 400,
  height: 300,
  date: '2026-05-01T12:00:00Z',
  file_size: 2400000,
  type: 'image',
  isFavorite: false,
};

describe('applyMobileAdjustmentsToImageData', () => {
  it('leaves pixel data unchanged when all adjustments are 0', () => {
    const pixels = new Uint8ClampedArray([100, 150, 200, 255]);
    applyMobileAdjustmentsToImageData(pixels, 1, 1, { ...DEFAULT_MOBILE_ADJUSTMENTS });
    expect(Array.from(pixels)).toEqual([100, 150, 200, 255]);
  });

  it('applies exposure EV multiplier', () => {
    const brighter = new Uint8ClampedArray([64, 64, 64, 255]);
    applyMobileAdjustmentsToImageData(brighter, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      exposure: 50, // 2^(50/50) = 2x
    });
    expect(brighter[0]).toBe(128);
    expect(brighter[1]).toBe(128);
    expect(brighter[2]).toBe(128);

    const darker = new Uint8ClampedArray([128, 128, 128, 255]);
    applyMobileAdjustmentsToImageData(darker, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      exposure: -50, // 2^(-1) = 0.5x
    });
    expect(darker[0]).toBe(64);
  });

  it('applies brightness additive offset', () => {
    const pixels = new Uint8ClampedArray([100, 100, 100, 255]);
    applyMobileAdjustmentsToImageData(pixels, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      brightness: 20, // +51
    });
    expect(pixels[0]).toBe(151);
    expect(pixels[1]).toBe(151);
    expect(pixels[2]).toBe(151);
  });

  it('applies contrast expansion and compression around midpoint 128', () => {
    const pixels = new Uint8ClampedArray([
      80, 80, 80, 255,   // below midpoint
      180, 180, 180, 255 // above midpoint
    ]);
    applyMobileAdjustmentsToImageData(pixels, 2, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      contrast: 50,
    });
    expect(pixels[0]).toBeLessThan(80);
    expect(pixels[4]).toBeGreaterThan(180);
  });

  it('applies highlights to bright pixels without altering dark pixels', () => {
    const pixels = new Uint8ClampedArray([
      40, 40, 40, 255,    // dark pixel (lum < 128)
      200, 200, 200, 255, // bright pixel (lum > 128)
    ]);
    applyMobileAdjustmentsToImageData(pixels, 2, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      highlights: 50,
    });
    expect(pixels[0]).toBe(40);
    expect(pixels[4]).toBeGreaterThan(200);
  });

  it('applies shadows to dark pixels without altering bright pixels', () => {
    const pixels = new Uint8ClampedArray([
      40, 40, 40, 255,    // dark pixel (lum < 128)
      200, 200, 200, 255, // bright pixel (lum > 128)
    ]);
    applyMobileAdjustmentsToImageData(pixels, 2, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      shadows: 50,
    });
    expect(pixels[0]).toBeGreaterThan(40);
    expect(pixels[4]).toBe(200);
  });

  it('applies saturation desaturation and boost relative to Rec.709 luminance', () => {
    const desaturated = new Uint8ClampedArray([220, 80, 40, 255]);
    applyMobileAdjustmentsToImageData(desaturated, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      saturation: -100,
    });
    expect(desaturated[0]).toBe(desaturated[1]);
    expect(desaturated[1]).toBe(desaturated[2]);

    const boosted = new Uint8ClampedArray([180, 100, 100, 255]);
    applyMobileAdjustmentsToImageData(boosted, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      saturation: 60,
    });
    expect(boosted[0]).toBeGreaterThan(180);
    expect(boosted[1]).toBeLessThan(100);
  });

  it('applies temperature warmth shift to red and blue channels', () => {
    const warm = new Uint8ClampedArray([120, 120, 120, 255]);
    applyMobileAdjustmentsToImageData(warm, 1, 1, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      temperature: 50, // +40 R, -40 B
    });
    expect(warm[0]).toBe(160);
    expect(warm[1]).toBe(120);
    expect(warm[2]).toBe(80);
  });

  it('applies sharpness 3x3 Laplacian kernel to enhance center edge contrast', () => {
    // 3x3 image with a brighter center pixel (150) surrounded by 100s
    const pixels = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) {
      const val = i === 4 ? 150 : 100;
      pixels[i * 4] = val;
      pixels[i * 4 + 1] = val;
      pixels[i * 4 + 2] = val;
      pixels[i * 4 + 3] = 255;
    }

    applyMobileAdjustmentsToImageData(pixels, 3, 3, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      sharpness: 50,
    });

    const centerIndex = 4 * 4;
    expect(pixels[centerIndex]).toBeGreaterThan(150);
  });

  it('applies vignette radial falloff darkening corners more than center', () => {
    // 3x3 uniform image (value 200)
    const pixels = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) {
      pixels[i * 4] = 200;
      pixels[i * 4 + 1] = 200;
      pixels[i * 4 + 2] = 200;
      pixels[i * 4 + 3] = 255;
    }

    applyMobileAdjustmentsToImageData(pixels, 3, 3, {
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      vignette: 80,
    });

    const cornerR = pixels[0]; // (0, 0)
    const centerR = pixels[4 * 4]; // (1, 1)
    expect(cornerR).toBeLessThan(centerR);
  });
});

describe('MobileEditor Component', () => {
  it('renders all 9 mobile adjustment tools and switches active tool', () => {
    const onClose = vi.fn();
    render(<MobileEditor photo={mockPhoto} onClose={onClose} />);

    for (const tool of MOBILE_TOOLS) {
      expect(screen.getAllByText(tool.label).length).toBeGreaterThanOrEqual(1);
    }

    // Select Warmth (temperature) tool
    fireEvent.click(screen.getByRole('button', { name: /Warmth/i }));
    const slider = screen.getByRole('slider', { name: 'Warmth' });
    expect(slider).toBeTruthy();

    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.pointerUp(slider, { target: { value: '35' } });
    expect(screen.getByText('+35')).toBeTruthy();
  });

  it('resets all adjustments to 0 when Reset button is clicked', () => {
    const onClose = vi.fn();
    render(<MobileEditor photo={mockPhoto} onClose={onClose} />);

    const slider = screen.getByRole('slider', { name: 'Exposure' });
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.pointerUp(slider, { target: { value: '45' } });
    expect(screen.getByText('+45')).toBeTruthy();

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('0')).toBeTruthy();
  });

  it('exports a JPEG Blob and passes (blob, adjustments) to onSave before calling onClose', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<MobileEditor photo={mockPhoto} onClose={onClose} onSave={onSave} />);

    const slider = screen.getByRole('slider', { name: 'Exposure' });
    fireEvent.change(slider, { target: { value: '25' } });
    fireEvent.pointerUp(slider, { target: { value: '25' } });

    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const [blobArg, adjustmentsArg] = onSave.mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('image/jpeg');
    expect(adjustmentsArg).toMatchObject({
      ...DEFAULT_MOBILE_ADJUSTMENTS,
      exposure: 25,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
