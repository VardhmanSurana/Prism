import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WebImportModal } from '../WebImportModal';

describe('WebImportModal', () => {
  it('does not render when isOpen is false', () => {
    render(<WebImportModal isOpen={false} onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.queryByText('Import from Web')).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(<WebImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText('Import from Web')).toBeTruthy();
    expect(screen.getByLabelText(/media web address/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/direct image link/i)).toBeTruthy();
  });

  it('validates URL and calls onImport with valid url', async () => {
    const onImportMock = vi.fn().mockResolvedValue({ id: 1, filename: 'test.jpg' });
    const onCloseMock = vi.fn();

    render(<WebImportModal isOpen={true} onClose={onCloseMock} onImport={onImportMock} />);

    const input = screen.getByPlaceholderText(/direct image link/i);
    const submitBtn = screen.getByText('Import to Library');

    // Type valid URL
    fireEvent.change(input, { target: { value: 'https://images.unsplash.com/photo-123.jpg' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onImportMock).toHaveBeenCalledWith('https://images.unsplash.com/photo-123.jpg');
    });
  });

  it('displays error message on invalid URL', async () => {
    const onImportMock = vi.fn();
    render(<WebImportModal isOpen={true} onClose={vi.fn()} onImport={onImportMock} />);

    const input = screen.getByPlaceholderText(/direct image link/i);
    const submitBtn = screen.getByText('Import to Library');

    fireEvent.change(input, { target: { value: 'not-a-valid-url' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/please enter a valid http or https url/i)).toBeTruthy();
    expect(onImportMock).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onCloseMock = vi.fn();
    render(<WebImportModal isOpen={true} onClose={onCloseMock} onImport={vi.fn()} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCloseMock).toHaveBeenCalled();
  });
});
