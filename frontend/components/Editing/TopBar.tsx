import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, Save, Loader2, SplitSquareHorizontal } from 'lucide-react';

interface TopBarProps {
  onClose: () => void;
  isSaving: boolean;
  handleSave: (isSaveAs: boolean) => void;
  onCompareStart: () => void;
  onCompareEnd: () => void;
  isComparing: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onClose, isSaving, handleSave, onCompareStart, onCompareEnd, isComparing }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    handleSave(true);
    setDropdownOpen(false);
  };

  const onOverwrite = () => {
    handleSave(false);
    setDropdownOpen(false);
  };

  return (
    <div className="h-16 flex items-center justify-between px-8 bg-[#050505] border-b border-white/5 shrink-0 z-50">
      <div className="flex items-center gap-6">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="group flex items-center gap-2 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <div className="p-2 rounded-full border border-white/5 group-hover:border-white/20 transition-colors">
            <X size={14} /> 
          </div>
          Cancel
        </button>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.6)]" />
        <span className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]">
          Studio Editor
        </span>

        {/* Before/After comparison button — hold to compare */}
        <button
          onPointerDown={onCompareStart}
          onPointerUp={onCompareEnd}
          onPointerLeave={onCompareEnd}
          title="Hold to compare with original (\\)"
          className={`ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 select-none ${
            isComparing
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-white/[0.03] border-white/8 text-white/25 hover:text-white/50 hover:bg-white/5'
          }`}
        >
          <SplitSquareHorizontal size={12} strokeWidth={2} />
          {isComparing ? 'Original' : 'Before / After'}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={containerRef}>
          {/* Refined split button */}
          <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl shadow-primary/20 border border-primary/20">
            <button
              onClick={onSaveAs}
              disabled={isSaving}
              className="pl-5 pr-4 py-2 bg-primary text-[#050505] hover:brightness-110 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Export Copy
            </button>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              disabled={isSaving}
              className="pr-4 pl-3 py-2 bg-primary text-[#050505] hover:brightness-110 border-l border-black/10 transition-all disabled:opacity-50"
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
              className="absolute right-0 top-full mt-3 w-56 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
            >
              <button
                role="menuitem"
                onClick={onOverwrite}
                className="w-full px-4 py-4 text-left hover:bg-white/5 transition-all flex items-start gap-3 group"
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
