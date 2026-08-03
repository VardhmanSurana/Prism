import { create } from 'zustand';
import { API_BASE } from '../constants';

interface SettingsState {
  isAgentEnabled: boolean;
  setAgentEnabled: (enabled: boolean) => void;
  fetchSettings: () => Promise<void>;

  telemetryEnabled: boolean;
  telemetrySampleRate: number;
  telemetryResponseLogging: boolean;
  fetchTelemetrySettings: () => Promise<void>;
  setTelemetryEnabled: (enabled: boolean) => Promise<void>;
  setTelemetrySampleRate: (rate: number) => Promise<void>;
  setTelemetryResponseLogging: (enabled: boolean) => Promise<void>;
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

  telemetryEnabled: true,
  telemetrySampleRate: 10,
  telemetryResponseLogging: false,
  fetchTelemetrySettings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/telemetry`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.enabled === 'boolean') {
          set({ telemetryEnabled: data.enabled });
        }
        if (typeof data.sample_rate === 'number') {
          set({ telemetrySampleRate: data.sample_rate });
        }
        if (typeof data.response_logging === 'boolean') {
          set({ telemetryResponseLogging: data.response_logging });
        }
      }
    } catch (e) {
      console.error('Failed to fetch telemetry settings:', e);
    }
  },
  setTelemetryEnabled: async (enabled: boolean) => {
    set({ telemetryEnabled: enabled });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ telemetryEnabled: data.enabled ?? enabled });
      }
    } catch (e) {
      console.error('Failed to save telemetry enabled setting:', e);
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
  setTelemetryResponseLogging: async (enabled: boolean) => {
    set({ telemetryResponseLogging: enabled });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_logging: enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ telemetryResponseLogging: data.response_logging ?? enabled });
      }
    } catch (e) {
      console.error('Failed to save telemetry response logging setting:', e);
    }
  },
}));
