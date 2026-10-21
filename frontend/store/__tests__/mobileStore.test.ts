import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getApiBase, setApiBase } from '../../constants';
import { useMobileStore, STORAGE_KEY } from '../mobileStore';
import { openWebFileObjectsDialog } from '../../platform';

describe('getApiBase LAN auto-discovery & mobileStore', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    useMobileStore.setState({
      serverUrl: 'http://127.0.0.1:8269',
      isPaired: false,
      lastConnected: null,
      autoBackupEnabled: false,
      backupOnWifiOnly: true,
      backupVideos: true,
      lastBackupAt: null,
      offlineCacheEnabled: true,
      backupQueue: [],
      isBackingUp: false,
      backupStatus: 'idle',
      backupProgress: 0,
      pendingCount: 0,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('returns http://127.0.0.1:8269 when on localhost or 127.0.0.1 and prism_server_url is not set', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        hostname: 'localhost',
        protocol: 'http:',
        port: '3005',
        origin: 'http://localhost:3005',
      },
    });
    expect(getApiBase()).toBe('http://127.0.0.1:8269');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        hostname: '127.0.0.1',
        protocol: 'http:',
        port: '3005',
        origin: 'http://127.0.0.1:3005',
      },
    });
    expect(getApiBase()).toBe('http://127.0.0.1:8269');
  });

  it('auto-detects LAN host IP when accessed from a non-loopback hostname', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        hostname: '192.168.1.50',
        protocol: 'http:',
        port: '3005',
        origin: 'http://192.168.1.50:3005',
      },
    });
    expect(getApiBase()).toBe('http://192.168.1.50:8269');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        hostname: '192.168.1.50',
        protocol: 'http:',
        port: '8269',
        origin: 'http://192.168.1.50:8269',
      },
    });
    expect(getApiBase()).toBe('http://192.168.1.50:8269');
  });

  it('prioritizes saved prism_server_url in localStorage over LAN hostname', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        hostname: '192.168.1.50',
        protocol: 'http:',
        port: '3005',
        origin: 'http://192.168.1.50:3005',
      },
    });
    setApiBase('http://10.0.0.99:8269/');
    expect(getApiBase()).toBe('http://10.0.0.99:8269');
  });

  it('persists settings to localStorage and syncs setServerUrl with getApiBase()', () => {
    const store = useMobileStore.getState();
    store.setServerUrl('http://192.168.1.88:8269/');
    store.setAutoBackupEnabled(true);
    store.setBackupOnWifiOnly(false);
    store.setBackupVideos(false);

    expect(useMobileStore.getState().serverUrl).toBe('http://192.168.1.88:8269');
    expect(getApiBase()).toBe('http://192.168.1.88:8269');

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    expect(persisted).toMatchObject({
      serverUrl: 'http://192.168.1.88:8269',
      autoBackupEnabled: true,
      backupOnWifiOnly: false,
      backupVideos: false,
    });

    // Hydrate after resetting state in memory
    useMobileStore.setState({
      serverUrl: 'http://127.0.0.1:8269',
      autoBackupEnabled: false,
      backupOnWifiOnly: true,
      backupVideos: true,
    });
    useMobileStore.getState().hydrateFromStorage();
    expect(useMobileStore.getState().serverUrl).toBe('http://192.168.1.88:8269');
    expect(useMobileStore.getState().autoBackupEnabled).toBe(true);
    expect(useMobileStore.getState().backupOnWifiOnly).toBe(false);
    expect(useMobileStore.getState().backupVideos).toBe(false);
  });

  it('uploads files via backupFiles, updates progress/status/lastBackupAt, and filters videos when backupVideos is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'photo-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    useMobileStore.getState().setServerUrl('http://192.168.1.50:8269');
    useMobileStore.getState().setBackupVideos(false);

    const photo1 = new File(['img-bytes-1'], 'vacation.jpg', { type: 'image/jpeg' });
    const video1 = new File(['vid-bytes-1'], 'clip.mp4', { type: 'video/mp4' });
    const photo2 = new File(['img-bytes-2'], 'sunset.png', { type: 'image/png' });

    const result = await useMobileStore.getState().backupFiles([photo1, video1, photo2]);

    expect(result).toEqual({ uploaded: 2, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://192.168.1.50:8269/api/v1/photos/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );

    const finalState = useMobileStore.getState();
    expect(finalState.backupStatus).toBe('completed');
    expect(finalState.backupProgress).toBe(100);
    expect(finalState.pendingCount).toBe(0);
    expect(finalState.isBackingUp).toBe(false);
    expect(finalState.lastBackupAt).toBeTruthy();

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.lastBackupAt).toBe(finalState.lastBackupAt);
  });

  it('sets backupStatus to error when all file uploads fail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', fetchMock);

    const photo = new File(['img'], 'broken.jpg', { type: 'image/jpeg' });
    const result = await useMobileStore.getState().backupFiles([photo]);

    expect(result).toEqual({ uploaded: 0, failed: 1 });
    expect(useMobileStore.getState().backupStatus).toBe('error');
    expect(useMobileStore.getState().backupProgress).toBe(100);
    expect(useMobileStore.getState().pendingCount).toBe(0);
  });

  it('openWebFileObjectsDialog resolves with selected File[] objects', async () => {
    const file = new File(['hello'], 'camera.jpg', { type: 'image/jpeg' });
    const origCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName) as HTMLInputElement;
      if (tagName === 'input') {
        vi.spyOn(el, 'click').mockImplementation(() => {
          Object.defineProperty(el, 'files', {
            configurable: true,
            value: [file],
          });
          el.onchange?.(new Event('change') as any);
        });
      }
      return el;
    });

    const selected = await openWebFileObjectsDialog({ multiple: true, accept: 'image/*' });
    expect(selected).toHaveLength(1);
    expect(selected?.[0].name).toBe('camera.jpg');
  });
});
