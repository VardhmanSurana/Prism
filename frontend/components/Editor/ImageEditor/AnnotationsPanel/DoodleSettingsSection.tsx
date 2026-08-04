/**
 * DoodleSettingsSection.tsx
 * Renders settings for the Text Doodle (textPath) tool, including custom text strings, font size, font family, and guide line toggle.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

interface DoodleSettingsSectionProps {
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;
}

export const DoodleSettingsSection: React.FC<DoodleSettingsSectionProps> = ({
  doodleText,
  setDoodleText,
  doodleFontSize,
  setDoodleFontSize,
  doodleFontFamily,
  setDoodleFontFamily,
  showDoodleGuide,
  setShowDoodleGuide,
}) => {
  return (
    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 shadow-md">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
        <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
          TEXT DOODLE SETTINGS
        </span>
      </div>

      {/* Doodle Wordings Input */}
      <div className="space-y-1">
        <label htmlFor="doodle-text-input" className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">
          Doodle Text
        </label>
        <input
          id="doodle-text-input"
          type="text"
          value={doodleText || ''}
          onChange={(e) => setDoodleText?.(e.target.value)}
          placeholder="e.g. peace in the air"
          className="w-full bg-white/[0.02] border border-white/10 focus:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/20 tracking-wide transition-colors"
        />
        <p className="text-[8px] text-zinc-500 italic mt-0.5 leading-normal">
          💡 Drag on image to start doodling text!
        </p>
      </div>

      {/* Font Size slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="doodle-font-size-slider" className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
            Font Size
          </label>
          <span className="font-mono text-[10px] text-primary">{doodleFontSize}px</span>
        </div>
        <input
          id="doodle-font-size-slider"
          type="range"
          min="8"
          max="48"
          value={doodleFontSize || 18}
          onChange={(e) => setDoodleFontSize?.(Number(e.target.value))}
          className="w-full h-1 bg-white/5 rounded appearance-none cursor-pointer accent-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* Font Family select */}
      <div className="space-y-1">
        <label htmlFor="doodle-font-family-select" className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">
          Font Style
        </label>
        <select
          id="doodle-font-family-select"
          value={doodleFontFamily || 'Space Grotesk'}
          onChange={(e) => setDoodleFontFamily?.(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs tracking-wide text-white focus:outline-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <option value="Space Grotesk">Space Grotesk</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Pacifico">Pacifico</option>
          <option value="Caveat">Caveat</option>
          <option value="Satisfy">Satisfy</option>
          <option value="Bebas Neue">Bebas Neue</option>
          <option value="Helvetica">Arial / Sans</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
        </select>
      </div>

      {/* Show outline path guide */}
      <div className="flex items-center justify-between pt-1">
        <label className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider cursor-pointer select-none" htmlFor="showDoodleGuideCheck">
          Show Path Guide Line
        </label>
        <input
          id="showDoodleGuideCheck"
          type="checkbox"
          checked={showDoodleGuide !== false}
          onChange={(e) => setShowDoodleGuide?.(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>
    </div>
  );
};
