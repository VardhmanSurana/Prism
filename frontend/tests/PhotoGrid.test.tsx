import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { PhotoGrid } from '../components/PhotoGrid/PhotoGrid';
import { Photo } from '../types';

// Mock react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () => Array.from({ length: count }).map((_, index) => ({
      index,
      key: String(index),
      start: index * 100,
    })),
    measureElement: () => {},
    measure: () => {},
  })),
}));

// Mock custom hooks
vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    stats: {
      total_photos: 10,
      people_found: 3,
      albums: 2,
      locked_encrypted: 1,
    },
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/import', () => ({
  useImport: () => ({
    handleFileUpload: vi.fn(),
    handleFolderImport: vi.fn(),
  }),
}));

vi.mock('../components/PhotoGrid/hooks/usePhotoGrid', () => ({
  usePhotoGrid: (photos: Photo[]) => {
    if (photos.length === 0) return [];
    return [
      { type: 'header', dateKey: '2026-06-14', photoIds: ['1'], location: 'Home' },
      { type: 'row', photos, isFull: false },
    ];
  },
}));

vi.mock('../components/PhotoGrid/hooks/useTimeline', () => ({
  useTimeline: () => ({
    timelineItems: [] as any[],
    scrollState: { progress: 0, height: 0 },
    activeId: null as any,
  }),
}));

describe('PhotoGrid Component', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      url: '/thumbnails/pic1.webp',
      path: '/home/user/Pictures/pic1.jpg',
      width: 1920,
      height: 1080,
      date: '2026-06-14T10:00:00Z',
      isFavorite: false,
      isLocked: false,
      isTrash: false,
      filename: 'pic1.jpg',
    },
  ];

  const defaultProps = {
    photos: mockPhotos,
    isLoading: false,
    onPhotoClick: vi.fn(),
    selectedIds: new Set<string>(),
    onToggleSelection: vi.fn(),
    onToggleGroupSelection: vi.fn(),
    scrollParentRef: { current: null } as any,
    onSearch: vi.fn(),
    onUpload: vi.fn(),
    onImportProgress: vi.fn(),
    sortMode: 'newest' as const,
    onSortChange: vi.fn(),
    onUpdatePhotos: vi.fn(),
  };

  test('renders grid view dashboard elements correctly', () => {
    render(<PhotoGrid {...defaultProps} />);

    // Check title & subtitle
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('All your moments, organized locally on this device.')).toBeInTheDocument();

    // Check search placeholder
    expect(screen.getByPlaceholderText(/Search by people/i)).toBeInTheDocument();

    // Check statistics cards
    fireEvent.click(screen.getByText('Show Stats'));
    expect(screen.getByText('10')).toBeInTheDocument(); // total photos stats count
    expect(screen.getByText('3')).toBeInTheDocument();  // people found stats count
    expect(screen.getByText('2')).toBeInTheDocument();  // albums count
    expect(screen.getByText('1')).toBeInTheDocument();  // locked files count
  });

  test('renders categories filtering buttons', () => {
    render(<PhotoGrid {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'favorites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'recent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'videos' })).toBeInTheDocument();
  });

  test('displays empty state when photo list is empty', () => {
    render(<PhotoGrid {...defaultProps} photos={[]} />);
    expect(screen.getByText('Your library is empty')).toBeInTheDocument();
    expect(screen.getByText(/Click/i)).toBeInTheDocument();
  });
});
