/**
 * LassoActionsSection.tsx
 * Cutout & Extraction action triggers: Remove Background, Remove Object, Magic Erase.
 */

import React from 'react';
import { Layers, Scissors, Trash2, Wand2 } from 'lucide-react';

interface LassoActionsSectionProps {
  hasValidSelection: boolean;
  onRemoveBackground: () => void;
  onRemoveObject: () => void;
  onConvertToInpaint: () => void;
}

export const LassoActionsSection: React.FC<LassoActionsSectionProps> = ({
  hasValidSelection,
  onRemoveBackground,
  onRemoveObject,
  onConvertToInpaint,
}) => {
  return (
    <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
        <Layers size={11} className="text-primary" />
        <span>Cutout & Extraction Actions</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Remove Background Button */}
        <button
          onClick={onRemoveBackground}
          disabled={!hasValidSelection}
          className="py-2.5 px-2 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-bold text-[10px] uppercase tracking-wider shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex flex-col items-center justify-center gap-1.5 text-center"
          title="Isolate selected subject and make background transparent"
        >
          <Scissors size={14} />
          <span>Remove Background</span>
        </button>

        {/* Remove Object Button */}
        <button
          onClick={onRemoveObject}
          disabled={!hasValidSelection}
          className="py-2.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-bold text-[10px] uppercase tracking-wider shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex flex-col items-center justify-center gap-1.5 text-center"
          title="Delete selected object from image and make it transparent"
        >
          <Trash2 size={14} />
          <span>Remove Object</span>
        </button>
      </div>

      {/* Convert to Magic Eraser */}
      <button
        onClick={onConvertToInpaint}
        disabled={!hasValidSelection}
        className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1.5"
        title="Send selection to Magic Eraser for generative AI removal"
      >
        <Wand2 size={12} className="text-amber-400" />
        <span>Magic Erase (Inpaint Object)</span>
      </button>
    </div>
  );
};

