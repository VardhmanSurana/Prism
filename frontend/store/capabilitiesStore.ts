import { create } from 'zustand';
import { API_BASE } from '@/constants';

export interface CapabilityItem {
  name: string;
  category: 'core' | 'ai' | 'creative' | 'network' | string;
  state: 'ready' | 'model_not_installed' | 'disabled' | string;
  installed: boolean;
  enabled: boolean;
  resident_in_ram: boolean;
  model_id?: string | null;
  download_size_bytes: number;
  description: string;
}

export interface HardwareProfile {
  gpu_name: string;
  vram_mb: number;
  ram_mb: number;
  cpu_model: string;
  cpu_threads: number;
  backend: string;
  supports_heavyweight_generative: boolean;
}

export interface CapabilitiesResponse {
  capabilities: Record<string, CapabilityItem>;
  hardware: HardwareProfile;
  server_mode: string;
  ram_resident_models: string[];
}

interface CapabilitiesState {
  capabilities: Record<string, CapabilityItem>;
  hardware: HardwareProfile | null;
  serverMode: string;
  ramResidentModels: string[];
  isLoading: boolean;
  error: string | null;

  fetchCapabilities: () => Promise<void>;
  unloadCapability: (feature: string) => Promise<boolean>;
  unloadAllCapabilities: () => Promise<void>;
  toggleCapability: (feature: string, enabled: boolean) => Promise<void>;
  isFeatureReady: (feature: string) => boolean;
  isFeatureInstalled: (feature: string) => boolean;
  isFeatureEnabled: (feature: string) => boolean;
}

export const useCapabilitiesStore = create<CapabilitiesState>((set, get) => ({
  capabilities: {},
  hardware: null,
  serverMode: 'local_bundled',
  ramResidentModels: [],
  isLoading: false,
  error: null,

  fetchCapabilities: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v1/capabilities`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CapabilitiesResponse = await res.json();
      set({
        capabilities: data.capabilities || {},
        hardware: data.hardware || null,
        serverMode: data.server_mode || 'local_bundled',
        ramResidentModels: data.ram_resident_models || [],
        isLoading: false,
      });
    } catch (err: any) {
      console.error('Failed to load capabilities:', err);
      set({ error: err.message || 'Failed to load capabilities', isLoading: false });
    }
  },

  unloadCapability: async (feature: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/capabilities/${encodeURIComponent(feature)}/unload`, {
        method: 'POST',
      });
      if (res.ok) {
        await get().fetchCapabilities();
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to unload ${feature}:`, err);
      return false;
    }
  },

  unloadAllCapabilities: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/capabilities/unload-all`, { method: 'POST' });
      if (res.ok) {
        await get().fetchCapabilities();
      }
    } catch (err) {
      console.error('Failed to unload all capabilities:', err);
    }
  },

  toggleCapability: async (feature: string, enabled: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/capabilities/${encodeURIComponent(feature)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        await get().fetchCapabilities();
      }
    } catch (err) {
      console.error(`Failed to toggle ${feature}:`, err);
    }
  },

  isFeatureReady: (feature: string) => {
    const cap = get().capabilities[feature];
    return cap ? cap.state === 'ready' : false;
  },

  isFeatureInstalled: (feature: string) => {
    const cap = get().capabilities[feature];
    return cap ? cap.installed : false;
  },

  isFeatureEnabled: (feature: string) => {
    const cap = get().capabilities[feature];
    return cap ? cap.enabled : false;
  },
}));
