/**
 * Typed Settings Registry for Prism
 *
 * Implements a 4-layer resolution system:
 * Built-in Defaults (0) -> User Preferences (1) -> Workspace Preferences (2) -> Project Overrides (3)
 *
 * Every setting defines:
 * - Clear default value
 * - Human-readable label and description
 * - Type, scope, and validation
 * - Customization flag and controlling layer indicator
 * - Reset to default action
 */

export type SettingScope = 'app' | 'user' | 'workspace' | 'project';
export type SettingType = 'string' | 'number' | 'boolean' | 'select' | 'path';

export interface SettingDefinition<T = any> {
  id: string;
  category: 'General' | 'Appearance' | 'Library' | 'Photo' | 'Video' | 'AI & Compute' | 'Updates & Security';
  label: string;
  description: string;
  type: SettingType;
  scope: SettingScope;
  defaultValue: T;
  options?: { label: string; value: T }[];
  min?: number;
  max?: number;
  step?: number;
  isSecret?: boolean;
  requiresRestart?: boolean;
  validate?: (val: T) => boolean | string;
}

export type EffectiveLayer = 'default' | 'user' | 'workspace' | 'project';

export interface ResolvedSetting<T = any> {
  definition: SettingDefinition<T>;
  value: T;
  effectiveLayer: EffectiveLayer;
  isCustomized: boolean;
  userValue?: T;
  workspaceValue?: T;
  projectValue?: T;
}

export interface ResolutionContext {
  workspaceId?: string;
  projectId?: string;
  workspaceOverrides?: Record<string, any>;
  projectOverrides?: Record<string, any>;
}

export const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  // ── General ─────────────────────────────────────────────────────────────
  {
    id: 'general.language',
    category: 'General',
    label: 'App Language',
    description: 'Language used across menus, tooltips, and system notifications.',
    type: 'select',
    scope: 'user',
    defaultValue: 'en',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Spanish (Español)', value: 'es' },
      { label: 'French (Français)', value: 'fr' },
      { label: 'German (Deutsch)', value: 'de' },
      { label: 'Japanese (日本語)', value: 'ja' },
    ],
  },
  {
    id: 'general.confirmDestructive',
    category: 'General',
    label: 'Confirm Destructive Actions',
    description: 'Show confirmation prompt before deleting media, purging folders, or resetting libraries.',
    type: 'boolean',
    scope: 'user',
    defaultValue: true,
  },

  // ── Appearance ──────────────────────────────────────────────────────────
  {
    id: 'appearance.theme',
    category: 'Appearance',
    label: 'Color Theme',
    description: 'Visual color palette for panels, sidebars, and overlays.',
    type: 'select',
    scope: 'user',
    defaultValue: 'dark',
    options: [
      { label: 'Deep Dark (Default)', value: 'dark' },
      { label: 'OLED Black', value: 'oled' },
      { label: 'Slate Gray', value: 'slate' },
      { label: 'High Contrast', value: 'contrast' },
    ],
  },
  {
    id: 'appearance.uiDensity',
    category: 'Appearance',
    label: 'Interface Density',
    description: 'Spacing and padding for buttons, sidebar lists, and toolbar items.',
    type: 'select',
    scope: 'workspace',
    defaultValue: 'comfortable',
    options: [
      { label: 'Compact (Maximum information)', value: 'compact' },
      { label: 'Comfortable (Balanced)', value: 'comfortable' },
      { label: 'Spacious (Touch / large display)', value: 'spacious' },
    ],
  },

  // ── Library ─────────────────────────────────────────────────────────────
  {
    id: 'library.previewQuality',
    category: 'Library',
    label: 'Thumbnail Preview Quality',
    description: 'Image resolution and JPEG compression quality for grid thumbnails.',
    type: 'select',
    scope: 'workspace',
    defaultValue: 'auto',
    options: [
      { label: 'Auto (Adapts to screen resolution)', value: 'auto' },
      { label: 'High (Sharper display, higher cache usage)', value: 'high' },
      { label: 'Low (Fastest loading on low-power devices)', value: 'low' },
    ],
  },
  {
    id: 'library.defaultSort',
    category: 'Library',
    label: 'Default Media Sort Order',
    description: 'Initial order when browsing photos and albums.',
    type: 'select',
    scope: 'workspace',
    defaultValue: 'newest',
    options: [
      { label: 'Capture Date (Newest First)', value: 'newest' },
      { label: 'Capture Date (Oldest First)', value: 'oldest' },
      { label: 'Date Added to Library', value: 'added' },
    ],
  },
  {
    id: 'library.groupBursts',
    category: 'Library',
    label: 'Group Burst Sequences',
    description: 'Automatically group continuous burst shots into a single expandable stack.',
    type: 'boolean',
    scope: 'workspace',
    defaultValue: true,
  },

  // ── Photo / Editing ─────────────────────────────────────────────────────
  {
    id: 'photo.autoAdvanceOnFlag',
    category: 'Photo',
    label: 'Auto-Advance on Pick / Reject',
    description: 'Instantly move to next photo after pressing Pick (P), Reject (X), or Rate (1-5).',
    type: 'boolean',
    scope: 'workspace',
    defaultValue: true,
  },
  {
    id: 'photo.preserveRawOriginals',
    category: 'Photo',
    label: 'Preserve Original Media Files',
    description: 'All edits and adjustments are non-destructive sidecars. Originals are never overwritten.',
    type: 'boolean',
    scope: 'app',
    defaultValue: true,
  },

  // ── Video ───────────────────────────────────────────────────────────────
  {
    id: 'video.proxyResolution',
    category: 'Video',
    label: 'Editing Proxy Resolution',
    description: 'Resolution of background-generated proxy videos used for smooth timeline scrubbing.',
    type: 'select',
    scope: 'project',
    defaultValue: '720p',
    options: [
      { label: '720p (Fastest editing, low storage)', value: '720p' },
      { label: '1080p (Balanced crispness and performance)', value: '1080p' },
      { label: 'Original Media (No proxies)', value: 'original' },
    ],
  },
  {
    id: 'video.timelineSnap',
    category: 'Video',
    label: 'Timeline Playhead Snapping',
    description: 'Snap playhead and clip boundaries to playhead markers and adjacent cuts.',
    type: 'boolean',
    scope: 'workspace',
    defaultValue: true,
  },
  {
    id: 'video.defaultFps',
    category: 'Video',
    label: 'Default Project Frame Rate',
    description: 'Base frame rate when creating a new video timeline project.',
    type: 'select',
    scope: 'project',
    defaultValue: 30,
    options: [
      { label: '24 fps (Cinematic)', value: 24 },
      { label: '30 fps (Standard Web/Social)', value: 30 },
      { label: '60 fps (Smooth High Motion)', value: 60 },
    ],
  },

  // ── AI & Compute ────────────────────────────────────────────────────────
  {
    id: 'ai.gpuMode',
    category: 'AI & Compute',
    label: 'Hardware Acceleration',
    description: 'Target accelerator for on-device neural embeddings, OCR, and segmentation.',
    type: 'select',
    scope: 'app',
    defaultValue: 'auto',
    options: [
      { label: 'Auto-detect Best Hardware', value: 'auto' },
      { label: 'NVIDIA CUDA (Dedicated GPU)', value: 'cuda' },
      { label: 'CPU Only (Low power mode)', value: 'cpu' },
      { label: 'Vulkan (Cross-platform)', value: 'vulkan' },
      { label: 'AMD ROCm (Radeon GPU)', value: 'rocm' },
      { label: 'Intel SYCL (Arc / Iris Xe)', value: 'sycl' },
    ],
    requiresRestart: true,
  },
  {
    id: 'ai.enableSemanticSearch',
    category: 'AI & Compute',
    label: 'On-Device Semantic Search (SigLIP2)',
    description: 'Generate vector embeddings locally for natural language search queries.',
    type: 'boolean',
    scope: 'app',
    defaultValue: true,
  },
  {
    id: 'ai.enableOcr',
    category: 'AI & Compute',
    label: 'Optical Character Recognition (OCR)',
    description: 'Automatically index text inside screenshots, signs, and documents.',
    type: 'boolean',
    scope: 'app',
    defaultValue: true,
  },

  // ── Updates & Security ──────────────────────────────────────────────────
  {
    id: 'security.vaultActive',
    category: 'Updates & Security',
    label: 'AES-256-GCM Hardware Vault',
    description: 'Automated cryptographic encryption for credentials and locked vaults.',
    type: 'boolean',
    scope: 'app',
    defaultValue: true,
  },
  {
    id: 'updater.autoCheck',
    category: 'Updates & Security',
    label: 'Automatic Update Checks',
    description: 'Check GitHub releases in the background for new desktop and mobile releases.',
    type: 'boolean',
    scope: 'app',
    defaultValue: true,
  },
  {
    id: 'updater.intervalMinutes',
    category: 'Updates & Security',
    label: 'Update Check Interval (Minutes)',
    description: 'How often the app queries the update manifest.',
    type: 'number',
    scope: 'app',
    defaultValue: 720,
    min: 30,
    max: 10080,
    step: 30,
  },
];

const STORAGE_KEY_USER = 'prism_settings_user';

class SettingsRegistry {
  private userValues: Record<string, any> = {};
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadUserValues();
  }

  private loadUserValues() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (raw) {
        this.userValues = JSON.parse(raw);
      }
    } catch {
      this.userValues = {};
    }
  }

  private saveUserValues() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.userValues));
    } catch (e) {
      console.warn('[settingsRegistry] save failed:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getDefinitions(): SettingDefinition[] {
    return SETTINGS_DEFINITIONS;
  }

  public getDefinition(id: string): SettingDefinition | undefined {
    return SETTINGS_DEFINITIONS.find((d) => d.id === id);
  }

  /**
   * Resolves a setting across all 4 layers:
   * Project override > Workspace preference > User preference > Built-in default
   */
  public resolve<T = any>(id: string, context?: ResolutionContext): ResolvedSetting<T> | null {
    const def = this.getDefinition(id);
    if (!def) return null;

    const userVal = this.userValues[id];
    const workspaceVal = context?.workspaceOverrides?.[id];
    const projectVal = context?.projectOverrides?.[id];

    let value = def.defaultValue;
    let effectiveLayer: EffectiveLayer = 'default';

    if (userVal !== undefined) {
      value = userVal;
      effectiveLayer = 'user';
    }
    if (workspaceVal !== undefined) {
      value = workspaceVal;
      effectiveLayer = 'workspace';
    }
    if (projectVal !== undefined) {
      value = projectVal;
      effectiveLayer = 'project';
    }

    const isCustomized = JSON.stringify(value) !== JSON.stringify(def.defaultValue);

    return {
      definition: def,
      value,
      effectiveLayer,
      isCustomized,
      userValue: userVal,
      workspaceValue: workspaceVal,
      projectValue: projectVal,
    };
  }

  public resolveAll(context?: ResolutionContext): ResolvedSetting[] {
    return SETTINGS_DEFINITIONS.map((def) => this.resolve(def.id, context)!).filter(Boolean);
  }

  public setUserValue(id: string, value: any) {
    const def = this.getDefinition(id);
    if (!def) return;
    this.userValues[id] = value;
    this.saveUserValues();
  }

  public resetUserValue(id: string) {
    delete this.userValues[id];
    this.saveUserValues();
  }

  public resetSection(category: SettingDefinition['category']) {
    SETTINGS_DEFINITIONS.filter((d) => d.category === category).forEach((d) => {
      delete this.userValues[d.id];
    });
    this.saveUserValues();
  }

  public resetAll() {
    this.userValues = {};
    this.saveUserValues();
  }

  public getChangedFromDefaults(context?: ResolutionContext): ResolvedSetting[] {
    return this.resolveAll(context).filter((r) => r.isCustomized);
  }

  /**
   * Exports sanitized JSON (never includes sensitive keys, passwords, or tokens)
   */
  public exportSanitized(context?: ResolutionContext): string {
    const payload = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      userPreferences: { ...this.userValues },
      activeWorkspaceOverrides: context?.workspaceOverrides || {},
      activeProjectOverrides: context?.projectOverrides || {},
    };

    // Strip any secret keys
    SETTINGS_DEFINITIONS.filter((d) => d.isSecret).forEach((d) => {
      delete (payload.userPreferences as any)[d.id];
    });

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Imports and validates settings JSON
   */
  public importValidated(jsonStr: string): { success: boolean; importedCount: number; errors: string[] } {
    const errors: string[] = [];
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') {
        return { success: false, importedCount: 0, errors: ['Invalid JSON object'] };
      }

      const imported = data.userPreferences || data;
      let count = 0;

      Object.entries(imported).forEach(([k, v]) => {
        const def = this.getDefinition(k);
        if (!def) {
          errors.push(`Unknown setting key '${k}' skipped.`);
          return;
        }
        if (def.isSecret) return;
        this.userValues[k] = v;
        count++;
      });

      this.saveUserValues();
      return { success: true, importedCount: count, errors };
    } catch (e) {
      return { success: false, importedCount: 0, errors: [String(e)] };
    }
  }
}

export const settingsRegistry = new SettingsRegistry();
