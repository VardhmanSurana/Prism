import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { LiveAnnouncer } from '../LiveAnnouncer';
import { useAnnounce, useAnnounceStore } from '@/hooks/useAnnounce';

const TestComponent = () => {
  const { announce, clear } = useAnnounce();
  return (
    <div>
      <button onClick={() => announce('5 photos selected')}>Select 5</button>
      <button onClick={() => announce('File deleted', 'assertive')}>Delete File</button>
      <button onClick={() => clear()}>Clear</button>
    </div>
  );
};

describe('LiveAnnouncer & useAnnounce', () => {
  beforeEach(() => {
    act(() => {
      useAnnounceStore.getState().clear();
    });
  });

  it('renders polite and assertive aria-live regions', () => {
    render(<LiveAnnouncer />);
    const politeRegion = screen.getByTestId('live-announcer-polite');
    const assertiveRegion = screen.getByTestId('live-announcer-assertive');

    expect(politeRegion).toBeTruthy();
    expect(politeRegion.getAttribute('aria-live')).toBe('polite');
    expect(politeRegion.getAttribute('aria-atomic')).toBe('true');

    expect(assertiveRegion).toBeTruthy();
    expect(assertiveRegion.getAttribute('aria-live')).toBe('assertive');
    expect(assertiveRegion.getAttribute('aria-atomic')).toBe('true');
  });

  it('announces polite message by default', () => {
    render(
      <>
        <LiveAnnouncer />
        <TestComponent />
      </>
    );

    const selectBtn = screen.getByText('Select 5');
    act(() => {
      selectBtn.click();
    });

    const politeRegion = screen.getByTestId('live-announcer-polite');
    expect(politeRegion.textContent).toBe('5 photos selected');
    expect(screen.getByTestId('live-announcer-assertive').textContent).toBe('');
  });

  it('announces assertive message when requested', () => {
    render(
      <>
        <LiveAnnouncer />
        <TestComponent />
      </>
    );

    const deleteBtn = screen.getByText('Delete File');
    act(() => {
      deleteBtn.click();
    });

    const assertiveRegion = screen.getByTestId('live-announcer-assertive');
    expect(assertiveRegion.textContent).toBe('File deleted');
  });

  it('clears announcements when clear is called', () => {
    render(
      <>
        <LiveAnnouncer />
        <TestComponent />
      </>
    );

    act(() => {
      screen.getByText('Select 5').click();
    });
    expect(screen.getByTestId('live-announcer-polite').textContent).toBe('5 photos selected');

    act(() => {
      screen.getByText('Clear').click();
    });
    expect(screen.getByTestId('live-announcer-polite').textContent).toBe('');
  });
});
