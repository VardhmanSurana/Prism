import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SafeModeState {
  isSafeMode: boolean;
  safeModeReason: string | null;
  enableSafeMode: (reason?: string) => void;
  disableSafeMode: () => void;
  toggleSafeMode: () => void;
}

export const useSafeModeStore = create<SafeModeState>()(
  persist(
    (set) => ({
      isSafeMode: false,
      safeModeReason: null,

      enableSafeMode: (reason = 'User enabled safe mode for recovery/experimentation.') =>
        set({ isSafeMode: true, safeModeReason: reason }),

      disableSafeMode: () =>
        set({ isSafeMode: false, safeModeReason: null }),

      toggleSafeMode: () =>
        set((s) => ({
          isSafeMode: !s.isSafeMode,
          safeModeReason: !s.isSafeMode ? 'Manually toggled safe mode.' : null,
        })),
    }),
    {
      name: 'prism_safe_mode',
    }
  )
);
