import { create } from 'zustand';
import { API_BASE } from '../constants';

interface SettingsState {
  isAgentEnabled: boolean;
  setAgentEnabled: (enabled: boolean) => void;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isAgentEnabled: true,
  setAgentEnabled: (enabled) => set({ isAgentEnabled: enabled }),
  fetchSettings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/general`);
      if (res.ok) {
        const data = await res.json();
        set({ isAgentEnabled: !!data.ENABLE_AI_AGENT });
      }
    } catch (e) {
      console.error('Failed to fetch general settings:', e);
    }
  },
}));
