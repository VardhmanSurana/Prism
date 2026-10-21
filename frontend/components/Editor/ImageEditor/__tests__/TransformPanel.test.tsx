import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { TransformPanel, ASPECT_RATIOS } from '../TransformPanel';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

describe('TransformPanel aspect ratios', () => {
  it('includes Passport (3.5:4.5) in ASPECT_RATIOS with value 35 / 45', () => {
    const passportRatio = ASPECT_RATIOS.find((r) => r.label === 'Passport (3.5:4.5)');
    expect(passportRatio).toBeDefined();
    expect(passportRatio?.value).toBeCloseTo(35 / 45, 5);
  });

  it('renders Passport ratio button and triggers handleSetAspectRatio when clicked', () => {
    const handleSetAspectRatio = vi.fn();
    const handleApplyCrop = vi.fn();
    const handleResetCrop = vi.fn();
    const handleRotate = vi.fn();
    const handleStraighten = vi.fn();
    const handleFlipH = vi.fn();
    const handleFlipV = vi.fn();
    const onAdjustmentsChange = vi.fn();

    render(
      <TransformPanel
        hasCropSelection={false}
        isImageCropped={false}
        handleApplyCrop={handleApplyCrop}
        handleResetCrop={handleResetCrop}
        currentRatio={NaN}
        handleSetAspectRatio={handleSetAspectRatio}
        handleRotate={handleRotate}
        straightenAngle={0}
        handleStraighten={handleStraighten}
        flipH={false}
        flipV={false}
        handleFlipH={handleFlipH}
        handleFlipV={handleFlipV}
        adjustments={DEFAULT_ADJUSTMENTS}
        onAdjustmentsChange={onAdjustmentsChange}
      />
    );

    const passportButton = screen.getByRole('button', { name: /Passport/i });
    expect(passportButton).toBeDefined();
    expect(passportButton.textContent).toContain('Passport (3.5:4.5)');

    fireEvent.click(passportButton);
    expect(handleSetAspectRatio).toHaveBeenCalledTimes(1);
    expect(handleSetAspectRatio).toHaveBeenCalledWith(35 / 45);
  });
});
