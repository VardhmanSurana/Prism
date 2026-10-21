/**
 * textureConstants.ts
 * Shared constants for Light Leaks, Film Grain, and Blend Modes.
 */

export interface LeakPreset {
  id: string;
  name: string;
  background: string;
}

export const LEAKS: LeakPreset[] = [
  {
    id: 'warm-left',
    name: 'Warm Left',
    background: 'linear-gradient(to right, rgba(251, 146, 60, 0.6) 0%, rgba(251, 146, 60, 0) 100%)',
  },
  {
    id: 'cool-top',
    name: 'Cool Top',
    background: 'linear-gradient(to bottom, rgba(56, 189, 248, 0.6) 0%, rgba(56, 189, 248, 0) 100%)',
  },
  {
    id: 'rainbow-corner',
    name: 'Rainbow',
    background: 'radial-gradient(circle at top right, rgba(236, 72, 153, 0.6) 0%, rgba(59, 130, 246, 0.4) 40%, transparent 100%)',
  },
  {
    id: 'soft-glow',
    name: 'Soft Glow',
    background: 'radial-gradient(circle at center, rgba(253, 224, 71, 0.6) 0%, transparent 70%)',
  },
  {
    id: 'sunset-bleed',
    name: 'Sunset Bleed',
    background: 'radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.6) 0%, rgba(249, 115, 22, 0.4) 50%, transparent 100%)',
  },
  {
    id: 'vintage-haze',
    name: 'Vintage Haze',
    background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.6) 0%, rgba(16, 185, 129, 0.3) 50%, transparent 100%)',
  },
];

export const LEAK_COLORS = [
  { hex: '#fb923c', name: 'Amber' },
  { hex: '#38bdf8', name: 'Sky Blue' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#fde047', name: 'Yellow' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#d97706', name: 'Orange' },
  { hex: '#10b881', name: 'Emerald' },
];

export const LEAK_POSITIONS = [
  { value: 'left', label: 'Left Edge' },
  { value: 'right', label: 'Right Edge' },
  { value: 'top', label: 'Top Edge' },
  { value: 'bottom', label: 'Bottom Edge' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'center', label: 'Center Glow' },
  { value: 'top-left', label: 'Top Left' },
];

export const LEAK_PREVIEW_GRADIENTS: Record<string, string> = {
  'warm-left': 'linear-gradient(to right, rgba(251, 146, 60, 0.6) 0%, rgba(251, 146, 60, 0) 100%)',
  'cool-top': 'linear-gradient(to bottom, rgba(56, 189, 248, 0.6) 0%, rgba(56, 189, 248, 0) 100%)',
  'rainbow-corner': 'radial-gradient(circle at top right, rgba(236, 72, 153, 0.6) 0%, rgba(59, 130, 246, 0.4) 40%, transparent 100%)',
  'soft-glow': 'radial-gradient(circle at center, rgba(253, 224, 71, 0.6) 0%, transparent 70%)',
  'sunset-bleed': 'radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.6) 0%, rgba(249, 115, 22, 0.4) 50%, transparent 100%)',
  'vintage-haze': 'linear-gradient(135deg, rgba(217, 119, 6, 0.6) 0%, rgba(16, 185, 129, 0.3) 50%, transparent 100%)',
};

export const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'difference', label: 'Difference' },
];
