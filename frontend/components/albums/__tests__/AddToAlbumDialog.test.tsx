import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddToAlbumDialog } from '../AddToAlbumDialog';
import { Album } from '../../../types';

const mockAlbums: Album[] = [
  { id: 1, name: 'Vacation', photo_count: 10, type: 'custom' },
  { id: 2, name: 'Family', photo_count: 5, type: 'custom' },
];

describe('AddToAlbumDialog Accessibility & Interactions', () => {
  it('renders with accessible dialog attributes', () => {
    render(
      <AddToAlbumDialog
        isOpen={true}
        onClose={vi.fn()}
        albums={mockAlbums}
        onSelectAlbum={vi.fn()}
        onCreateAlbum={vi.fn()}
        selectedCount={2}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('add-to-album-title');
    expect(screen.getByText('Add to album')).toBeTruthy();
  });

  it('invokes onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <AddToAlbumDialog
        isOpen={true}
        onClose={onClose}
        albums={mockAlbums}
        onSelectAlbum={vi.fn()}
        onCreateAlbum={vi.fn()}
        selectedCount={2}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('invokes onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AddToAlbumDialog
        isOpen={true}
        onClose={onClose}
        albums={mockAlbums}
        onSelectAlbum={vi.fn()}
        onCreateAlbum={vi.fn()}
        selectedCount={2}
      />
    );

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(
      <AddToAlbumDialog
        isOpen={false}
        onClose={vi.fn()}
        albums={mockAlbums}
        onSelectAlbum={vi.fn()}
        onCreateAlbum={vi.fn()}
        selectedCount={2}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
