import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTransformControls } from '../EditingMode/hooks/useTransformControls';

describe('useTransformControls crop boundary clamping', () => {
  function createMockCropper(canvasData = { left: 100, top: 50, width: 400, height: 300 }) {
    let cropBoxData = { left: 100, top: 50, width: 400, height: 300 };
    let cropped = false;

    const cropper: any = {
      limited: false,
      options: { viewMode: 0 },
      getContainerData: vi.fn(() => ({ width: 600, height: 400 })),
      getCanvasData: vi.fn(() => ({ ...canvasData })),
      getCropBoxData: vi.fn(() => (cropped ? { ...cropBoxData } : {})),
      setCropBoxData: vi.fn((data: any) => {
        cropBoxData = { ...cropBoxData, ...data };
      }),
      setCanvasData: vi.fn(),
      setAspectRatio: vi.fn(),
      setDragMode: vi.fn(),
      crop: vi.fn(() => {
        cropped = true;
      }),
      clear: vi.fn(() => {
        cropped = false;
      }),
      rotate: vi.fn(),
      scaleX: vi.fn(),
      scaleY: vi.fn(),
      getImageData: vi.fn(() => ({ naturalWidth: 800, naturalHeight: 600 })),
    };

    return { cropper, getCropBox: () => cropBoxData };
  }

  function setupHook(mockCropper: any) {
    const cropperRef = { current: mockCropper };
    const history = {
      isRestoringHistory: { current: false },
      createdUrlRef: { current: null },
      addHistoryEntry: vi.fn(),
    };

    return renderHook(() =>
      useTransformControls({
        src: 'test.jpg',
        cropperRef,
        flipH: false,
        setFlipH: vi.fn(),
        flipV: false,
        setFlipV: vi.fn(),
        totalRotation: 0,
        setTotalRotation: vi.fn(),
        straightenAngle: 0,
        setStraightenAngle: vi.fn(),
        setCurrentImageSrc: vi.fn(),
        history: history as any,
      })
    );
  }

  it('enforces viewMode: 1 and limited: true and defaults crop box to canvas bounds', () => {
    const { cropper, getCropBox } = createMockCropper({ left: 50, top: 40, width: 500, height: 320 });
    const { result } = setupHook(cropper);

    act(() => {
      result.current.setActiveTool('transform');
    });

    expect(cropper.limited).toBe(true);
    expect(cropper.options.viewMode).toBe(1);
    expect(cropper.setDragMode).toHaveBeenCalledWith('crop');
    expect(cropper.crop).toHaveBeenCalled();

    const cropBox = getCropBox();
    expect(cropBox.left).toBe(50);
    expect(cropBox.top).toBe(40);
    expect(cropBox.width).toBe(500);
    expect(cropBox.height).toBe(320);
  });

  it('clamps out-of-bounds saved crop box to within image canvas bounds', () => {
    const { cropper, getCropBox } = createMockCropper({ left: 100, top: 50, width: 400, height: 300 });
    const { result } = setupHook(cropper);

    // Enter transform
    act(() => {
      result.current.setActiveTool('transform');
    });

    // Simulate switching away while crop box was larger than canvas
    cropper.getCropBoxData.mockReturnValue({ left: 0, top: 0, width: 600, height: 400 });
    act(() => {
      result.current.setActiveTool('adjust');
    });

    // Switch back to transform
    act(() => {
      result.current.setActiveTool('transform');
    });

    const cropBox = getCropBox();
    // Must be clamped inside canvas (left >= 100, top >= 50, width <= 400, height <= 300)
    expect(cropBox.left).toBeGreaterThanOrEqual(100);
    expect(cropBox.top).toBeGreaterThanOrEqual(50);
    expect(cropBox.width).toBeLessThanOrEqual(400);
    expect(cropBox.height).toBeLessThanOrEqual(300);
    expect(cropBox.left + cropBox.width).toBeLessThanOrEqual(500);
    expect(cropBox.top + cropBox.height).toBeLessThanOrEqual(350);
  });

  it('enforces viewMode 1 and limited true when aspect ratio is set', () => {
    const { cropper } = createMockCropper();
    const { result } = setupHook(cropper);

    act(() => {
      result.current.handleSetAspectRatio(1);
    });

    expect(cropper.limited).toBe(true);
    expect(cropper.options.viewMode).toBe(1);
    expect(cropper.setAspectRatio).toHaveBeenCalledWith(1);
  });

  it('calls setCanvasData before setCropBoxData in handleReady', () => {
    const { cropper } = createMockCropper({ left: 0, top: 0, width: 400, height: 300 });
    const { result } = setupHook(cropper);

    act(() => {
      result.current.setActiveTool('transform');
    });

    const callOrder: string[] = [];
    cropper.setCanvasData.mockImplementation(() => callOrder.push('setCanvasData'));
    cropper.setCropBoxData.mockImplementation(() => callOrder.push('setCropBoxData'));

    act(() => {
      result.current.handleReady();
    });

    expect(cropper.limited).toBe(true);
    expect(cropper.options.viewMode).toBe(1);
    expect(callOrder.indexOf('setCanvasData')).toBeLessThan(callOrder.indexOf('setCropBoxData'));
    expect(callOrder.indexOf('setCanvasData')).not.toBe(-1);
    expect(callOrder.indexOf('setCropBoxData')).not.toBe(-1);
  });

  it('does not reset crop box when setActiveTool is called repeatedly with transform', () => {
    const { cropper, getCropBox } = createMockCropper({ left: 100, top: 50, width: 400, height: 300 });
    const { result } = setupHook(cropper);

    act(() => {
      result.current.setActiveTool('transform');
    });

    // Simulate user resizing crop box inwards
    cropper.setCropBoxData({ left: 150, top: 80, width: 250, height: 180 });

    // Calling setActiveTool('transform') again should be a no-op and NOT reset to 400x300
    act(() => {
      result.current.setActiveTool('transform');
    });

    const cropBox = getCropBox();
    expect(cropBox.left).toBe(150);
    expect(cropBox.top).toBe(80);
    expect(cropBox.width).toBe(250);
    expect(cropBox.height).toBe(180);
  });
});
