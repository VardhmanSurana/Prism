/**
 * ColorMatchPanel.tsx
 * Sidebar control panel for Shot Matcher (3D Color Histogram Matching).
 * Styled to match the unified Image Editor Studio design system.
 */

import React, { useState } from 'react';
import { Pipette, Sparkles, Upload, RotateCcw, ChevronDown, Loader2 } from 'lucide-react';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

interface ColorMatchPanelProps {
  onApplyColorMatch: (refImageSrc: string, strength: number) => Promise<void> | void;
  isProcessing?: boolean;
}

export const ColorMatchPanel: React.FC<ColorMatchPanelProps> = ({
  onApplyColorMatch,
  isProcessing = false,
}) => {
  const [refImageSrc, setRefImageSrc] = useState<string | null>(null);
  const [strength, setStrength] = useState<number>(80);
  const [openSections, setOpenSections] = useState({
    ref: true,
    strength: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) setRefImageSrc(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMatch = () => {
    if (!refImageSrc || isProcessing) return;
    onApplyColorMatch(refImageSrc, strength);
  };

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white p-4 space-y-4 select-none">
      {/* ── Sub-header ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Cinema & Look Matcher
        </span>

        {refImageSrc && (
          <button
            onClick={() => setRefImageSrc(null)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Clear Reference Photo"
          >
            <RotateCcw size={10} />
            Clear
          </button>
        )}
      </div>

      {/* ── 1. Reference Photo Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('ref')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Pipette size={11} className="text-primary" />
            <span>Reference Photo / Still</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.ref ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.ref && (
          <div className="space-y-2 pt-1">
            {refImageSrc ? (
              <div className="relative w-full h-36 rounded-lg overflow-hidden border border-white/10 group/img">
                <img src={refImageSrc} alt="Reference" className="w-full h-full object-cover" />
                <label
                  htmlFor="ref-image-input"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer text-white"
                >
                  <Upload size={13} /> Change Image
                </label>
              </div>
            ) : (
              <label
                htmlFor="ref-image-input"
                className="w-full h-28 border border-dashed border-white/15 hover:border-white/30 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]"
              >
                <Upload size={18} className="text-white/40" />
                <span className="text-[10px] font-medium text-white/50">Upload reference photo</span>
              </label>
            )}
            <input
              id="ref-image-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        )}
      </div>

      {/* ── 2. Match Strength Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('strength')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Sparkles size={11} className="text-primary" />
            <span>Match Dynamics</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.strength ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.strength && (
          <div className="pt-1">
            <EditorSlider
              label="Match Strength"
              value={strength}
              onChange={setStrength}
              min={10}
              max={100}
              defaultValue={80}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* ── 3. Apply Action Button ── */}
      <div className="space-y-2">
        <button
          onClick={handleMatch}
          disabled={!refImageSrc || isProcessing}
          className="w-full py-2.5 px-4 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Matching Palette...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Apply 3D Histogram Match</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
