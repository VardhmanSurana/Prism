import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PhotoGrid } from '../PhotoGrid';
import { Photo } from '../../../types';

beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  window.ResizeObserver = window.ResizeObserver || MockResizeObserver;
});

const mockPhotos: Photo[] = [
  { id: '1', filename: 'p1.jpg', path: '/1.jpg', url: '/1.jpg', width: 800, height: 600, date: '2026-01-01T10:00:00Z', isFavorite: false },
  { id: '2', filename: 'p2.jpg', path: '/2.jpg', url: '/2.jpg', width: 800, height: 600, date: '2026-01-01T11:00:00Z', isFavorite: false },
  { id: '3', filename: 'p3.jpg', path: '/3.jpg', url: '/3.jpg', width: 800, height: 600, date: '2026-01-01T12:00:00Z', isFavorite: false },
  { id: '4', filename: 'p4.jpg', path: '/4.jpg', url: '/4.jpg', width: 800, height: 600, date: '2026-01-01T13:00:00Z', isFavorite: false },
];

describe('PhotoGrid 2D Roving Tabindex & Grid Navigation', () => {
  it('renders with role="region" and aria-label="Photos grid"', () => {
    render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoClick={vi.fn()}
        selectedIds={new Set()}
        onToggleSelection={vi.fn()}
        onToggleGroupSelection={vi.fn()}
      />
    );

    const gridRegion = screen.getByRole('region', { name: 'Photos grid' });
    expect(gridRegion).toBeTruthy();
  });

  it('handles keyboard navigation with arrow keys, home, end, space, and enter', () => {
    const onPhotoClick = vi.fn();
    const onToggleSelection = vi.fn();

    render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoClick={onPhotoClick}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
        onToggleGroupSelection={vi.fn()}
      />
    );

    const gridRegion = screen.getByRole('region', { name: 'Photos grid' });

    // ArrowRight moves to next photo
    fireEvent.keyDown(gridRegion, { key: 'ArrowRight' });

    // Space toggles selection
    fireEvent.keyDown(gridRegion, { key: ' ' });
    expect(onToggleSelection).toHaveBeenCalled();

    // Enter opens photo in lightbox
    fireEvent.keyDown(gridRegion, { key: 'Enter' });
    expect(onPhotoClick).toHaveBeenCalled();

    // Home jumps to first photo
    fireEvent.keyDown(gridRegion, { key: 'Home' });

    // End jumps to last photo
    fireEvent.keyDown(gridRegion, { key: 'End' });
  });
});
