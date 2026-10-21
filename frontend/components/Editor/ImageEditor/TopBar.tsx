import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, Save, Loader2, SplitSquareHorizontal, Copy, Undo2, Redo2, ClipboardCopy, ClipboardPaste, History } from 'lucide-react';
import { EditorSlider } from './ui/EditorSlider';

interface TopBarProps {
  onClose: () => void;
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

/**
 * TopBar - Renders top bar.
 */
export const TopBar: React.FC<TopBarProps> = ({
  onClose,
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

    /**
     * handleClickOutside - Handles click outside.
     */
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    /**
     * handleEscape - Handles escape.
     */
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

  /**
   * onSaveAs - Performs on save as.
   */
  const onSaveAs = () => {
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const q = exportFormat === 'png' ? 1 : exportQuality / 100;
    handleSave(true, mime, q);
    setDropdownOpen(false);
  };

  /**
   * onOverwrite - Performs on overwrite.
   */
  const onOverwrite = () => {
    const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const q = exportFormat === 'png' ? 1 : exportQuality / 100;
    handleSave(false, mime, q);
    setDropdownOpen(false);
  };

  /**
   * onCopy - Performs on copy.
   */
  const onCopy = () => {
    handleCopy();
    setDropdownOpen(false);
  };

  return (
    <div className="h-14 flex items-center justify-between px-6 bg-[#151312] border-b border-white/10 shrink-0 z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="group flex items-center gap-2 text-zinc-400 hover:text-[#f5f0ed] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
        >
          <div className="p-2 rounded-full border border-white/10 group-hover:border-white/20 transition-colors bg-[#1d1b1a]">
            <X size={14} /> 
          </div>
          Cancel
        </button>
      </div>

      {/* Center Row: Undo, Redo, Compare */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        {/* Undo Button */}
        <button
          onClick={handleUndo}
          disabled={!canUndo || isSaving}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-xl border border-white/10 bg-[#1d1b1a] text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <Undo2 size={13} strokeWidth={2.5} />
        </button>

        {/* Redo Button */}
        <button
          onClick={handleRedo}
          disabled={!canRedo || isSaving}
          title="Redo (Ctrl+Y)"
          className="p-2 rounded-xl border border-white/10 bg-[#1d1b1a] text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer border ${
              isHistoryOpen
                ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] shadow-[0_0_14px_rgba(229,169,60,0.35)]'
                : 'bg-[#1d1b1a] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer border ${
            hasCopiedEdits
              ? 'bg-[#e5a93c]/15 text-[#e5a93c] border-[#e5a93c]/30 shadow-[0_0_12px_rgba(229,169,60,0.2)]'
              : 'bg-[#1d1b1a] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all select-none cursor-pointer border ${
            hasCopiedEdits
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.1)]'
              : 'bg-[#1d1b1a] border-white/5 text-zinc-600 cursor-default'
          } disabled:cursor-default`}
        >
          <ClipboardPaste size={12} strokeWidth={2.5} />
          Paste Edits
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={containerRef}>
          {/* Refined split button */}
          <div className="flex items-stretch rounded-xl overflow-hidden border border-[#e5a93c]/40 bg-[#e5a93c] hover:shadow-[0_0_16px_rgba(229,169,60,0.3)] transition-shadow duration-200">
            <button
              onClick={onSaveAs}
              disabled={isSaving}
              className="pl-4 pr-3.5 py-1.5 bg-[#e5a93c] text-[#151312] hover:bg-[#d4982f] flex items-center gap-2 text-xs font-bold tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Export Copy
            </button>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              disabled={isSaving}
              className="pr-3 pl-2.5 py-1.5 bg-[#e5a93c] text-[#151312] hover:bg-[#d4982f] border-l border-black/15 transition-colors disabled:opacity-50 cursor-pointer"
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
              className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#1d1b1a] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-4 pt-4 pb-3 border-b border-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-2.5">Export Format</p>
                <div className="flex bg-[#151312] border border-white/10 rounded-lg p-0.5 mb-3">
                  {(['jpeg', 'png', 'webp'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        exportFormat === fmt
                          ? 'bg-[#e5a93c] text-[#151312]'
                          : 'text-zinc-400 hover:text-[#f5f0ed]'
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
                <div className="px-4 py-2 border-b border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-zinc-400 truncate">{exportProgress.step}</span>
                    <span className="text-[9px] text-[#e5a93c] font-mono">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e5a93c] rounded-full transition-all duration-300"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                role="menuitem"
                onClick={onCopy}
                className="w-full px-4 py-3.5 text-left hover:bg-white/5 transition-colors flex items-start gap-3 group border-b border-white/10 cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-[#e5a93c]/15 group-hover:text-[#e5a93c] text-zinc-400 transition-colors">
                  <Copy size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-[#f5f0ed] flex items-center justify-between">
                    <span>Copy to Clipboard</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400 mt-0.5 leading-tight">
                    Copy image to system clipboard
                  </div>
                </div>
              </button>

              <button
                role="menuitem"
                onClick={onOverwrite}
                className="w-full px-4 py-3.5 text-left hover:bg-white/5 transition-colors flex items-start gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-[#e5a93c]/15 group-hover:text-[#e5a93c] text-zinc-400 transition-colors">
                  <Check size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-[#f5f0ed]">Save Changes</div>
                  <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400 mt-0.5 leading-tight">
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
