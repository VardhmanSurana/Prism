import { create } from 'zustand';

export interface BackupItem {
  id: string;
  filename: string;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
}

export interface MobileState {
  // Server Pairing State
  isPaired: boolean;
  serverUrl: string;
  pairingPin: string;
  lastConnected: string | null;

  // Auto-backup Queue
  autoBackupEnabled: boolean;
  backupQueue: BackupItem[];
  isBackingUp: boolean;

  // Offline Cache
  offlineCacheEnabled: boolean;
  cachedPhotoCount: number;

  // Actions
  setServerUrl: (url: string) => void;
  setPaired: (isPaired: boolean) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  setOfflineCacheEnabled: (enabled: boolean) => void;
  addToBackupQueue: (item: BackupItem) => void;
  updateBackupProgress: (id: string, progress: number, status: BackupItem['status']) => void;
  clearCompletedBackups: () => void;
}

const STORAGE_KEY = 'prism_mobile_store';

/**
 * useMobileStore - Hook managing mobile store.
 */
export const useMobileStore = create<MobileState>((set) => ({
  isPaired: false,
  serverUrl: localStorage.getItem('prism_server_url') || 'http://127.0.0.1:8269',
  pairingPin: '',
  lastConnected: null,

  autoBackupEnabled: false,
  backupQueue: [],
  isBackingUp: false,

  offlineCacheEnabled: true,
  cachedPhotoCount: 0,

  setServerUrl: (serverUrl) => {
    localStorage.setItem('prism_server_url', serverUrl);
    set({ serverUrl });
  },

  setPaired: (isPaired) => set({ isPaired, lastConnected: isPaired ? new Date().toISOString() : null }),

  setAutoBackupEnabled: (autoBackupEnabled) => set({ autoBackupEnabled }),

  setOfflineCacheEnabled: (offlineCacheEnabled) => set({ offlineCacheEnabled }),

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
}));
