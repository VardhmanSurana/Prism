/**
 * HistoryPanel.tsx
 * Sidebar control panel for the non-destructive edit timeline and history stack.
 * Features connected thread layout, GSAP motion animations, and pure text hover controls.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { gsap } from 'gsap';
import { X } from 'lucide-react';
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
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--bg-secondary)] select-none text-white/90 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Timeline of Edits</h3>
          <p className="text-[10px] text-white/40">
            {editEntries.length} {editEntries.length === 1 ? 'Edit' : 'Edits'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onResetAll && editEntries.length > 0 && (
            <button
              onClick={onResetAll}
              className="text-[10px] text-red-400/80 hover:text-red-300 transition-colors uppercase font-medium tracking-wider px-2 py-1 rounded hover:bg-white/5"
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
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 relative">
          {/* Continuous Track Line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-white/10" />

          {editEntries.map(({ entry, originalIndex }) => {
            const isActive = originalIndex === currentHistoryIndex;
            const isHidden = !!entry.hidden;
            const isSnapshot = entry.isSnapshot || entry.type === 'inpaint' || entry.type === 'crop';

            return (
              <div
                key={entry.id}
                className={`timeline-item group relative flex items-center gap-3 p-2 rounded-lg transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-950/40 border border-indigo-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
                onClick={() => onJump(originalIndex)}
              >
                {/* Timeline Node Dot */}
                <div
                  className={`relative z-10 w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200 ${
                    isActive
                      ? 'bg-indigo-500 ring-4 ring-indigo-500/20 scale-110'
                      : isHidden
                      ? 'border-2 border-white/30 bg-transparent'
                      : 'bg-white/40'
                  }`}
                />

                {/* Item Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium truncate ${
                        isHidden
                          ? 'line-through text-white/40'
                          : isActive
                          ? 'text-indigo-200 font-semibold'
                          : 'text-white/80'
                      }`}
                    >
                      {entry.description}
                    </span>

                    {/* Pure Text Hover Actions (No icons) */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-semibold flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      {!isSnapshot ? (
                        <button
                          onClick={() => onToggleHide(entry.id)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {isHidden ? 'unhide' : 'hide'}
                        </button>
                      ) : (
                        <button
                          onClick={() => onJump(originalIndex)}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          revert
                        </button>
                      )}

                      <button
                        onClick={() => onDelete(entry.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        del
                      </button>

                      {entry.toolId && (
                        <button
                          onClick={() => onEdit(entry)}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          edit
                        </button>
                      )}
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
