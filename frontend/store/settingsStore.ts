import { create } from 'zustand';
import { API_BASE } from '../constants';

interface SettingsState {
  isAgentEnabled: boolean;
  setAgentEnabled: (enabled: boolean) => void;
  fetchSettings: () => Promise<void>;

  telemetrySampleRate: number;
  fetchTelemetrySettings: () => Promise<void>;
  setTelemetrySampleRate: (rate: number) => Promise<void>;
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

  telemetrySampleRate: 10,
  fetchTelemetrySettings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/telemetry`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.sample_rate === 'number') {
          set({ telemetrySampleRate: data.sample_rate });
        }
      }
    } catch (e) {
      console.error('Failed to fetch telemetry settings:', e);
    }
  },
  setTelemetrySampleRate: async (rate: number) => {
    set({ telemetrySampleRate: rate });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_rate: rate }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ telemetrySampleRate: data.sample_rate ?? rate });
      }
    } catch (e) {
      console.error('Failed to save telemetry settings:', e);
    }
  },
}));
