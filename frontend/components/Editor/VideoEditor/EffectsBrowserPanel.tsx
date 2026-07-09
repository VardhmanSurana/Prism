/**
 * EffectsBrowserPanel — Left panel for browsing and applying visual effects presets.
 */
import React, { useState, useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { ClipEffects } from '@/types/nle';

interface EffectPreset {
  name: string;
  category: string;
  icon: string;
  effects: Partial<ClipEffects>;
  description: string;
}

const EFFECT_PRESETS: EffectPreset[] = [
  // Color
  { name: 'Noir', category: 'Color', icon: '🎬', effects: { saturation: -100, contrast: 35, brightness: -5 }, description: 'Classic black and white' },
  { name: 'Warm Glow', category: 'Color', icon: '🌅', effects: { temperature: 45, saturation: 20, brightness: 8 }, description: 'Warm golden tones' },
  { name: 'Cool Blue', category: 'Color', icon: '❄️', effects: { temperature: -40, saturation: -10, contrast: 10 }, description: 'Cool blue cast' },
  { name: 'Vintage Film', category: 'Color', icon: '📷', effects: { saturation: -25, contrast: 20, temperature: 25, vignette: 25 }, description: 'Aged film look' },
  { name: 'Vivid', category: 'Color', icon: '🌈', effects: { saturation: 45, contrast: 20, brightness: 5 }, description: 'Punchy colors' },
  { name: 'Muted', category: 'Color', icon: '🌫️', effects: { saturation: -35, contrast: -10, brightness: 10 }, description: 'Desaturated and soft' },

  // Light
  { name: 'Bright Day', category: 'Light', icon: '☀️', effects: { brightness: 25, contrast: 10, saturation: 10 }, description: 'Overexposed sunny look' },
  { name: 'Dark Mood', category: 'Light', icon: '🌑', effects: { brightness: -20, contrast: 20, shadows: -25 }, description: 'Dark and moody' },
  { name: 'High Key', category: 'Light', icon: '💡', effects: { brightness: 30, contrast: -15, saturation: -10 }, description: 'Bright and airy' },
  { name: 'Low Key', category: 'Light', icon: '🕯️', effects: { brightness: -25, contrast: 30, vignette: 35 }, description: 'Dramatic shadows' },

  // Texture
  { name: 'Soft Focus', category: 'Texture', icon: '🔮', effects: { sharpness: -30, contrast: -10, brightness: 5 }, description: 'Dreamy soft look' },
  { name: 'Crisp', category: 'Texture', icon: '💎', effects: { sharpness: 40, contrast: 15 }, description: 'Extra sharp details' },
  { name: 'Film Grain', category: 'Texture', icon: '🎞️', effects: { noiseReduction: -20, contrast: 10, saturation: -10 }, description: 'Grainy film texture' },
  { name: 'Smooth', category: 'Texture', icon: '🫧', effects: { noiseReduction: 50, sharpness: -20 }, description: 'Smooth skin tones' },

  // Creative
  { name: 'Cinematic', category: 'Creative', icon: '🎥', effects: { contrast: 30, saturation: -15, temperature: -8, shadows: -20 }, description: 'Hollywood color grade' },
  { name: 'Cyberpunk', category: 'Creative', icon: '🌆', effects: { contrast: 25, saturation: 35, temperature: -20, highlights: 20 }, description: 'Neon-lit future' },
  { name: 'Sepia', category: 'Creative', icon: '📜', effects: { saturation: -80, temperature: 40, contrast: 10 }, description: 'Old photograph' },
  { name: 'Cross Process', category: 'Creative', icon: '🧪', effects: { saturation: 30, temperature: -15, contrast: 20, highlights: 15 }, description: 'Shifted color channels' },
  { name: 'Bleach Bypass', category: 'Creative', icon: '⚗️', effects: { contrast: 40, saturation: -30, brightness: -10 }, description: 'High contrast desaturated' },
  { name: 'Dream', category: 'Creative', icon: '✨', effects: { brightness: 15, contrast: -10, saturation: 15, vignette: 20 }, description: 'Soft dreamy glow' },
];

const CATEGORIES = ['All', 'Color', 'Light', 'Texture', 'Creative'];

export const EffectsBrowserPanel: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const selectedClip = useNLEStore((s) => s.getSelectedClip());
  const setClipEffects = useNLEStore((s) => s.setClipEffects);

  const filtered = EFFECT_PRESETS.filter((p) => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleApply = useCallback((preset: EffectPreset) => {
    if (!selectedClip) return;
    setClipEffects(selectedClip.id, preset.effects);
  }, [selectedClip, setClipEffects]);

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Effects</span>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[#2a2a2a]">
        <input
          type="text"
          placeholder="Search effects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1.5 border border-[#333] focus:border-[#3b82f6] outline-none"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b border-[#2a2a2a] overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#222] text-[#666] hover:text-[#999]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* No clip selected warning */}
      {!selectedClip && (
        <div className="p-3 text-center">
          <p className="text-[#666] text-[11px]">Select a clip on the timeline to apply effects.</p>
        </div>
      )}

      {/* Effects grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleApply(preset)}
              disabled={!selectedClip}
              className={`flex flex-col items-center gap-1 p-2 rounded border transition-colors ${
                selectedClip
                  ? 'bg-[#222] hover:bg-[#2a2a2a] border-[#333] hover:border-[#3b82f6]'
                  : 'bg-[#1e1e1e] border-[#2a2a2a] opacity-50 cursor-not-allowed'
              }`}
              title={preset.description}
            >
              <span className="text-lg">{preset.icon}</span>
              <span className="text-[#ccc] text-[10px] font-medium">{preset.name}</span>
              <span className="text-[#666] text-[8px] leading-tight text-center">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EffectsBrowserPanel;
