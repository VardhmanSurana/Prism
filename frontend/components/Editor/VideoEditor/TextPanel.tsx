/**
 * TextPanel — Add and edit text overlays on the timeline.
 * Creates text clips on a text track.
 */
import React, { useState, useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { Clip, TextOverlay } from '@/types/nle';
import { DEFAULT_TRANSFORM } from '@/types/nle';
import { Dropdown } from '@/components/ui/Dropdown';
import { ColorPicker } from '@/components/ui/ColorPicker';

const FONT_OPTIONS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New',
  'Verdana', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino',
];

const TEXT_PRESETS: { label: string; text: string; fontSize: number; fontFamily: string }[] = [
  { label: 'Title', text: 'Title Text', fontSize: 72, fontFamily: 'Arial' },
  { label: 'Subtitle', text: 'Subtitle', fontSize: 36, fontFamily: 'Helvetica' },
  { label: 'Lower Third', text: 'Name • Title', fontSize: 28, fontFamily: 'Helvetica' },
  { label: 'Caption', text: 'Caption text here', fontSize: 24, fontFamily: 'Arial' },
  { label: 'Watermark', text: '© Your Name', fontSize: 18, fontFamily: 'Arial' },
];

/**
 * TextPanel - Renders text panel.
 */
export const TextPanel: React.FC = () => {
  const { tracks, projectFps, playheadPosition } = useNLEStore();
  /**
   * addClip - Performs add clip.
   */
  const addClip = useNLEStore((s) => s.addClip);
  /**
   * addTrack - Performs add track.
   */
  const addTrack = useNLEStore((s) => s.addTrack);

  const [customText, setCustomText] = useState('');
  const [fontSize, setFontSize] = useState(36);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontColor, setFontColor] = useState('#ffffff');

  // Find or create a text track
  /**
   * findTextTrack - Performs find text track.
   */
  const findTextTrack = useCallback((): string | null => {
    /**
     * textTrack - Performs text track.
     */
    const textTrack = tracks.find((t) => t.type === 'text');
    if (textTrack) return textTrack.id;
    // Create a text track
    addTrack('text');
    // After addTrack, the new track is the last one
    const state = useNLEStore.getState();
    const newTextTrack = state.tracks[state.tracks.length - 1];
    return newTextTrack?.id ?? null;
  }, [tracks, addTrack]);

  /**
   * addTextClip - Performs add text clip.
   */
  const addTextClip = useCallback((text: string, size: number, family: string, color: string) => {
    const trackId = findTextTrack();
    if (!trackId) return;

    const clip: Clip = {
      id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId: 0,
      sourcePath: '',
      sourceDuration: 5,
      startFrame: Math.round(playheadPosition * projectFps),
      durationFrames: 5 * projectFps,
      inPoint: 0,
      outPoint: 5,
      speed: 1.0,
      volume: 0,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      effects: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, highlights: 0, shadows: 0, sharpness: 0, vignette: 0, noiseReduction: 0 },
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: {},
      text: {
        text,
        fontSize: size,
        fontFamily: family,
        fontColor: color,
        x: 0,
        y: 0,
        start: 0,
        end: 5,
      },
    };

    addClip(trackId, clip);
  }, [findTextTrack, playheadPosition, projectFps, addClip]);

  /**
   * handleAddCustom - Handles add custom.
   */
  const handleAddCustom = useCallback(() => {
    if (!customText.trim()) return;
    addTextClip(customText.trim(), fontSize, fontFamily, fontColor);
    setCustomText('');
  }, [customText, fontSize, fontFamily, fontColor, addTextClip]);

  return (
    <div className="w-64 bg-[#151312] border-r border-white/10 flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="h-10 flex items-center px-3 border-b border-white/10 bg-[#171615]">
        <span className="text-[#f5f0ed] text-xs font-medium">Text</span>
      </div>

      {/* Custom text input */}
      <div className="p-3 border-b border-white/10 space-y-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Type your text..."
          className="w-full bg-[#1d1b1a] text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 border border-white/10 placeholder-zinc-500 focus:outline-none focus:border-[#e5a93c]/50"
          onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
        />
        <div className="grid grid-cols-2 gap-2">
          <Dropdown
            value={fontFamily}
            onChange={(val) => setFontFamily(val as string)}
            options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
            className="w-full"
          />
          <input
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value) || 24)}
            min="8"
            max="200"
            className="bg-[#1d1b1a] text-zinc-200 text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none focus:border-[#e5a93c]/50"
          />
        </div>
        <div className="space-y-2 pt-1">
          <ColorPicker
            value={fontColor}
            onChange={setFontColor}
            className="w-full"
          />
          <button
            onClick={handleAddCustom}
            className="w-full py-1.5 bg-[#e5a93c] hover:bg-[#d4982b] text-[#151312] text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Add Text
          </button>
        </div>
      </div>

      {/* Preset styles */}
      <div className="flex-1 overflow-y-auto p-3">
        <span className="text-zinc-400 text-[10px] font-medium block mb-2 uppercase tracking-wider">Presets</span>
        <div className="space-y-1.5">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => addTextClip(preset.text, preset.fontSize, preset.fontFamily, '#ffffff')}
              className="w-full text-left px-3 py-2 bg-[#1d1b1a] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-lg transition-colors cursor-pointer group"
            >
              <div className="text-zinc-200 text-[11px] font-medium group-hover:text-[#e5a93c] transition-colors">{preset.label}</div>
              <div className="text-zinc-400 text-[10px] mt-0.5 truncate">{preset.text}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextPanel;
