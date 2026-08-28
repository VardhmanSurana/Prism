import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { HistoryPanel } from '../HistoryPanel';
import { HistoryEntry } from '../history';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

const mockEntries: HistoryEntry[] = [
  {
    id: 'entry-1',
    type: 'initial',
    description: 'Original image',
    imageSrc: 'test.jpg',
    adjustments: DEFAULT_ADJUSTMENTS,
    rotation: 0,
    flipH: false,
    flipV: false,
    straightenAngle: 0,
    hidden: false,
  },
  {
    id: 'entry-2',
    type: 'exposure',
    description: 'Exposure +0.50',
    value: 0.5,
    imageSrc: 'test.jpg',
    adjustments: { ...DEFAULT_ADJUSTMENTS, exposure: 0.5 },
    rotation: 0,
    flipH: false,
    flipV: false,
    straightenAngle: 0,
    hidden: false,
    toolId: 'adjust',
  },
];

describe('HistoryPanel Component', () => {
  it('renders timeline entries and fires callbacks for hide, del, edit, and jump', () => {
    const onToggleHide = vi.fn();
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const onJump = vi.fn();

    render(
      <HistoryPanel
        history={mockEntries}
        currentHistoryIndex={1}
        onToggleHide={onToggleHide}
        onDelete={onDelete}
        onEdit={onEdit}
        onJump={onJump}
      />
    );

    expect(screen.getByText('Exposure +0.50')).toBeDefined();
    expect(screen.getByText('Original image')).toBeDefined();

    const hideBtn = screen.getByText('hide');
    fireEvent.click(hideBtn);
    expect(onToggleHide).toHaveBeenCalledWith('entry-2');

    const delBtn = screen.getByText('del');
    fireEvent.click(delBtn);
    expect(onDelete).toHaveBeenCalledWith('entry-2');

    const editBtn = screen.getByText('edit');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockEntries[1]);

    const originalRow = screen.getByText('Original image');
    fireEvent.click(originalRow);
    expect(onJump).toHaveBeenCalledWith(0);
  });
});
