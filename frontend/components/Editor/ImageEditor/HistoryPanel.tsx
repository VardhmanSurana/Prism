/**
 * HistoryPanel.tsx
 * Sidebar control panel for the non-destructive edit timeline and history stack.
 * Features connected thread layout, GSAP motion animations, and icon hover controls.
 * Styled with a minimalist black, gray, and white palette.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { gsap } from 'gsap';
import { X, Eye, EyeOff, SlidersHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { HistoryEntry } from './history';

export interface HistoryPanelProps {
  history: HistoryEntry[];
  currentHistoryIndex: number;
  onToggleHide: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (entry: HistoryEntry) => void;
  onJump: (index: number) => void;
  onResetAll?: () => void;
  onClose?: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentHistoryIndex,
  onToggleHide,
  onDelete,
  onEdit,
  onJump,
  onResetAll,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out the raw 'initial' entry so only actual edits appear in the timeline tab
  const editEntries = useMemo(
    () =>
      history
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .filter(({ entry }) => entry.type !== 'initial'),
    [history]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll('.timeline-item');
    if (!items.length) return;

    const ctx = gsap.context(() => {
      gsap.from(items, {
        opacity: 0,
        y: 8,
        stagger: 0.03,
        duration: 0.25,
        ease: 'power2.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [editEntries.length]);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#12141a] select-none text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">Timeline of Edits</h3>
          <p className="text-[10px] text-white/40">
            {editEntries.length} {editEntries.length === 1 ? 'Edit' : 'Edits'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onResetAll && editEntries.length > 0 && (
            <button
              onClick={onResetAll}
              className="text-[10px] text-white/50 hover:text-white transition-colors uppercase font-medium tracking-wider px-2 py-1 rounded hover:bg-white/5"
            >
              Reset All
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close History Panel (Escape / H)"
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline List or Empty State */}
      {editEntries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-white/40">
          <p className="text-xs font-medium">No edits made yet</p>
          <p className="text-[10px] mt-1 text-white/25">Edits you apply will appear here in the timeline.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 relative">
          {/* Continuous Track Line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-[1px] bg-white/15" />

          {editEntries.map(({ entry, originalIndex }) => {
            const isActive = originalIndex === currentHistoryIndex;
            const isHidden = !!entry.hidden;
            const isSnapshot = entry.isSnapshot || entry.type === 'inpaint' || entry.type === 'crop';

            return (
              <div
                key={entry.id}
                className={`timeline-item group relative flex items-center gap-3 p-2 rounded-lg transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.08] border border-white/20 shadow-sm'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
                onClick={() => onJump(originalIndex)}
              >
                {/* Timeline Node Dot */}
                <div
                  className={`relative z-10 w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200 ${
                    isActive
                      ? 'bg-white ring-4 ring-white/20 scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                      : isHidden
                      ? 'border border-white/30 bg-transparent'
                      : 'bg-white/30'
                  }`}
                />

                {/* Item Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium truncate ${
                        isHidden
                          ? 'line-through text-white/30'
                          : isActive
                          ? 'text-white font-semibold'
                          : 'text-white/70'
                      }`}
                    >
                      {entry.description}
                    </span>

                    {/* Icon Hover Actions: [Hide/Unhide/Revert] -> [Edit] -> [Del] */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-white/50 flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Hide / Unhide or Revert */}
                      {!isSnapshot ? (
                        <button
                          onClick={() => onToggleHide(entry.id)}
                          title={isHidden ? 'Unhide edit' : 'Hide edit'}
                          className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                        >
                          {isHidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => onJump(originalIndex)}
                          title="Revert to this snapshot"
                          className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <RotateCcw size={13} strokeWidth={2} />
                        </button>
                      )}

                      {/* Edit settings (Jump to tool) */}
                      {entry.toolId && (
                        <button
                          onClick={() => onEdit(entry)}
                          title="Edit settings"
                          className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <SlidersHorizontal size={13} strokeWidth={2} />
                        </button>
                      )}

                      {/* Delete (Moved to end) */}
                      <button
                        onClick={() => onDelete(entry.id)}
                        title="Delete edit"
                        className="p-1 rounded hover:bg-white/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
