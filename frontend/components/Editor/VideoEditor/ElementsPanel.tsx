/**
 * ElementsPanel — Left panel for adding shapes, stickers, and overlay elements.
 */
import React, { useState, useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { Clip, ClipTransform } from '@/types/nle';
import { DEFAULT_EFFECTS, DEFAULT_TRANSFORM } from '@/types/nle';

interface ElementPreset {
  name: string;
  category: string;
  icon: string;
  overlay: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
  };
  transform: Partial<ClipTransform>;
}

const ELEMENT_PRESETS: ElementPreset[] = [
  // Shapes (rendered as emoji/text overlays)
  { name: 'Circle', category: 'Shapes', icon: '⭕', overlay: { text: '●', fontSize: 120, fontFamily: 'Arial', fontColor: '#3b82f6' }, transform: {} },
  { name: 'Square', category: 'Shapes', icon: '⬛', overlay: { text: '■', fontSize: 120, fontFamily: 'Arial', fontColor: '#ef4444' }, transform: {} },
  { name: 'Triangle', category: 'Shapes', icon: '🔺', overlay: { text: '▲', fontSize: 120, fontFamily: 'Arial', fontColor: '#22c55e' }, transform: {} },
  { name: 'Star', category: 'Shapes', icon: '⭐', overlay: { text: '★', fontSize: 120, fontFamily: 'Arial', fontColor: '#eab308' }, transform: {} },
  { name: 'Heart', category: 'Shapes', icon: '❤️', overlay: { text: '♥', fontSize: 120, fontFamily: 'Arial', fontColor: '#ec4899' }, transform: {} },
  { name: 'Diamond', category: 'Shapes', icon: '💎', overlay: { text: '◆', fontSize: 120, fontFamily: 'Arial', fontColor: '#06b6d4' }, transform: {} },

  // Emoji stickers
  { name: 'Fire', category: 'Stickers', icon: '🔥', overlay: { text: '🔥', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },
  { name: 'Sparkle', category: 'Stickers', icon: '✨', overlay: { text: '✨', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },
  { name: 'Thumbs Up', category: 'Stickers', icon: '👍', overlay: { text: '👍', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },
  { name: 'Clap', category: 'Stickers', icon: '👏', overlay: { text: '👏', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },
  { name: 'Rocket', category: 'Stickers', icon: '🚀', overlay: { text: '🚀', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },
  { name: 'Lightning', category: 'Stickers', icon: '⚡', overlay: { text: '⚡', fontSize: 80, fontFamily: 'Arial', fontColor: '#ffffff' }, transform: {} },

  // Overlays
  { name: 'Vignette Frame', category: 'Overlays', icon: '🖼️', overlay: { text: '', fontSize: 1, fontFamily: 'Arial', fontColor: 'transparent' }, transform: { opacity: 0.8 } },
  { name: 'Letterbox Top', category: 'Overlays', icon: '▬', overlay: { text: '', fontSize: 1, fontFamily: 'Arial', fontColor: 'transparent' }, transform: {} },
  { name: 'Progress Bar', category: 'Overlays', icon: '▓', overlay: { text: '▓▓▓▓▓▓▓▓░░░░░░░░', fontSize: 20, fontFamily: 'Courier New', fontColor: '#3b82f6' }, transform: { y: 130 } },
];

const CATEGORIES = ['All', 'Shapes', 'Stickers', 'Overlays'];

let _elementCounter = 0;

/**
 * ElementsPanel - Renders elements panel.
 */
export const ElementsPanel: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const { tracks, projectFps, addClip } = useNLEStore();

  /**
   * filtered - Performs filtered.
   */
  const filtered = ELEMENT_PRESETS.filter((p) =>
    activeCategory === 'All' || p.category === activeCategory
  );

  /**
   * handleAdd - Handles add.
   */
  const handleAdd = useCallback((preset: ElementPreset) => {
    const track = tracks[0];
    if (!track) return;

    const playheadFrame = Math.round(useNLEStore.getState().playheadPosition * projectFps);
    const durationFrames = 3 * projectFps;

    const clip: Clip = {
      id: `element_${Date.now()}_${++_elementCounter}`,
      sourceId: 0,
      sourcePath: '',
      sourceDuration: 3,
      startFrame: playheadFrame,
      durationFrames,
      inPoint: 0,
      outPoint: 3,
      speed: 1.0,
      volume: 0,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      effects: { ...DEFAULT_EFFECTS },
      transform: { ...DEFAULT_TRANSFORM, ...preset.transform },
      keyframes: {},
      text: {
        text: preset.overlay.text,
        fontSize: preset.overlay.fontSize,
        fontFamily: preset.overlay.fontFamily,
        fontColor: preset.overlay.fontColor,
        x: 0,
        y: 0,
        start: 0,
        end: 3,
      },
    };

    addClip(track.id, clip);
  }, [tracks, projectFps, addClip]);

  return (
    <div className="w-64 bg-[#151312] border-r border-white/10 flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="h-10 flex items-center px-3 border-b border-white/10 bg-[#171615]">
        <span className="text-[#f5f0ed] text-xs font-medium">Elements</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 text-[10px] rounded-md transition-colors cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#e5a93c] text-[#151312] font-semibold shadow-sm'
                : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Elements grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {filtered.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleAdd(preset)}
              className="flex flex-col items-center gap-1.5 p-2.5 bg-[#1d1b1a] hover:bg-white/[0.04] rounded-lg border border-white/10 hover:border-[#e5a93c]/50 transition-colors cursor-pointer group"
              title={`Add ${preset.name}`}
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">{preset.icon}</span>
              <span className="text-zinc-400 group-hover:text-zinc-200 text-[9px] text-center leading-tight">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ElementsPanel;
