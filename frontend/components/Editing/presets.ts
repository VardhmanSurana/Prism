/**
 * presets.ts
 * Curated film look presets + localStorage user preset management.
 *
 * Each curated preset is a Partial<Adjustments> — only the sliders
 * that deviate from default are specified. The rest remain at 0.
 */

import { Adjustments, DEFAULT_ADJUSTMENTS } from './filterEngine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Preset {
  id: string;
  name: string;
  description: string;
  accent: string; // CSS color for the swatch card
  adjustments: Partial<Adjustments>;
}

export interface UserPreset {
  id: string;
  name: string;
  createdAt: number;
  adjustments: Adjustments;
}

const STORAGE_KEY = 'prism_user_presets';

// ── Curated Presets ──────────────────────────────────────────────────────────

export const CURATED_PRESETS: Preset[] = [
  {
    id: 'studio-clean',
    name: 'Studio Clean',
    description: 'Neutral, crisp and balanced',
    accent: 'linear-gradient(135deg, #e8e8e8 0%, #c0c0c0 100%)',
    adjustments: {
      contrast: 8, brightness: 3, sharpness: 20, clarity: 10,
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm sunset glow',
    accent: 'linear-gradient(135deg, #f6a935 0%, #e05c1a 100%)',
    adjustments: {
      temperature: 40, exposure: 10, highlights: -15, shadows: 20,
      saturation: 15, vibrance: 20, contrast: 10,
    },
  },
  {
    id: 'cinematic-teal',
    name: 'Cinematic Teal',
    description: 'Hollywood teal & orange grade',
    accent: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    adjustments: {
      temperature: -20, contrast: 25, shadows: -10, blacks: 15,
      saturation: -10, vibrance: 25, clarity: 15,
    },
  },
  {
    id: 'soft-matte',
    name: 'Soft Matte',
    description: 'Lifted blacks, faded look',
    accent: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
    adjustments: {
      blacks: -30, whites: -10, contrast: -15, brightness: 8,
      saturation: -15, clarity: -10,
    },
  },
  {
    id: 'kodachrome',
    name: 'Kodachrome',
    description: 'Rich saturated slide film',
    accent: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    adjustments: {
      contrast: 20, saturation: 35, vibrance: 15, shadows: 10,
      blacks: 10, temperature: 15, clarity: 8,
    },
  },
  {
    id: 'fuji-chrome',
    name: 'Fuji Chrome',
    description: 'Cool, vivid transparency film',
    accent: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    adjustments: {
      temperature: -10, contrast: 18, saturation: 25, highlights: -8,
      shadows: 15, clarity: 12, sharpness: 15,
    },
  },
  {
    id: 'velvia-pop',
    name: 'Velvia Pop',
    description: 'Hyper-saturated landscape film',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    adjustments: {
      saturation: 50, vibrance: 30, contrast: 22, clarity: 20,
      shadows: 12, blacks: 8, sharpness: 25,
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Deep black & white drama',
    accent: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    adjustments: {
      saturation: -100, contrast: 35, clarity: 25, sharpness: 20,
      blacks: 20, shadows: -15, highlights: -20,
    },
  },
  {
    id: 'bw-classic',
    name: 'B&W Classic',
    description: 'Timeless monochrome',
    accent: 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)',
    adjustments: {
      saturation: -100, contrast: 15, clarity: 10, sharpness: 15,
    },
  },
  {
    id: 'faded-film',
    name: 'Faded Film',
    description: 'Vintage washed-out analog',
    accent: 'linear-gradient(135deg, #d4a76a 0%, #b5835a 100%)',
    adjustments: {
      blacks: -20, whites: -15, contrast: -20, brightness: 10,
      saturation: -20, temperature: 20, clarity: -15,
    },
  },
  {
    id: 'faded-polaroid',
    name: 'Faded Polaroid',
    description: 'Lo-fi instant film nostalgia',
    accent: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
    adjustments: {
      brightness: 12, contrast: -10, saturation: -25, temperature: 25,
      blacks: -25, whites: -10, vignette: -30,
    },
  },
  {
    id: 'cool-breeze',
    name: 'Cool Breeze',
    description: 'Fresh airy blues',
    accent: 'linear-gradient(135deg, #7dd3fc 0%, #3b82f6 100%)',
    adjustments: {
      temperature: -35, contrast: 10, highlights: -10, shadows: 20,
      vibrance: 20, saturation: 10, brightness: 5,
    },
  },
  {
    id: 'warm-summer',
    name: 'Warm Summer',
    description: 'Sun-drenched afternoon haze',
    accent: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    adjustments: {
      temperature: 30, exposure: 8, shadows: 18, contrast: 12,
      saturation: 20, vibrance: 15, highlights: -10,
    },
  },
  {
    id: 'dramatic-dark',
    name: 'Dramatic Dark',
    description: 'Moody shadows, crushed blacks',
    accent: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    adjustments: {
      exposure: -15, contrast: 40, blacks: 30, highlights: -30,
      shadows: -20, clarity: 30, saturation: -10,
    },
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    description: 'Soft dreamy pastel tones',
    accent: 'linear-gradient(135deg, #f9a8d4 0%, #c084fc 100%)',
    adjustments: {
      brightness: 15, contrast: -15, saturation: -10, whites: -20,
      blacks: -25, clarity: -20, temperature: 8,
    },
  },
];

// ── Preset application ────────────────────────────────────────────────────────

/**
 * Merges a preset's partial adjustments into the current full Adjustments object.
 * Transform/crop/inpaint state (regions, curves, hsl) are preserved.
 */
export function applyPreset(
  current: Adjustments,
  preset: Partial<Adjustments>,
): Adjustments {
  return {
    ...DEFAULT_ADJUSTMENTS,
    // Preserve non-color state
    curves: current.curves,
    regions: current.regions,
    hsl: current.hsl,
    // Apply preset
    ...preset,
  };
}

// ── User preset storage ───────────────────────────────────────────────────────

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserPreset[];
  } catch {
    return [];
  }
}

export function saveUserPreset(name: string, adjustments: Adjustments): UserPreset {
  const preset: UserPreset = {
    id: `user-${Date.now()}`,
    name: name.trim() || 'My Preset',
    createdAt: Date.now(),
    adjustments,
  };
  const existing = loadUserPresets();
  const updated = [preset, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return preset;
}

export function deleteUserPreset(id: string): void {
  const existing = loadUserPresets();
  const updated = existing.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
