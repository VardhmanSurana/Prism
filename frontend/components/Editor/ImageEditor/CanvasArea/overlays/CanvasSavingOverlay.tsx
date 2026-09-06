/**
 * CanvasSavingOverlay.tsx
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export const CanvasSavingOverlay: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin mb-4" size={32} />
      <p className="text-sm font-medium tracking-wide uppercase">Applying Edits…</p>
    </div>
  ) : null;
