import { create } from 'zustand';
import { getApiBase, setApiBase } from '../constants';

export interface BackupItem {
  id: string;
  filename: string;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
}

export type BackupStatus = 'idle' | 'backing_up' | 'completed' | 'error';

export interface PersistedMobileSettings {
  serverUrl: string;
  isPaired: boolean;
  lastConnected: string | null;
  autoBackupEnabled: boolean;
  backupOnWifiOnly: boolean;
  backupVideos: boolean;
  lastBackupAt: string | null;
  offlineCacheEnabled: boolean;
}

export interface MobileState extends PersistedMobileSettings {
  // Server Pairing State
  pairingPin: string;

  // Auto-backup Queue & Progress
  backupQueue: BackupItem[];
  isBackingUp: boolean;
  backupStatus: BackupStatus;
  backupProgress: number;
  pendingCount: number;

  // Offline Cache
  cachedPhotoCount: number;

  // Actions
  setServerUrl: (url: string) => void;
  setPaired: (isPaired: boolean) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  setBackupOnWifiOnly: (enabled: boolean) => void;
  setBackupVideos: (enabled: boolean) => void;
  setOfflineCacheEnabled: (enabled: boolean) => void;
  addToBackupQueue: (item: BackupItem) => void;
  updateBackupProgress: (id: string, progress: number, status: BackupItem['status']) => void;
  clearCompletedBackups: () => void;
  backupFiles: (files: File[] | FileList) => Promise<{ uploaded: number; failed: number }>;
  hydrateFromStorage: () => void;
}

export const STORAGE_KEY = 'prism_mobile_store';

function loadPersistedSettings(): PersistedMobileSettings {
  const defaults: PersistedMobileSettings = {
    serverUrl: getApiBase(),
    isPaired: false,
    lastConnected: null,
    autoBackupEnabled: false,
    backupOnWifiOnly: true,
    backupVideos: true,
    lastBackupAt: null,
    offlineCacheEnabled: true,
  };

  if (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.localStorage.getItem === 'function'
  ) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedMobileSettings>;
        return {
          serverUrl:
            typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim().length > 0
              ? parsed.serverUrl.trim().replace(/\/+$/, '')
              : defaults.serverUrl,
          isPaired: typeof parsed.isPaired === 'boolean' ? parsed.isPaired : defaults.isPaired,
          lastConnected:
            typeof parsed.lastConnected === 'string' ? parsed.lastConnected : defaults.lastConnected,
          autoBackupEnabled:
            typeof parsed.autoBackupEnabled === 'boolean'
              ? parsed.autoBackupEnabled
              : defaults.autoBackupEnabled,
          backupOnWifiOnly:
            typeof parsed.backupOnWifiOnly === 'boolean'
              ? parsed.backupOnWifiOnly
              : defaults.backupOnWifiOnly,
          backupVideos:
            typeof parsed.backupVideos === 'boolean' ? parsed.backupVideos : defaults.backupVideos,
          lastBackupAt:
            typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : defaults.lastBackupAt,
          offlineCacheEnabled:
            typeof parsed.offlineCacheEnabled === 'boolean'
              ? parsed.offlineCacheEnabled
              : defaults.offlineCacheEnabled,
        };
      }
    } catch {
      // Ignore malformed storage or sandbox errors
    }
  }

  return defaults;
}

function persistSettings(state: PersistedMobileSettings): void {
  if (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.localStorage.setItem === 'function'
  ) {
    try {
      const payload: PersistedMobileSettings = {
        serverUrl: state.serverUrl,
        isPaired: state.isPaired,
        lastConnected: state.lastConnected,
        autoBackupEnabled: state.autoBackupEnabled,
        backupOnWifiOnly: state.backupOnWifiOnly,
        backupVideos: state.backupVideos,
        lastBackupAt: state.lastBackupAt,
        offlineCacheEnabled: state.offlineCacheEnabled,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors
    }
  }
}

const initialPersisted = loadPersistedSettings();

/**
 * useMobileStore - Hook managing mobile store.
 */
export const useMobileStore = create<MobileState>((set, get) => ({
  ...initialPersisted,
  pairingPin: '',

  backupQueue: [],
  isBackingUp: false,
  backupStatus: 'idle',
  backupProgress: 0,
  pendingCount: 0,

  cachedPhotoCount: 0,

  hydrateFromStorage: () => {
    const loaded = loadPersistedSettings();
    set({ ...loaded });
  },

  setServerUrl: (rawUrl) => {
    const serverUrl = rawUrl.trim().replace(/\/+$/, '');
    setApiBase(serverUrl);
    set((state) => {
      const next = { ...state, serverUrl };
      persistSettings(next);
      return { serverUrl };
    });
  },

  setPaired: (isPaired) =>
    set((state) => {
      const lastConnected = isPaired ? new Date().toISOString() : null;
      const next = { ...state, isPaired, lastConnected };
      persistSettings(next);
      return { isPaired, lastConnected };
    }),

  setAutoBackupEnabled: (autoBackupEnabled) =>
    set((state) => {
      const next = { ...state, autoBackupEnabled };
      persistSettings(next);
      return { autoBackupEnabled };
    }),

  setBackupOnWifiOnly: (backupOnWifiOnly) =>
    set((state) => {
      const next = { ...state, backupOnWifiOnly };
      persistSettings(next);
      return { backupOnWifiOnly };
    }),

  setBackupVideos: (backupVideos) =>
    set((state) => {
      const next = { ...state, backupVideos };
      persistSettings(next);
      return { backupVideos };
    }),

  setOfflineCacheEnabled: (offlineCacheEnabled) =>
    set((state) => {
      const next = { ...state, offlineCacheEnabled };
      persistSettings(next);
      return { offlineCacheEnabled };
    }),

  addToBackupQueue: (item) =>
    set((state) => ({
      backupQueue: [...state.backupQueue, item],
    })),

  updateBackupProgress: (id, progress, status) =>
    set((state) => ({
      backupQueue: state.backupQueue.map((item) =>
        item.id === id ? { ...item, progress, status } : item
      ),
    })),

  clearCompletedBackups: () =>
    set((state) => ({
      backupQueue: state.backupQueue.filter((item) => item.status !== 'completed'),
    })),

  backupFiles: async (files: File[] | FileList): Promise<{ uploaded: number; failed: number }> => {
    const { backupVideos } = get();
    const rawList = Array.from(files || []);
    const filtered = backupVideos
      ? rawList
      : rawList.filter((file) => !file.type.startsWith('video/'));

    if (filtered.length === 0) {
      const lastBackupAt = new Date().toISOString();
      set((state) => {
        const next = {
          ...state,
          backupStatus: 'completed' as BackupStatus,
          isBackingUp: false,
          backupProgress: 100,
          pendingCount: 0,
          lastBackupAt,
        };
        persistSettings(next);
        return {
          backupStatus: 'completed',
          isBackingUp: false,
          backupProgress: 100,
          pendingCount: 0,
          lastBackupAt,
        };
      });
      return { uploaded: 0, failed: 0 };
    }

    const queueItems: BackupItem[] = filtered.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      filename: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    }));

    set({
      backupStatus: 'backing_up',
      isBackingUp: true,
      backupProgress: 0,
      pendingCount: filtered.length,
      backupQueue: queueItems,
    });

    let uploaded = 0;
    let failed = 0;
    const total = filtered.length;

    for (let i = 0; i < total; i++) {
      const file = filtered[i];
      const itemId = queueItems[i].id;

      get().updateBackupProgress(itemId, 0, 'uploading');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${getApiBase()}/api/v1/photos/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          uploaded += 1;
          get().updateBackupProgress(itemId, 100, 'completed');
        } else {
          failed += 1;
          get().updateBackupProgress(itemId, 0, 'failed');
        }
      } catch {
        failed += 1;
        get().updateBackupProgress(itemId, 0, 'failed');
      }

      const completedCount = i + 1;
      const progress = Math.round((completedCount / total) * 100);
      const remaining = total - completedCount;

      set({
        backupProgress: progress,
        pendingCount: remaining,
      });
    }

    const finalStatus: BackupStatus = uploaded === 0 && failed > 0 ? 'error' : 'completed';
    const lastBackupAt = new Date().toISOString();

    set((state) => {
      const next = {
        ...state,
        backupStatus: finalStatus,
        isBackingUp: false,
        backupProgress: 100,
        pendingCount: 0,
        lastBackupAt,
      };
      persistSettings(next);
      return {
        backupStatus: finalStatus,
        isBackingUp: false,
        backupProgress: 100,
        pendingCount: 0,
        lastBackupAt,
      };
    });

    return { uploaded, failed };
  },
}));
