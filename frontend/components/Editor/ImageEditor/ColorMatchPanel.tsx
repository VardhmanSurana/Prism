import React, { useState } from 'react';
import { Pipette, Image as ImageIcon, Sparkles, Upload } from 'lucide-react';

interface ColorMatchPanelProps {
  onApplyColorMatch: (refImageSrc: string, strength: number) => void;
}

export const ColorMatchPanel: React.FC<ColorMatchPanelProps> = ({ onApplyColorMatch }) => {
  const [refImageSrc, setRefImageSrc] = useState<string | null>(null);
  const [strength, setStrength] = useState<number>(80);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setRefImageSrc(url);
    }
  };

  const handleMatch = () => {
    if (!refImageSrc) return;
    onApplyColorMatch(refImageSrc, strength);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white p-4 space-y-5">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Pipette size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Shot Matcher & Gallery</h3>
      </div>

      {/* Reference Image Picker */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-white/60 uppercase">Reference Photo / Cinema Still</label>
        <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 flex flex-col items-center justify-center gap-3">
          {refImageSrc ? (
            <div className="relative w-full h-32 rounded overflow-hidden border border-white/10">
              <img src={refImageSrc} alt="Reference" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-white/30 gap-1.5">
              <ImageIcon size={28} />
              <span className="text-[10px]">No reference image selected</span>
            </div>
          )}

          <label className="w-full py-1.5 flex items-center justify-center gap-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white/80 cursor-pointer transition-all">
            <Upload size={12} />
            {refImageSrc ? 'Change Reference Image' : 'Upload Reference Photo'}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* Match Strength Slider */}
      <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-semibold text-white/60 uppercase">Match Transfer Strength</span>
          <span className="font-mono text-primary font-bold">{strength}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={strength}
          onChange={e => setStrength(Number(e.target.value))}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Apply Match Button */}
      <button
        onClick={handleMatch}
        disabled={!refImageSrc}
        className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-[#050505] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-30 disabled:cursor-default"
      >
        <Sparkles size={13} />
        Match Color & Look
      </button>
    </div>
  );
};
