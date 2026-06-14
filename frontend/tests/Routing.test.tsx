import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { Sidebar } from '../components/Sidebar';

// Mock useStats hook
vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    stats: {
      total_size_bytes: 1048576 * 50, // 50 MB
    },
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('Sidebar Routing Component', () => {
  test('renders navigation sections and items', () => {
    render(<Sidebar currentView="gallery" onChangeView={vi.fn()} />);

    // Check brand
    expect(screen.getByText('Prism')).toBeInTheDocument();

    // Check main navigation links
    expect(screen.getByText('Gallery')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Map')).toBeInTheDocument();
    expect(screen.getByText('Prism AI')).toBeInTheDocument();

    // Check category headers
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getAllByText('Utilities').length).toBe(2); // Section header and Nav item

    // Check library sub-navigation
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Albums')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();

    // Check utilities navigation
    expect(screen.getByText('Locked Folder')).toBeInTheDocument();
  });

  test('calculates and displays active storage size in MB', () => {
    render(<Sidebar currentView="gallery" onChangeView={vi.fn()} />);
    
    // 50 MB should be rendered
    expect(screen.getByText('50.0 MB used')).toBeInTheDocument();
  });

  test('calls onChangeView when navigation button is clicked', () => {
    const onChangeViewMock = vi.fn();
    render(<Sidebar currentView="gallery" onChangeView={onChangeViewMock} />);

    // Click "Locked Folder" nav button
    const lockedBtn = screen.getByText('Locked Folder');
    fireEvent.click(lockedBtn);

    expect(onChangeViewMock).toHaveBeenCalledWith('locked');
  });
});
