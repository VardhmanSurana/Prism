import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlinePhotoGrid } from '../InlinePhotoGrid';
import { GalleryDrawer } from '../GalleryDrawer';
import { AgentView } from '../AgentView';

const mockPhotos = [
  { id: '1', url: 'img1.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
  { id: '2', url: 'img2.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
  { id: '3', url: 'img3.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
  { id: '4', url: 'img4.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
  { id: '5', url: 'img5.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
  { id: '6', url: 'img6.jpg', path: '', width: 100, height: 100, date: '', isFavorite: false },
];

describe('InlinePhotoGrid', () => {
  it('renders single photo when one provided', () => {
    const clickSpy = vi.fn();
    render(<InlinePhotoGrid photos={[mockPhotos[0]]} onPhotoClick={clickSpy} onShowMore={vi.fn()} />);
    expect(screen.getByRole('img')).toBeDefined();
  });

  it('renders show more button and triggers callback', () => {
    const showMoreSpy = vi.fn();
    render(<InlinePhotoGrid photos={mockPhotos} onPhotoClick={vi.fn()} onShowMore={showMoreSpy} />);
    expect(screen.getByText('Show all results (6)')).toBeDefined();
    fireEvent.click(screen.getByText('Show all results (6)'));
    expect(showMoreSpy).toHaveBeenCalled();
  });

  it('displays +2 overlay for 6 photos', () => {
    render(<InlinePhotoGrid photos={mockPhotos} onPhotoClick={vi.fn()} onShowMore={vi.fn()} />);
    expect(screen.getByText('+2')).toBeDefined();
  });
});

describe('GalleryDrawer', () => {
  it('renders drawer with correct result count when open', () => {
    const closeSpy = vi.fn();
    render(
      <GalleryDrawer
        photos={mockPhotos}
        isOpen={true}
        onClose={closeSpy}
        onPhotoClick={vi.fn()}
      />
    );
    expect(screen.getByText('Search Results (6 matches)')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(closeSpy).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <GalleryDrawer
        photos={mockPhotos}
        isOpen={false}
        onClose={vi.fn()}
        onPhotoClick={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});

// Mock hooks
vi.mock('../useAgentView', () => ({
  useAgentView: () => ({
    messages: [{ role: 'assistant', content: 'Hello' }],
    input: '',
    isLoading: false,
    progressDetail: null as string | null,
    currentPhotos: [] as any[],
    currentPlan: null as any,
    currentTools: [] as any[],
    totalCandidates: null as number | null,
    expandedLogs: {} as Record<number, boolean>,
    scrollRef: { current: null as any },
    setInput: vi.fn(),
    toggleLog: vi.fn(),
    handleSend: vi.fn(),
    clearResults: vi.fn(),
  })
}));

describe('AgentView Integration', () => {
  it('renders AgentView container successfully', () => {
    render(<AgentView onPhotoClick={vi.fn()} />);
    expect(screen.getByText('Prism AI Assistant')).toBeDefined();
  });
});
