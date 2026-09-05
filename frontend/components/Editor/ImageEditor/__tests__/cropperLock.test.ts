import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCropperSetup } from '../useCropperSetup';

vi.mock('cropperjs', () => ({
  default: vi.fn(),
}));

import Cropper from 'cropperjs';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

function MockCropper(this: any) {
  return currentMock;
}
let currentMock: any;

describe('useCropperSetup canvas lock', () => {
  let mockCropper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCropper = {
      options: {},      getCanvasData: vi.fn(() => ({ left: 0, top: 0, width: 400, height: 300 })),
      getContainerData: vi.fn(() => ({ width: 600, height: 400 })),
      getImageData: vi.fn(() => ({ naturalWidth: 800, naturalHeight: 600 })),
      setDragMode: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      clear: vi.fn(),
      crop: vi.fn(),
      replace: vi.fn(),
      destroy: vi.fn(),
      zoomTo: vi.fn(),
    };
    currentMock = mockCropper;
    (Cropper as unknown as ReturnType<typeof vi.fn>).mockImplementation(MockCropper as any);
  });

  function setup(activeTool: any) {
    const img = document.createElement('img');
    const container = document.createElement('div');
    document.body.appendChild(img);
    document.body.appendChild(container);
    const cropperRef = { current: null as any };
    renderHook(() =>
      useCropperSetup({
        imgRef: { current: img },
        containerRef: { current: container },
        cropperRef,
        currentImageSrc: 'test.jpg',
        activeTool,
        handleCropEvent: vi.fn(),
        handleReady: vi.fn(),
        updateImageRect: vi.fn(),
        syncZoom: vi.fn(),
      })
    );
    img.remove();
    container.remove();
  }

  it('disables event-driven canvas moves outside transform mode', () => {
    setup('annotations');
    expect(mockCropper.disable).toHaveBeenCalled();
  });

  it('leaves cropper enabled in transform mode', () => {
    setup('transform');
    expect(mockCropper.disable).not.toHaveBeenCalled();
    expect(mockCropper.enable).toHaveBeenCalled();
  });
});
