import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhotoItem } from '../PhotoItem';
import { Photo } from '../../../types';

const mockPhoto: Photo = {
  id: 'photo-1',
  filename: 'test.jpg',
  path: '/path/test.jpg',
  url: '/path/test.jpg',
  width: 1920,
  height: 1080,
  date: '2026-01-01T12:00:00Z',
  caption: 'Beautiful sunset',
  isFavorite: false,
};

describe('PhotoItem Roving Tabindex & Keyboard Navigation', () => {
  it('renders tabIndex=0 when isFocused is true', () => {
    render(
      <PhotoItem
        photo={mockPhoto}
        isSelected={false}
        isSelectionMode={false}
        isFullRow={false}
        rowHeight={280}
        rowPadding={8}
        onPhotoClick={vi.fn()}
        onToggleSelection={vi.fn()}
        isRowHovered={false}
        isFocused={true}
      />
    );

    const item = screen.getByRole('button');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.getAttribute('data-photo-id')).toBe('photo-1');
  });

  it('renders tabIndex=-1 when isFocused is false', () => {
    render(
      <PhotoItem
        photo={mockPhoto}
        isSelected={false}
        isSelectionMode={false}
        isFullRow={false}
        rowHeight={280}
        rowPadding={8}
        onPhotoClick={vi.fn()}
        onToggleSelection={vi.fn()}
        isRowHovered={false}
        isFocused={false}
      />
    );

    const item = screen.getByRole('button');
    expect(item.getAttribute('tabindex')).toBe('-1');
  });

  it('invokes onToggleSelection when Space key is pressed', () => {
    const onToggleSelection = vi.fn();
    render(
      <PhotoItem
        photo={mockPhoto}
        isSelected={false}
        isSelectionMode={false}
        isFullRow={false}
        rowHeight={280}
        rowPadding={8}
        onPhotoClick={vi.fn()}
        onToggleSelection={onToggleSelection}
        isRowHovered={false}
        isFocused={true}
      />
    );

    const item = screen.getByRole('button');
    fireEvent.keyDown(item, { key: ' ' });
    expect(onToggleSelection).toHaveBeenCalledWith('photo-1');
  });

  it('invokes onPhotoClick when Enter key is pressed', () => {
    const onPhotoClick = vi.fn();
    render(
      <PhotoItem
        photo={mockPhoto}
        isSelected={false}
        isSelectionMode={false}
        isFullRow={false}
        rowHeight={280}
        rowPadding={8}
        onPhotoClick={onPhotoClick}
        onToggleSelection={vi.fn()}
        isRowHovered={false}
        isFocused={true}
      />
    );

    const item = screen.getByRole('button');
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onPhotoClick).toHaveBeenCalledWith(mockPhoto);
  });
});
