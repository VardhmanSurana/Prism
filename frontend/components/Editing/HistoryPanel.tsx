import React from 'react';
import { History, RotateCcw, Eye, EyeOff, Trash2 } from 'lucide-react';
import { HistoryEntry, getActionColor } from './history';

interface HistoryPanelProps {
  history: HistoryEntry[];
  currentIndex: number;
  onJumpTo: (index: number) => void;
  onClear: () => void;
  onToggleHide: (index: number) => void;
  onDeleteEntry: (index: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentIndex,
  onJumpTo,
  onClear,
  onToggleHide,
  onDeleteEntry,
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
    <div className="w-64 bg-[#0f0f0f] border-l border-white/5 flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <History size={16} className="text-white/40" />
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wide">
              History
            </h3>
          </div>
          {history.length > 1 && (
            <button
              onClick={onClear}
              className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
              title="Clear history"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider">
          {history.length} {history.length === 1 ? 'State' : 'States'}
        </p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 px-4">
            <History size={32} className="mb-2 opacity-30" />
            <p className="text-xs text-center">No edits yet</p>
          </div>
        ) : (
          <div className="py-2">
            {history.map((entry, index) => {
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const isInitial = index === 0;

              return (
                <div
                  key={entry.id}
                  className={`
                    group w-full px-4 py-3 flex items-start gap-3 transition-all text-left
                    border-l-2 relative
                    ${isCurrent 
                      ? 'bg-white/10 border-primary' 
                      : isFuture
                      ? 'border-transparent opacity-45'
                      : 'border-transparent opacity-75 hover:opacity-100'
                    }
                  `}
                >
                  {/* Clickable jump-to area */}
                  <div 
                    onClick={() => !isCurrent && onJumpTo(index)}
                    className={`flex-1 flex items-start gap-3 min-w-0 ${!isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${getActionColor(entry.type)} ${entry.hidden ? 'line-through text-white/20' : ''}`}>
                          {entry.type === 'regions' 
                            ? entry.description.replace('Adjusted ', '') 
                            : entry.type.charAt(0).toUpperCase() + entry.type.slice(1).replace(/([A-Z])/g, ' $1')
                          }
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded">
                            Current
                          </span>
                        )}
                        {entry.hidden && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/50 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mb-1 line-clamp-2 ${entry.hidden ? 'line-through text-white/25' : 'text-white/60'}`}>
                        {entry.description}
                        {entry.value !== undefined && (
                          <span className="ml-1 font-mono text-primary">
                            {entry.value > 0 ? '+' : ''}{entry.value}
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-white/30">
                        {getRelativeTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Hide and Delete actions on the right side of the row */}
                  {!isInitial && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2 self-center z-10 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHide(index);
                        }}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                          entry.hidden ? 'text-primary' : 'text-white/40 hover:text-white/80'
                        }`}
                        title={entry.hidden ? "Show step" : "Hide step"}
                      >
                        {entry.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(index);
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete step"
                      >
                        <Trash2 size={13} />
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
        <div className="px-4 py-3 border-t border-white/5 bg-[#0a0a0a]">
          <div className="flex items-center justify-between text-[10px] text-white/40">
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
