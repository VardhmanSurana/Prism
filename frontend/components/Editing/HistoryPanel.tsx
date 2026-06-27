import React from 'react';
import { History, RotateCcw, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { HistoryEntry } from './history';

interface HistoryPanelProps {
  history: HistoryEntry[];
  currentIndex: number;
  onJumpTo: (index: number) => void;
  onClear: () => void;
  onToggleHide: (index: number) => void;
  onDeleteEntry: (index: number) => void;
  onClose?: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentIndex,
  onJumpTo,
  onClear,
  onToggleHide,
  onDeleteEntry,
  onClose,
}) => {
  // Filter out the initial entry from display
  const displayEntries = history
    .map((entry, index) => ({ entry, originalIndex: index }))
    .filter(({ entry }) => entry.type !== 'initial');

  return (
    <div className="w-56 shrink-0 relative z-10 bg-[var(--bg-secondary)] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={13} className="text-white/40" />
            <h3 className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">
              History
            </h3>
          </div>
          <div className="flex items-center gap-0.5">
            {displayEntries.length > 0 && (
              <button
                onClick={onClear}
                className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                title="Clear history"
              >
                <RotateCcw size={11} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-white/35 hover:text-white/60 transition-colors cursor-pointer"
                title="Collapse Panel"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 px-4">
            <History size={24} className="mb-2 opacity-30" />
            <p className="text-[10px] text-center">No edits yet</p>
          </div>
        ) : (
          <div className="py-2 relative">
            {displayEntries.map(({ entry, originalIndex }, displayIndex) => {
              const isCurrent = originalIndex === currentIndex;
              const isFuture = originalIndex > currentIndex;

              return (
                <div
                  key={entry.id}
                  className={`
                    group w-full px-3 py-2 flex items-start gap-2.5 transition-all text-left relative
                    ${isCurrent
                      ? 'bg-primary/5'
                      : isFuture
                      ? 'opacity-30'
                      : 'opacity-70 hover:opacity-100'
                    }
                  `}
                >
                  {/* Timeline Dot */}
                  <div className="mt-1.5 shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                      isCurrent ? 'bg-primary scale-125' : 'bg-white/15'
                    }`} />
                  </div>

                  {/* Clickable jump-to area */}
                  <div
                    onClick={() => !isCurrent && onJumpTo(originalIndex)}
                    className={`flex-1 min-w-0 ${!isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                        isCurrent ? 'text-primary' : 'text-white/50'
                      } ${entry.hidden ? 'line-through opacity-40' : ''}`}>
                        {entry.type === 'regions'
                          ? entry.description.replace('Adjusted ', '')
                          : entry.type.replace(/([A-Z])/g, ' $1')
                        }
                      </span>
                      {isCurrent && (
                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <p className={`text-[9px] leading-relaxed transition-colors duration-200 mt-0.5 ${
                      entry.hidden ? 'line-through text-white/15' : isCurrent ? 'text-white/60' : 'text-white/30'
                    }`}>
                      {entry.description}
                      {entry.value !== undefined && (
                        <span className="ml-1 font-mono text-primary/70">
                          {entry.value > 0 ? '+' : ''}{entry.value}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all self-start z-10 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHide(originalIndex);
                      }}
                      className={`p-0.5 rounded hover:bg-white/5 transition-colors cursor-pointer ${
                        entry.hidden ? 'text-primary bg-primary/10' : 'text-white/25 hover:text-white/60'
                      }`}
                      title={entry.hidden ? "Show step" : "Hide step"}
                    >
                      {entry.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(originalIndex);
                      }}
                      className="p-0.5 rounded hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete step"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {displayEntries.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5">
          <p className="text-[8px] text-white/25 text-center">
            {currentIndex > 0 ? `Step ${currentIndex} of ${history.length - 1}` : 'Original'}
          </p>
        </div>
      )}
    </div>
  );
};
