import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncConfig } from '../useSyncConfig';
import { registerToastCallback, ToastItem } from '../../../services/ToastService';

/**
 * Simulates the watcher-status polling flow: a manual rescan is requested,
 * the poll sees a fresh completed manual scan, and a completion toast fires
 * with the scan summary.
 */
describe('useSyncConfig rescan completion toast', () => {
  const fetchMock = vi.fn();
  let toasts: ToastItem[] = [];

  beforeEach(() => {
    toasts = [];
    registerToastCallback((t) => toasts.push(t));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    registerToastCallback(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function mockStatusEndpoint(snapshot: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/settings/watcher-status')) {
        return { ok: true, json: async () => snapshot } as Response;
      }
      if (url.endsWith('/settings/watcher/rescan')) {
        return { ok: true, json: async () => ({ status: 'success' }) } as Response;
      }
      if (url.endsWith('/settings/sync')) {
        return { ok: true, json: async () => ({ is_enabled: true }) } as Response;
      }
      if (url.endsWith('/settings/folders')) {
        return { ok: true, json: async () => ({ watched_folders: [], excluded_folders: [] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it('toasts with the import summary when the requested manual scan finishes', async () => {
    // Initial state: nothing scanned yet.
    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 0,
      last_scan_imported: 0,
      last_scan_skipped: 0,
      last_scan_failed: 0,
      last_scan_manual: false,
      last_scan_started_ms: 0,
      last_scan_finished_ms: 0,
    });

    const { result } = renderHook(() => useSyncConfig());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // initial poll
    });

    // User clicks Rescan Now.
    await act(async () => {
      await result.current.rescanNow();
    });

    // Scan starts, then completes with 3 imports (finish_ms "now").
    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 3,
      last_scan_imported: 3,
      last_scan_skipped: 0,
      last_scan_failed: 0,
      last_scan_manual: true,
      last_scan_started_ms: Date.now() - 500,
      last_scan_finished_ms: Date.now(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000); // poll tick
    });

    expect(
      toasts.some((t) => t.variant === 'success' && /3 new photos imported/.test(t.message))
    ).toBe(true);
  });

  it('toasts "no new photos" when the manual scan imports nothing', async () => {
    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 0,
      last_scan_imported: 0,
      last_scan_skipped: 0,
      last_scan_failed: 0,
      last_scan_manual: false,
      last_scan_started_ms: 0,
      last_scan_finished_ms: 0,
    });

    const { result } = renderHook(() => useSyncConfig());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await act(async () => {
      await result.current.rescanNow();
    });

    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 0,
      last_scan_imported: 0,
      last_scan_skipped: 2,
      last_scan_failed: 0,
      last_scan_manual: true,
      last_scan_started_ms: Date.now() - 500,
      last_scan_finished_ms: Date.now(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(
      toasts.some((t) => t.variant === 'info' && /no new photos found/.test(t.message))
    ).toBe(true);
  });

  it('does not toast for automatic scans', async () => {
    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 0,
      last_scan_imported: 0,
      last_scan_failed: 0,
      last_scan_skipped: 0,
      last_scan_manual: false,
      last_scan_started_ms: 0,
      last_scan_finished_ms: 0,
    });

    const { result } = renderHook(() => useSyncConfig());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // A periodic (non-manual) scan completes — no rescan was requested.
    mockStatusEndpoint({
      is_scanning: false,
      auto_enabled: true,
      total_imported: 5,
      last_scan_imported: 5,
      last_scan_skipped: 0,
      last_scan_failed: 0,
      last_scan_manual: false,
      last_scan_started_ms: Date.now() - 500,
      last_scan_finished_ms: Date.now(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(toasts.filter((t) => /Rescan complete/.test(t.message))).toHaveLength(0);
  });
});
