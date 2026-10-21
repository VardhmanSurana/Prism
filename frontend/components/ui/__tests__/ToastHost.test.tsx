import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToastItem,
  dismissToast,
  registerDismissCallback,
  registerToastCallback,
  showToast,
} from '../../../services/ToastService';
import { ToastHost } from '../ToastHost';

// jsdom + fake timers never complete framer-motion exit animations, which
// would keep dismissed cards mounted. Render plain elements instead — the
// animation is not what these tests verify.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ initial, animate, exit, transition, ...rest }: Record<string, unknown>) =>
          React.createElement(tag, rest);
        Component.displayName = `motion.${tag}`;
        return Component;
      },
    }
  ),
}));

/**
 * Rescan-completion toast flow:
 * 1. ToastHost is mounted (registers the global callbacks).
 * 2. showToast(...) is called from outside React (e.g. useSyncConfig's poll).
 * 3. The toast renders, announces politely, and dismisses (manual + auto).
 *
 * Note: the aria-live region mirrors the latest message, so toast-card
 * assertions are scoped to the notifications region.
 */
describe('ToastHost + ToastService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    registerToastCallback(null);
    registerDismissCallback(null);
  });

  function getRegion() {
    return within(screen.getByRole('region', { name: 'Notifications' }));
  }

  function getLiveRegion(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[aria-live="polite"]');
  }

  it('renders a toast fired from outside React and reports its variant', () => {
    render(<ToastHost />);

    act(() => {
      showToast('Rescan complete — 3 new photos imported', { variant: 'success' });
    });

    const region = getRegion();
    expect(region.getByText('Rescan complete — 3 new photos imported')).toBeTruthy();
    // Variant surfaced for tests/consumers via data-testid wrapper.
    expect(region.getByTestId('toast-success')).toBeTruthy();
    // Dismiss affordance is accessible.
    expect(region.getByRole('button', { name: 'Dismiss notification' })).toBeTruthy();
    // Live region mirrors the message for screen readers.
    expect(getLiveRegion()?.textContent).toBe('Rescan complete — 3 new photos imported');
  });

  it('fires the dismiss handler when the close button is clicked', () => {
    render(<ToastHost />);

    act(() => {
      showToast('Temporary message');
    });
    expect(getRegion().getByText('Temporary message')).toBeTruthy();

    fireEvent.click(getRegion().getByRole('button', { name: 'Dismiss notification' }));
    expect(getRegion().queryByText('Temporary message')).toBeNull();
  });

  it('auto-dismisses after the requested duration', () => {
    render(<ToastHost />);

    act(() => {
      showToast('Self dismissing', { durationMs: 1000 });
    });
    expect(getRegion().getByText('Self dismissing')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(getRegion().queryByText('Self dismissing')).toBeNull();
  });

  it('caps the visible stack at 5 toasts', () => {
    render(<ToastHost />);

    act(() => {
      for (let i = 0; i < 8; i++) showToast(`Toast number ${i}`);
    });

    expect(getRegion().getAllByText(/Toast number \d/).length).toBe(5);
  });

  it('warns instead of throwing when no host is registered', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = showToast('Nobody is listening');
    expect(id).toBeTruthy();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('dismissToast forwards an id to the registered handler', () => {
    const received: string[] = [];
    registerDismissCallback((id) => received.push(id));
    const item: ToastItem = {
      id: 'abc',
      message: 'm',
      variant: 'info',
      durationMs: 1000,
    };
    expect(item.message).toBe('m');
    dismissToast('abc');
    expect(received).toEqual(['abc']);
    registerDismissCallback(null);
  });

  it('keeps the last message in the polite live region', () => {
    render(<ToastHost />);
    act(() => {
      showToast('First');
      showToast('Second');
    });
    expect(getLiveRegion()?.textContent).toBe('Second');
  });
});
