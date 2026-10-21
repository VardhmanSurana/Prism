/**
 * Replaceable Internal Providers for Prism
 *
 * Defines stable extension interfaces for core subsystems with built-in fallbacks:
 * - Image embeddings (SigLIP2 on-device default)
 * - Export presets & encoders (Standard Web/Print default)
 * - Media import handlers (Native Filesystem default)
 * - Color theme tokens (Prism Modern Dark default)
 * - Metadata extractors (Native Kamadak EXIF default)
 */

export type ProviderCapability = 'embeddings' | 'export' | 'import' | 'theme' | 'metadata';

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  capability: ProviderCapability;
  isBuiltin: boolean;
  isAvailable: boolean;
  version: string;
}

export const BUILTIN_PROVIDERS: ProviderDefinition[] = [
  // Embeddings
  {
    id: 'embeddings.siglip2',
    name: 'SigLIP2 High-Precision (ONNX)',
    description: 'Default on-device vision-language embeddings for semantic multi-modal search.',
    capability: 'embeddings',
    isBuiltin: true,
    isAvailable: true,
    version: '2.0.0',
  },
  {
    id: 'embeddings.cpu',
    name: 'CPU Fallback Embeddings',
    description: 'Lightweight CPU quantized embedding generator for low-power environments.',
    capability: 'embeddings',
    isBuiltin: true,
    isAvailable: true,
    version: '1.0.0',
  },

  // Export
  {
    id: 'export.standard',
    name: 'Standard Image & Video Exporter',
    description: 'Bicubic JPEG/PNG/WebP resampling with optional EXIF metadata preservation.',
    capability: 'export',
    isBuiltin: true,
    isAvailable: true,
    version: '1.0.0',
  },

  // Import
  {
    id: 'import.filesystem',
    name: 'Native Filesystem Importer',
    description: 'Monitors watched folders, handles drag-and-drop, and processes camera mounts.',
    capability: 'import',
    isBuiltin: true,
    isAvailable: true,
    version: '1.0.0',
  },

  // Metadata
  {
    id: 'metadata.exif',
    name: 'Kamadak EXIF & XMP Engine',
    description: 'Fast non-destructive EXIF, IPTC, and Adobe Camera Raw XMP sidecar parser.',
    capability: 'metadata',
    isBuiltin: true,
    isAvailable: true,
    version: '0.5.0',
  },

  // Theme
  {
    id: 'theme.prismDark',
    name: 'Prism Modern Dark',
    description: 'Default high-dynamic range dark theme optimized for photography.',
    capability: 'theme',
    isBuiltin: true,
    isAvailable: true,
    version: '1.0.0',
  },
];

class ProviderRegistry {
  private providers: Map<string, ProviderDefinition> = new Map();
  private activeProviders: Map<ProviderCapability, string> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    BUILTIN_PROVIDERS.forEach((p) => this.providers.set(p.id, p));

    // Set initial defaults
    this.activeProviders.set('embeddings', 'embeddings.siglip2');
    this.activeProviders.set('export', 'export.standard');
    this.activeProviders.set('import', 'import.filesystem');
    this.activeProviders.set('metadata', 'metadata.exif');
    this.activeProviders.set('theme', 'theme.prismDark');
  }

  public register(provider: ProviderDefinition): () => void {
    this.providers.set(provider.id, provider);
    this.notify();
    return () => {
      this.providers.delete(provider.id);
      // Revert to built-in if active was deleted
      if (this.activeProviders.get(provider.capability) === provider.id) {
        const fallback = BUILTIN_PROVIDERS.find((p) => p.capability === provider.capability);
        if (fallback) this.activeProviders.set(provider.capability, fallback.id);
      }
      this.notify();
    };
  }

  public get(id: string): ProviderDefinition | undefined {
    return this.providers.get(id);
  }

  public getByCapability(capability: ProviderCapability): ProviderDefinition[] {
    return Array.from(this.providers.values()).filter((p) => p.capability === capability);
  }

  public getActive(capability: ProviderCapability): ProviderDefinition {
    const activeId = this.activeProviders.get(capability);
    if (activeId && this.providers.has(activeId)) {
      return this.providers.get(activeId)!;
    }
    // Fallback to built-in
    const fallback = BUILTIN_PROVIDERS.find((p) => p.capability === capability)!;
    return fallback;
  }

  public setActive(capability: ProviderCapability, providerId: string): boolean {
    const target = this.providers.get(providerId);
    if (!target || target.capability !== capability) return false;
    this.activeProviders.set(capability, providerId);
    this.notify();
    return true;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const providerRegistry = new ProviderRegistry();
