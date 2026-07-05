import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '@/components/layout/header/Header';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
import { BulkActionsBar } from '@/components/layout/bulk-actions-bar/BulkActionsBar';
import { FloatingActions } from '@/components/layout/floating-actions/FloatingActions';

vi.mock('@/hooks/import', () => ({
  useImport: () => ({
    handleFileUpload: vi.fn(),
    handleFolderImport: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStats', () => ({
  useStats: () => ({
    stats: null,
  } as Record<string, unknown>),
}));

vi.mock('@/store/syncStore', () => ({
  useSyncStore: (selector: (s: { syncStatus: { is_scanning: boolean; total_files: number; processed_files: number; progress: number } }) => unknown) =>
    selector({
      syncStatus: {
        is_scanning: false,
        total_files: 0,
        processed_files: 0,
        progress: 0,
      },
    }),
}));

describe('layout', () => {
  it('renders Header with search bar', () => {
    render(
      <Header
        onSearch={vi.fn()}
        sortMode="newest"
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/query deep library/i)).toBeTruthy();
  });

  it('renders Sidebar with navigation', () => {
    render(<Sidebar currentView="gallery" onChangeView={vi.fn()} />);
    expect(screen.getByText('Prism')).toBeTruthy();
    expect(screen.getByText('Gallery')).toBeTruthy();
  });

  it('renders BulkActionsBar when active', () => {
    render(
      <BulkActionsBar
        selectedCount={2}
        currentView="gallery"
        onClear={vi.fn()}
        onAddToAlbum={vi.fn()}
        onToggleLock={vi.fn()}
        onFavorite={vi.fn()}
        onDelete={vi.fn()}
        isFavorited={false}
      />
    );
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('returns null for BulkActionsBar when nothing selected', () => {
    const { container } = render(
      <BulkActionsBar
        selectedCount={0}
        currentView="gallery"
        onClear={vi.fn()}
        onAddToAlbum={vi.fn()}
        onToggleLock={vi.fn()}
        onFavorite={vi.fn()}
        onDelete={vi.fn()}
        isFavorited={false}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders FloatingActions with progress and check Speed Dial FAB', () => {
    const onUploadMock = vi.fn();
    const onImportProgressMock = vi.fn();
    render(
      <FloatingActions
        importStatus={{
          is_scanning: true,
          total_files: 10,
          processed_files: 3,
          progress: 30,
        }}
        onUpload={onUploadMock}
        onImportProgress={onImportProgressMock}
      />
    );
    expect(screen.getByText(/importing photos/i)).toBeTruthy();
    expect(screen.getByTitle('Import Options')).toBeTruthy();
  });
});
