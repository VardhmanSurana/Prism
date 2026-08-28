import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, Save, Loader2, SplitSquareHorizontal, Copy, Undo2, Redo2, ClipboardCopy, ClipboardPaste, RotateCcw, History } from 'lucide-react';
import { EditorSlider } from './ui/EditorSlider';

interface TopBarProps {
  onClose: () => void;
  onReset?: () => void;
  isDirty?: boolean;
  isSaving: boolean;
  handleSave: (isSaveAs: boolean, format?: string, quality?: number) => void;
  handleCopy: () => void;
  onCompareToggle: () => void;
  isComparing: boolean;
  handleUndo?: () => void;
  handleRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onToggleHistory?: () => void;
  isHistoryOpen?: boolean;
  historyCount?: number;
  exportProgress?: { step: string; current: number; total: number } | null;
  onCopyEdits?: () => void;
  hasCopiedEdits?: boolean;
  onPasteEdits?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onClose,
  onReset,
  isDirty = false,
  isSaving,
  handleSave,
  handleCopy,
  onCompareToggle,
  isComparing,
  handleUndo,
  handleRedo,
  canUndo = false,
  canRedo = false,
  onToggleHistory,
  isHistoryOpen = false,
  historyCount,
  exportProgress,
  onCopyEdits,
  hasCopiedEdits,
  onPasteEdits,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('jpeg');
  const [exportQuality, setExportQuality] = useState(95);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  const onSaveAs = () => {
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const q = exportFormat === 'png' ? 1 : exportQuality / 100;
    handleSave(true, mime, q);
    setDropdownOpen(false);
  };

  const onOverwrite = () => {
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const q = exportFormat === 'png' ? 1 : exportQuality / 100;
    handleSave(false, mime, q);
    setDropdownOpen(false);
  };

  const onCopy = () => {
    handleCopy();
    setDropdownOpen(false);
  };

  return (
    <div className="h-16 flex items-center justify-between px-8 bg-[var(--bg-primary)] border-b border-white/5 shrink-0 z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="group flex items-center gap-2 text-white/45 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors 150ms ease disabled:opacity-50"
        >
          <div className="p-2 rounded-full border border-white/5 group-hover:border-white/20 transition-colors bg-[var(--bg-secondary)]">
            <X size={14} /> 
          </div>
          Cancel
        </button>

        {onReset && isDirty && (
          <button
            onClick={onReset}
            disabled={isSaving}
            title="Reset all edits to original"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium transition-colors 150ms ease disabled:opacity-50"
          >
            <RotateCcw size={12} className="group-hover:-rotate-45 transition-transform" />
            Reset All
          </button>
        )}
      </div>

      {/* Center Row: Undo, Redo, Compare */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        {/* Undo Button */}
        <button
          onClick={handleUndo}
          disabled={!canUndo || isSaving}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-xl border border-white/5 bg-[var(--bg-secondary)] text-white/40 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 disabled:pointer-events-none transition-colors 150ms ease, background-color 150ms ease cursor-pointer"
        >
          <Undo2 size={13} strokeWidth={2.5} />
        </button>

        {/* Redo Button */}
        <button
          onClick={handleRedo}
          disabled={!canRedo || isSaving}
          title="Redo (Ctrl+Y)"
          className="p-2 rounded-xl border border-white/5 bg-[var(--bg-secondary)] text-white/40 hover:text-white/80 hover:bg-white/5 disabled:opacity-20 disabled:pointer-events-none transition-colors 150ms ease, background-color 150ms ease cursor-pointer"
        >
          <Redo2 size={13} strokeWidth={2.5} />
        </button>

        <div className="h-4 w-px bg-white/10" />

        {/* Before/After Compare button — click-toggle for persistent split view */}
        <button
          onClick={onCompareToggle}
          title="Toggle before/after split view (\\)"
          className={`editor-btn editor-card-btn ${
            isComparing ? 'active' : ''
          } flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest`}
        >
          <SplitSquareHorizontal size={12} strokeWidth={2} />
          {isComparing ? 'Hide Original' : 'Compare'}
        </button>

        {/* History Toggle Button */}
        {onToggleHistory && (
          <button
            onClick={onToggleHistory}
            title="Toggle Edit History Timeline (H)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer ${
              isHistoryOpen
                ? 'bg-[#FCBC00] text-black shadow-[0_0_12px_rgba(252,188,0,0.45)]'
                : 'bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <History size={12} strokeWidth={2} />
            History{historyCount !== undefined && historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        )}

        <div className="h-4 w-px bg-white/10" />

        {/* Copy Edits button */}
        <button
          onClick={onCopyEdits}
          disabled={isSaving}
          title="Copy current edits to clipboard"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer ${
            hasCopiedEdits
              ? 'bg-primary/20 text-primary shadow-[0_0_12px_rgba(var(--color-primary),0.15)]'
              : 'bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]'
          } disabled:opacity-20 disabled:pointer-events-none`}
        >
          <ClipboardCopy size={12} strokeWidth={2.5} />
          Copy Edits
        </button>

        {/* Paste Edits button — enabled only when there are copied adjustments */}
        <button
          onClick={onPasteEdits}
          disabled={isSaving || !hasCopiedEdits}
          title="Paste copied edits onto this photo (Batch Sync)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer ${
            hasCopiedEdits
              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.1)]'
              : 'bg-white/[0.02] text-white/20 cursor-default'
          } disabled:cursor-default`}
        >
          <ClipboardPaste size={12} strokeWidth={2.5} />
          Paste Edits
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={containerRef}>
          {/* Refined split button */}
          <div className="flex items-stretch rounded-xl overflow-hidden border border-primary/20 bg-primary hover:shadow-lg hover:shadow-primary/10 transition-shadow 200ms ease">
            <button
              onClick={onSaveAs}
              disabled={isSaving}
              className="pl-5 pr-4 py-2 bg-primary text-[#050505] hover:brightness-110 flex items-center gap-2 text-xs font-bold transition-colors 150ms ease disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Export Copy
            </button>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              disabled={isSaving}
              className="pr-4 pl-3 py-2 bg-primary text-[#050505] hover:brightness-110 border-l border-black/10 transition-colors 150ms ease disabled:opacity-50"
            >
              <ChevronDown
                size={14}
                strokeWidth={3}
                className={`transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Premium Dropdown */}
          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-3 w-64 rounded-2xl bg-[var(--bg-secondary)] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-4 pt-4 pb-3 border-b border-white/5">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Export Format</p>
                <div className="flex bg-white/[0.02] border border-white/5 rounded-lg p-0.5 mb-3">
                  {(['jpeg', 'png', 'webp'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors 150ms ease, background-color 150ms ease ${
                        exportFormat === fmt
                          ? 'bg-white/10 text-white border border-white/5'
                          : 'text-white/30 hover:text-white/50 border border-transparent'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                {exportFormat !== 'png' && (
                  <div className="pt-1">
                    <EditorSlider
                      label="Quality"
                      value={exportQuality}
                      onChange={setExportQuality}
                      min={50}
                      max={100}
                      defaultValue={90}
                      unit="%"
                    />
                  </div>
                )}
              </div>

              {exportProgress && (
                <div className="px-4 py-2 border-b border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-white/40 truncate">{exportProgress.step}</span>
                    <span className="text-[9px] text-primary font-mono">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-width 300ms ease-out"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                role="menuitem"
                onClick={onCopy}
                className="w-full px-4 py-4 text-left hover:bg-white/5 transition-colors 150ms ease, background-color 150ms ease flex items-start gap-3 group border-b border-white/5"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Copy size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white/80 group-hover:text-white flex items-center justify-between">
                    <span>Copy to Clipboard</span>
                  </div>
                  <div className="text-[10px] text-white/20 group-hover:text-white/40 mt-1 leading-tight">
                    Copy image to system clipboard
                  </div>
                </div>
              </button>

              <button
                role="menuitem"
                onClick={onOverwrite}
                className="w-full px-4 py-4 text-left hover:bg-white/5 transition-colors 150ms ease, background-color 150ms ease flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Check size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white/80 group-hover:text-white">Save Changes</div>
                  <div className="text-[10px] text-white/20 group-hover:text-white/40 mt-1 leading-tight">
                    Update original photo file
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
