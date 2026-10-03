import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArchivalRetrospectiveBanner } from '../ArchivalRetrospectiveBanner';
import { Photo } from '../../../types';

const mockPhotos: Photo[] = [
  {
    id: '1',
    filename: 'p1.jpg',
    path: '/1.jpg',
    url: '/1.jpg',
    width: 800,
    height: 600,
    date: '2025-10-02T10:00:00Z',
    caption: 'Autumn Mist over the Douro Terraces',
    location: 'Lisbon & Coastal Studio',
    isFavorite: false,
  },
];

describe('ArchivalRetrospectiveBanner Component', () => {
  it('renders memory title, badge, and triggers relive memory', () => {
    const onRelive = vi.fn();

    render(
      <ArchivalRetrospectiveBanner
        photos={mockPhotos}
        onReliveMemory={onRelive}
      />
    );

    expect(screen.getByText('Archival Retrospective')).toBeTruthy();
    expect(screen.getByText('Autumn Mist over the Douro Terraces')).toBeTruthy();

    const reliveBtn = screen.getByText(/Relive Memory/);
    fireEvent.click(reliveBtn);
    expect(onRelive).toHaveBeenCalledWith(mockPhotos);
  });

  it('can be dismissed with the close button', () => {
    render(
      <ArchivalRetrospectiveBanner
        photos={mockPhotos}
      />
    );

    const closeBtn = screen.getByLabelText('Dismiss memory banner');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Archival Retrospective')).toBeNull();
  });
});
