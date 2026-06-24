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
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ago`;
  };

  return (
    <div className="w-56 shrink-0 relative z-10 bg-[var(--bg-secondary)] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <History size={14} className="text-white/40" />
            <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wide">
              History
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 1 && (
              <button
                onClick={onClear}
                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                title="Clear history"
              >
                <RotateCcw size={12} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-white/45 hover:text-white transition-colors cursor-pointer"
                title="Collapse Panel"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider">
          {history.length} {history.length === 1 ? 'State' : 'States'}
        </p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 px-4">
            <History size={28} className="mb-2 opacity-30" />
            <p className="text-[10px] text-center">No edits yet</p>
          </div>
        ) : (
          <div className="py-3 relative">
            {/* Timeline vertical line */}
            <div className="timeline-line" />

            {history.map((entry, index) => {
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const isInitial = index === 0;

              return (
                <div
                  key={entry.id}
                  className={`
                    group w-full px-3 py-2.5 flex items-start gap-3 transition-all text-left relative
                    ${isCurrent 
                      ? 'bg-primary/5' 
                      : isFuture
                      ? 'opacity-30'
                      : 'opacity-70 hover:opacity-100'
                    }
                  `}
                >
                  {/* Timeline Dot */}
                  <div className="mt-1 shrink-0 flex items-center justify-center relative">
                    <div className={`timeline-dot transition-all duration-300 ${isCurrent ? 'timeline-dot-active scale-125' : ''}`} />
                    {isCurrent && (
                       <div className="absolute w-3 h-3 rounded-full bg-primary/20 animate-ping" />
                    )}
                  </div>

                  {/* Clickable jump-to area */}
                  <div 
                    onClick={() => !isCurrent && onJumpTo(index)}
                    className={`flex-1 flex items-start gap-2 min-w-0 ${!isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isCurrent ? 'text-primary' : 'text-white/60'} ${entry.hidden ? 'line-through opacity-40' : ''}`}>
                          {entry.type === 'regions' 
                            ? entry.description.replace('Adjusted ', '') 
                            : entry.type.replace(/([A-Z])/g, ' $1')
                          }
                        </span>
                        {isCurrent && (
                          <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className={`text-[10px] leading-relaxed transition-colors duration-300 ${entry.hidden ? 'line-through text-white/20' : isCurrent ? 'text-white/80' : 'text-white/40'}`}>
                        {entry.description}
                        {entry.value !== undefined && (
                          <span className="ml-1 font-mono text-primary/80">
                            {entry.value > 0 ? '+' : ''}{entry.value}
                          </span>
                        )}
                      </p>
                      <p className="text-[8px] font-medium text-white/20 mt-0.5 uppercase tracking-widest">
                        {getRelativeTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Hide and Delete actions on the right side of the row */}
                  {!isInitial && (
                    <div className="flex flex-col items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all pl-1.5 self-start z-10 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHide(index);
                        }}
                        className={`p-1 rounded hover:bg-white/5 transition-colors cursor-pointer ${
                          entry.hidden ? 'text-primary bg-primary/10' : 'text-white/30 hover:text-white/70'
                        }`}
                        title={entry.hidden ? "Show step" : "Hide step"}
                      >
                        {entry.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(index);
                        }}
                        className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete step"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      {history.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5 bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between text-[9px] text-white/40">
            <span>Step {currentIndex + 1} of {history.length}</span>
            {currentIndex < history.length - 1 && (
              <span className="text-white/25">
                {history.length - currentIndex - 1} future {history.length - currentIndex - 1 === 1 ? 'state' : 'states'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};