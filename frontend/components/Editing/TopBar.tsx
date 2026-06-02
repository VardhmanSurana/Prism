import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, Save } from 'lucide-react';

interface TopBarProps {
  onClose: () => void;
  isSaving: boolean;
  handleSave: (isSaveAs: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onClose, isSaving, handleSave }) => {
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
    <div className="h-14 flex items-center justify-between px-6 bg-[#040404] border-b border-white/5 shrink-0">
      <button
        onClick={onClose}
        disabled={isSaving}
        className="flex items-center gap-2 px-3 py-1.5 text-white/40 hover:text-white text-sm transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50"
      >
        <X size={15} /> Cancel
      </button>

      <span className="text-white/35 text-xs font-semibold uppercase tracking-widest">
        Edit Photo
      </span>

      <div className="flex items-center gap-2">
        <div className="relative" ref={containerRef}>
          {/* Split button: [ Save As ✓ ] [ ▼ ] */}
          <div className="flex items-stretch rounded-full overflow-hidden shadow-lg shadow-primary/25">
            <button
              onClick={onSaveAs}
              disabled={isSaving}
              className="pl-4 pr-3 py-1.5 bg-primary text-white hover:opacity-90 flex items-center gap-1.5 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <Check size={13} strokeWidth={3} /> Save As
            </button>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              disabled={isSaving}
              aria-label="More save options"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="pr-3 pl-1.5 py-1.5 bg-primary text-white hover:opacity-90 border-l border-white/20 transition-all disabled:opacity-50"
            >
              <ChevronDown
                size={13}
                strokeWidth={3}
                className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Dropdown — hidden "Save" (overwrite) option */}
          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-[#0f0f0f] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden z-50"
            >
              <button
                role="menuitem"
                onClick={onOverwrite}
                className="w-full px-3.5 py-2.5 text-left text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-start gap-2.5"
              >
                <Save size={13} className="text-white/40 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Save</div>
                  <div className="text-[10px] text-white/30 mt-0.5 leading-tight">
                    Overwrites original file
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
