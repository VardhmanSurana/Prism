import { create } from 'zustand';

interface SyncStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

interface SyncState {
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
}

const DEFAULT_STATUS: SyncStatus = {
  is_scanning: false,
  total_files: 0,
  processed_files: 0,
  progress: 0,
};

/**
 * useSyncStore - Hook managing sync store.
 */
export const useSyncStore = create<SyncState>((set) => ({
  syncStatus: DEFAULT_STATUS,
  setSyncStatus: (status) => set({ syncStatus: status }),
}));
