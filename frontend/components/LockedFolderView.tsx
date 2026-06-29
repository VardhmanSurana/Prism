import React from 'react';
import { Lock } from 'lucide-react';
import { PhotoGrid } from './PhotoGrid';
import { Photo } from '../types';

interface LockedFolderViewProps {
  photos: Photo[];
  selectedIds: Set<string>;
  onPhotoClick: (photo: Photo | null) => void;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  onLockSession: () => void;
  scrollParentRef: React.RefObject<HTMLDivElement | null>;
}

export function LockedFolderView({
  photos,
  selectedIds,
  onPhotoClick,
  onToggleSelection,
  onToggleGroupSelection,
  onLockSession,
  scrollParentRef
}: LockedFolderViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-10 py-5 border-b border-white/5 bg-surface/10 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary shadow-inner">
            <Lock size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Locked Folder</h2>
            <p className="text-[10px] text-gray-500 font-mono">Session-locked · visible only to you</p>
          </div>
        </div>
        <button
          onClick={onLockSession}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Lock size={14} />
          <span>Lock Session</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PhotoGrid
          photos={photos}
          onPhotoClick={onPhotoClick}
          selectedIds={selectedIds}
          onToggleSelection={onToggleSelection}
          onToggleGroupSelection={onToggleGroupSelection}
          scrollParentRef={scrollParentRef}
        />
      </div>
    </div>
  );
}
