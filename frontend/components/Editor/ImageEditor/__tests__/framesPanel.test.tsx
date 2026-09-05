import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { FramesPanel } from '@plugins/creative-color-studio/FramesPanel';
import { DEFAULT_ADJUSTMENTS, Adjustments } from '../filterEngine';
import { useEditingHistory } from '../EditingMode/useEditingHistory';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

describe('FramesPanel and History Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects polaroid frame style and keeps it selected', async () => {
    const TestComponent = () => {
      const cropperRef = React.useRef(null);
      const [annotations, setAnnotations] = useState<Annotation[]>([]);
      const [past, setPast] = useState<Annotation[][]>([]);
      const [future, setFuture] = useState<Annotation[][]>([]);

      const history = useEditingHistory({
        src: 'test.jpg',
        cropperRef,
        annotations,
        setAnnotations,
        setAnnotationsHistoryPast: setPast,
        setAnnotationsHistoryFuture: setFuture,
        photoId: 1,
      });

      return (
        <div>
          <span data-testid="current-style">{history.adjustments.frame?.style ?? 'none'}</span>
          <FramesPanel
            adjustments={history.adjustments}
            onChange={history.setAdjustments}
            handleRotate={() => {}}
            handleFlipH={() => {}}
            handleFlipV={() => {}}
            flipH={history.flipH}
            flipV={history.flipV}
            imageSrc={history.currentImageSrc}
          />
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('current-style').textContent).toBe('none');

    // Click Polaroid
    const polaroidBtn = screen.getByText('Polaroid').closest('button');
    expect(polaroidBtn).not.toBeNull();

    act(() => {
      fireEvent.click(polaroidBtn!);
    });

    expect(screen.getByTestId('current-style').textContent).toBe('polaroid');

    // Advance timers for history debouncing (500ms in useEditingHistory)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('current-style').textContent).toBe('polaroid');
  });

  it('shows thickness slider and color options when polaroid is selected and updates thickness/color', () => {
    let currentAdj: Adjustments = { ...DEFAULT_ADJUSTMENTS };
    const handleChange = vi.fn((newAdj: Adjustments) => {
      currentAdj = newAdj;
    });

    const { rerender } = render(
      <FramesPanel
        adjustments={currentAdj}
        onChange={handleChange}
        handleRotate={() => {}}
        handleFlipH={() => {}}
        handleFlipV={() => {}}
        flipH={false}
        flipV={false}
      />
    );

    // Click Polaroid button
    const polaroidBtn = screen.getByText('Polaroid').closest('button');
    expect(polaroidBtn).not.toBeNull();
    fireEvent.click(polaroidBtn!);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: expect.objectContaining({
          style: 'polaroid',
        }),
      })
    );

    // Re-render with updated adjustments
    rerender(
      <FramesPanel
        adjustments={currentAdj}
        onChange={handleChange}
        handleRotate={() => {}}
        handleFlipH={() => {}}
        handleFlipV={() => {}}
        flipH={false}
        flipV={false}
      />
    );

    // Thickness slider should be present for polaroid
    const thicknessSlider = screen.getByLabelText(/border thickness/i, { selector: 'input' });
    expect(thicknessSlider).not.toBeNull();

    // Adjust thickness slider
    fireEvent.change(thicknessSlider, { target: { value: '12' } });
    expect(currentAdj.frame.thickness).toBe(12);
    expect(currentAdj.frame.style).toBe('polaroid');

    // Pick Burgundy color
    const burgundyBtn = screen.getByTitle('Burgundy');
    expect(burgundyBtn).not.toBeNull();
    fireEvent.click(burgundyBtn);
    expect(currentAdj.frame.color).toBe('#8c1d1d');
    expect(currentAdj.frame.style).toBe('polaroid');
  });

  it('safely handles adjustments where frame is undefined or missing properties', () => {
    let currentAdj: Adjustments = {
      ...DEFAULT_ADJUSTMENTS,
      frame: undefined as any,
    };
    const handleChange = vi.fn((newAdj: Adjustments) => {
      currentAdj = newAdj;
    });

    const { rerender } = render(
      <FramesPanel
        adjustments={currentAdj}
        onChange={handleChange}
        handleRotate={() => {}}
        handleFlipH={() => {}}
        handleFlipV={() => {}}
        flipH={false}
        flipV={false}
      />
    );

    // Click Polaroid without crashing
    const polaroidBtn = screen.getByText('Polaroid').closest('button');
    fireEvent.click(polaroidBtn!);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: expect.objectContaining({
          style: 'polaroid',
          thickness: 5,
          color: '#ffffff',
        }),
      })
    );

    rerender(
      <FramesPanel
        adjustments={currentAdj}
        onChange={handleChange}
        handleRotate={() => {}}
        handleFlipH={() => {}}
        handleFlipV={() => {}}
        flipH={false}
        flipV={false}
      />
    );

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    expect(resetBtn).not.toBeNull();
    fireEvent.click(resetBtn);

    expect(currentAdj.frame.style).toBe('none');
  });
});
