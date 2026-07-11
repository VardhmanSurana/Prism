import React, { useEffect, useRef } from 'react';
import { Pencil, FolderOpen } from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  isFolder: boolean;
}

interface BrowserContextMenuProps {
  menu: ContextMenuState;
  canBatchRename: boolean;
  selectedCount: number;
  onClose: () => void;
  onBatchRename: () => void;
  onOpenRenameForSingle: () => void;
  onOpenInOsExplorer: () => void;
}

export const BrowserContextMenu: React.FC<BrowserContextMenuProps> = ({
  menu,
  canBatchRename,
  selectedCount,
  onClose,
  onBatchRename,
  onOpenRenameForSingle,
  onOpenInOsExplorer,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(menu.x, window.innerWidth - 200),
    top: Math.min(menu.y, window.innerHeight - 120),
    zIndex: 1200,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="min-w-[180px] rounded-xl border border-white/10 bg-[#121212] shadow-2xl py-1 overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {!menu.isFolder && (
        <button
          type="button"
          onClick={() => {
            if (selectedCount > 1 && canBatchRename) {
              onBatchRename();
            } else {
              onOpenRenameForSingle();
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 hover:text-white text-left cursor-pointer"
        >
          <Pencil size={12} className="text-primary shrink-0" />
          {selectedCount > 1 && canBatchRename
            ? `Batch rename (${selectedCount})…`
            : 'Rename with pattern…'}
        </button>
      )}

      {menu.isFolder && (
        <div className="px-3 py-2 text-[10px] text-white/35 font-mono">
          Folder actions coming soon
        </div>
      )}

      <button
        type="button"
        onClick={onOpenInOsExplorer}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 hover:text-white text-left cursor-pointer"
      >
        <FolderOpen size={12} className="shrink-0" />
        Open in OS Explorer
      </button>
    </div>
  );
};
