import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhotoGridSubheader } from '../PhotoGridSubheader';
import { Photo } from '../../../types';

const mockPhotos: Photo[] = [
  { id: '1', filename: 'p1.jpg', path: '/1.jpg', url: '/1.jpg', width: 800, height: 600, date: '2026-01-01T10:00:00Z', isFavorite: false },
  { id: '2', filename: 'p2.jpg', path: '/2.jpg', url: '/2.jpg', width: 800, height: 600, date: '2026-01-02T11:00:00Z', isFavorite: false },
];

describe('PhotoGridSubheader Component', () => {
  it('renders quick date filter pills and responds to clicks', () => {
    const onSelectMilestone = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <PhotoGridSubheader
        photos={mockPhotos}
        selectedCount={0}
        onClearSelection={vi.fn()}
        activeLayoutMode="editorial"
        onLayoutModeChange={vi.fn()}
        onSelectDateMilestone={onSelectMilestone}
        onActiveFilterChange={onFilterChange}
      />
    );

    const allPill = screen.getByText('All Archive');
    expect(allPill).toBeTruthy();

    fireEvent.click(allPill);
    expect(onFilterChange).toHaveBeenCalledWith('all');
    expect(onSelectMilestone).toHaveBeenCalledWith(null);
  });

  it('renders selection banner when selectedCount > 0 and clears selection on click', () => {
    const onClearSelection = vi.fn();

    render(
      <PhotoGridSubheader
        photos={mockPhotos}
        selectedCount={3}
        onClearSelection={onClearSelection}
        activeLayoutMode="editorial"
        onLayoutModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('3 SELECTED')).toBeTruthy();
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('toggles layout modes between Editorial, Grid, and Dense', () => {
    const onLayoutModeChange = vi.fn();

    render(
      <PhotoGridSubheader
        photos={mockPhotos}
        selectedCount={0}
        onClearSelection={vi.fn()}
        activeLayoutMode="editorial"
        onLayoutModeChange={onLayoutModeChange}
      />
    );

    const gridBtn = screen.getByTitle('Justified Aspect Grid');
    fireEvent.click(gridBtn);
    expect(onLayoutModeChange).toHaveBeenCalledWith('grid');

    const denseBtn = screen.getByTitle('Dense Compact Mosaic');
    fireEvent.click(denseBtn);
    expect(onLayoutModeChange).toHaveBeenCalledWith('dense');
  });

  it('triggers monograph click when monograph button is pressed', () => {
    const onMonographClick = vi.fn();

    render(
      <PhotoGridSubheader
        photos={mockPhotos}
        selectedCount={0}
        onClearSelection={vi.fn()}
        activeLayoutMode="editorial"
        onLayoutModeChange={vi.fn()}
        onMonographClick={onMonographClick}
      />
    );

    const monographBtn = screen.getByTitle('Open Monograph Curation View');
    fireEvent.click(monographBtn);
    expect(onMonographClick).toHaveBeenCalled();
  });
});
