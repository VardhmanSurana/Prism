import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTransformControls } from '../EditingMode/hooks/useTransformControls';

describe('useTransformControls native crop and transform', () => {
  function setupHook() {
    const history = {
      isRestoringHistory: { current: false },
      createdUrlRef: { current: null },
      addHistoryEntry: vi.fn(),
    };

    const setFlipH = vi.fn();
    const setFlipV = vi.fn();
    const setTotalRotation = vi.fn();
    const setStraightenAngle = vi.fn();
    const setCurrentImageSrc = vi.fn();

    const hook = renderHook(() =>
      useTransformControls({
        src: 'test.jpg',
        currentImageSrc: 'test.jpg',
        flipH: false,
        setFlipH,
        flipV: false,
        setFlipV,
        totalRotation: 0,
        setTotalRotation,
        straightenAngle: 0,
        setStraightenAngle,
        setCurrentImageSrc,
        history: history as any,
      })
    );

    return { hook, setFlipH, setFlipV, setTotalRotation, setStraightenAngle, setCurrentImageSrc, history };
  }

  it('initializes with default full crop rect and no selection', () => {
    const { hook } = setupHook();
    expect(hook.result.current.cropRect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(hook.result.current.hasCropSelection).toBe(false);
  });

  it('updates crop rect and marks hasCropSelection when cropped', () => {
    const { hook } = setupHook();

    act(() => {
      hook.result.current.onCropChange({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    });

    expect(hook.result.current.cropRect).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    expect(hook.result.current.hasCropSelection).toBe(true);
  });

  it('adjusts crop rect to aspect ratio when set', () => {
    const { hook } = setupHook();

    act(() => {
      hook.result.current.handleSetAspectRatio(1); // 1:1
    });

    expect(hook.result.current.currentRatio).toBe(1);
    expect(hook.result.current.cropRect.width).toBe(1);
    expect(hook.result.current.cropRect.height).toBe(1);
    expect(hook.result.current.hasCropSelection).toBe(true);
  });

  it('handles rotation and flips correctly', () => {
    const { hook, setTotalRotation, setFlipH, setFlipV, setStraightenAngle } = setupHook();

    act(() => {
      hook.result.current.handleRotate(90);
    });
    expect(setTotalRotation).toHaveBeenCalledWith(90);

    act(() => {
      hook.result.current.handleFlipH();
    });
    expect(setFlipH).toHaveBeenCalledWith(true);

    act(() => {
      hook.result.current.handleFlipV();
    });
    expect(setFlipV).toHaveBeenCalledWith(true);

    act(() => {
      hook.result.current.handleStraighten(12);
    });
    expect(setStraightenAngle).toHaveBeenCalledWith(12);
  });

  it('resets crop and transform on handleResetCrop', () => {
    const { hook, setCurrentImageSrc, setTotalRotation, setStraightenAngle, setFlipH, setFlipV } = setupHook();

    act(() => {
      hook.result.current.handleResetCrop();
    });

    expect(setCurrentImageSrc).toHaveBeenCalledWith('test.jpg');
    expect(setTotalRotation).toHaveBeenCalledWith(0);
    expect(setStraightenAngle).toHaveBeenCalledWith(0);
    expect(setFlipH).toHaveBeenCalledWith(false);
    expect(setFlipV).toHaveBeenCalledWith(false);
    expect(hook.result.current.hasCropSelection).toBe(false);
  });
});
