import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChronologyRail, ChronologyMilestone } from '../ChronologyRail';

const mockMilestones: ChronologyMilestone[] = [
  { dateKey: '2026-10-24', label: 'Oct 24 2026' },
  { dateKey: '2026-10-23', label: 'Oct 23 2026' },
  { dateKey: '2026-09-15', label: 'Sep 2026' },
];

describe('ChronologyRail Component', () => {
  it('renders milestones and handles selection', () => {
    const onSelectMilestone = vi.fn();
    const onScrollToTop = vi.fn();

    render(
      <ChronologyRail
        milestones={mockMilestones}
        activeDateKey="2026-10-24"
        onSelectMilestone={onSelectMilestone}
        onScrollToTop={onScrollToTop}
      />
    );

    expect(screen.getByText('Chronology')).toBeTruthy();

    const dotButtons = screen.getAllByRole('button');
    // First milestone button
    fireEvent.click(dotButtons[0]);
    expect(onSelectMilestone).toHaveBeenCalledWith('2026-10-24');

    // Back to top button (last button)
    const backToTopBtn = screen.getByTitle('Back to top');
    fireEvent.click(backToTopBtn);
    expect(onScrollToTop).toHaveBeenCalled();
  });
});
