import { create } from 'zustand';
import { API_BASE } from '@/constants';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  icon?: string;
  homepage?: string;
  capabilities: string[];
  entrypoint?: string;
  min_app_version?: string;
}

export interface PluginConfig {
  enabled: boolean;
  installed_at: string;
  updated_at: string;
  settings: Record<string, any>;
}

export interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  config: PluginConfig;
  path: string;
  is_active: boolean;
  has_models: boolean;
}

export interface PluginFeatureDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled?: boolean;
}

export const PLUGIN_FEATURES_REGISTRY: Record<string, PluginFeatureDefinition[]> = {
  'ai-vision-studio': [
    {
      key: 'background',
      name: 'Subject Cutout & Neural Matting',
      description: 'ISNet (Universal High-Res) and U²-Net-p fast on-device subject isolation and background replacement.',
      icon: 'Scissors',
      defaultEnabled: true,
    },
    {
      key: 'inpaint',
      name: 'Magic Eraser & Object Removal',
      description: 'LaMa fast Fourier eraser to eliminate unwanted objects, people, wires, and distractions.',
      icon: 'Wand2',
      defaultEnabled: true,
    },
    {
      key: 'super-resolution',
      name: 'Neural Super-Resolution & Face Restore',
      description: 'Real-ESRGAN 4x neural upscaling and CodeFormer face reconstruction.',
      icon: 'Maximize',
      defaultEnabled: true,
    },
    {
      key: 'depth-bokeh',
      name: 'Optical Depth & Bokeh Simulation',
      description: 'Depth-Anything monocular depth map calculation with realistic aperture blur.',
      icon: 'Aperture',
      defaultEnabled: true,
    },
  ],
  'creative-color-studio': [
    {
      key: 'lut',
      name: '3D LUT Color Grading',
      description: 'Cinema film profile lookup tables (Kodak 2383, Fuji Eterna, Teal & Orange) and .cube loader.',
      icon: 'Clapperboard',
      defaultEnabled: true,
    },
    {
      key: 'texture',
      name: 'Analog Film Grain & Light Leaks',
      description: 'Photochemical 35mm/120mm grain synthesis, film halation glow, and vintage light leaks.',
      icon: 'Film',
      defaultEnabled: true,
    },
    {
      key: 'frame',
      name: 'Vintage Frames & Polaroid Borders',
      description: 'Instant film borders, museum matte frames, and camera atmosphere overlays.',
      icon: 'Frame',
      defaultEnabled: true,
    },
  ],
  'retouch-metadata-studio': [
    {
      key: 'portrait',
      name: 'Portrait & Skin Retouching',
      description: 'Frequency-separation non-destructive skin smoothing, iris sharpening, and teeth whitening.',
      icon: 'User',
      defaultEnabled: true,
    },
    {
      key: 'colormatch',
      name: 'Reinhard Shot Color Matcher',
      description: 'Perceptual color histogram matching to transfer mood and lighting from reference shots.',
      icon: 'Palette',
      defaultEnabled: true,
    },
    {
      key: 'annotations',
      name: 'Vector Markup & Technical Annotations',
      description: 'Vector shapes, arrows, dimension lines, custom stamps, and high-DPI text callouts.',
      icon: 'PenTool',
      defaultEnabled: true,
    },
    {
      key: 'metadata-c2pa',
      name: 'EXIF Geocoding & C2PA Provenance',
      description: 'Offline reverse geotagging and cryptographic Content Authenticity provenance credentials.',
      icon: 'ShieldCheck',
      defaultEnabled: true,
    },
  ],
};

interface PluginStoreState {
  installedPlugins: InstalledPlugin[];
  activePluginIds: Set<string>;
  isLoading: boolean;
  lastFetched: number | null;
  fetchPlugins: () => Promise<void>;
  isPluginActive: (pluginId: string) => boolean;
  isFeatureActive: (pluginId: string, featureKey: string) => boolean;
  toggleFeature: (pluginId: string, featureKey: string) => Promise<boolean>;
  setFeatureEnabled: (pluginId: string, featureKey: string, enabled: boolean) => Promise<boolean>;
  resetFeatures: (pluginId: string) => Promise<boolean>;
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  installedPlugins: [],
  activePluginIds: new Set<string>(),
  isLoading: false,
  lastFetched: null,

  fetchPlugins: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins`);
      if (res.ok) {
        const data = await res.json();
        const plugins: InstalledPlugin[] = data.plugins || [];
        const activeIds = new Set<string>(
          plugins.filter((p) => p.is_active).map((p) => p.id)
        );
        set({
          installedPlugins: plugins,
          activePluginIds: activeIds,
          isLoading: false,
          lastFetched: Date.now(),
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('[PluginStore] Failed to fetch plugins:', err);
      set({ isLoading: false });
    }
  },

  isPluginActive: (pluginId: string) => {
    return get().activePluginIds.has(pluginId);
  },

  isFeatureActive: (pluginId: string, featureKey: string) => {
    const plugin = get().installedPlugins.find((p) => p.id === pluginId);
    if (!plugin || !plugin.is_active) return false;
    const features = plugin.config?.settings?.features;
    if (!features || typeof features !== 'object') return true; // Default enabled
    return features[featureKey] !== false;
  },

  toggleFeature: async (pluginId: string, featureKey: string) => {
    const state = get();
    const plugin = state.installedPlugins.find((p) => p.id === pluginId);
    if (!plugin) return false;

    const currentFeatures = plugin.config?.settings?.features || {};
    const currentlyEnabled = currentFeatures[featureKey] !== false;
    const updatedFeatures = {
      ...currentFeatures,
      [featureKey]: !currentlyEnabled,
    };

    const newSettings = {
      ...(plugin.config?.settings || {}),
      features: updatedFeatures,
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/config/${pluginId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.ok) {
        await state.fetchPlugins();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PluginStore] Failed to update feature:', err);
      return false;
    }
  },

  setFeatureEnabled: async (pluginId: string, featureKey: string, enabled: boolean) => {
    const state = get();
    const plugin = state.installedPlugins.find((p) => p.id === pluginId);
    if (!plugin) return false;

    const currentFeatures = plugin.config?.settings?.features || {};
    const updatedFeatures = {
      ...currentFeatures,
      [featureKey]: enabled,
    };

    const newSettings = {
      ...(plugin.config?.settings || {}),
      features: updatedFeatures,
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/config/${pluginId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.ok) {
        await state.fetchPlugins();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PluginStore] Failed to update feature:', err);
      return false;
    }
  },

  resetFeatures: async (pluginId: string) => {
    const state = get();
    const plugin = state.installedPlugins.find((p) => p.id === pluginId);
    if (!plugin) return false;

    const newSettings = {
      ...(plugin.config?.settings || {}),
      features: {},
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/config/${pluginId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.ok) {
        await state.fetchPlugins();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PluginStore] Failed to reset features:', err);
      return false;
    }
  },
}));
