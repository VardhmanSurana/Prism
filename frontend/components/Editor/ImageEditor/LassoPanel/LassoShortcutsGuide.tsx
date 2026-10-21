/**
 * LassoShortcutsGuide.tsx
 * Keyboard shortcuts legend for Lasso selection.
 */

import React from 'react';

export const LassoShortcutsGuide: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[9px] text-white/50 border-t border-white/5">
      <div><span className="text-white/80 font-medium">Enter:</span> Close Selection</div>
      <div><span className="text-white/80 font-medium">Esc:</span> Cancel Path</div>
      <div><span className="text-white/80 font-medium">Backspace:</span> Pop Anchor</div>
      <div><span className="text-white/80 font-medium">Space:</span> Pan Image</div>
      <div><span className="text-white/80 font-medium">Ctrl+A:</span> Select All</div>
      <div><span className="text-white/80 font-medium">Ctrl+D:</span> Deselect</div>
      <div><span className="text-white/80 font-medium">Ctrl+Shift+I:</span> Invert</div>
      <div><span className="text-white/80 font-medium">R-Click:</span> Pop Point</div>
    </div>
  );
};

