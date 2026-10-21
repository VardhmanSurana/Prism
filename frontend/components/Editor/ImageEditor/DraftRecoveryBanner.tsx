/**
 * DraftRecoveryBanner.tsx
 * Sleek, non-intrusive notification banner informing the user that an unsaved edit draft
 * was automatically restored, with direct actions to keep or discard the draft.
 */

import React from 'react';
import { Sparkles, Trash2, Check, X } from 'lucide-react';

interface DraftRecoveryBannerProps {
  timestamp: number | null;
  onDiscard: () => void;
  onKeep: () => void;
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'earlier';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  return `${diffDay}d ago`;
}

export const DraftRecoveryBanner: React.FC<DraftRecoveryBannerProps> = ({
  timestamp,
  onDiscard,
  onKeep,
}) => {
  return (
    <aside aria-label="Draft recovery" className="w-full bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-amber-500/15 border-b border-amber-500/25 px-4 py-2 flex items-center justify-between z-30 shadow-md backdrop-blur-md transition-all animate-fadeIn">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="text-xs text-amber-200/90 truncate">
          <span className="font-medium text-amber-100">Restored unsaved draft</span>
          <span className="text-amber-300/70 ml-1.5 font-normal">
            ({formatTimeAgo(timestamp)})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDiscard}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-200/90 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-lg transition active:scale-95"
          title="Discard draft and reset to original"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
          <span>Discard Draft</span>
        </button>

        <button
          onClick={onKeep}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-amber-100 bg-amber-500/30 hover:bg-amber-500/40 border border-amber-400/40 rounded-lg transition active:scale-95 shadow-sm"
          title="Keep working on this draft"
        >
          <Check className="w-3 h-3 text-amber-300" />
          <span>Keep</span>
        </button>

        <button
          onClick={onKeep}
          className="p-1 text-amber-300/60 hover:text-amber-200 rounded-md hover:bg-amber-500/10 transition"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

