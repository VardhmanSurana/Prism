import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AlbumNameDialogProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialValue?: string;
  onConfirm: (name: string, category?: string) => void;
  onClose: () => void;
}

/**
 * AlbumNameDialog - Prism styled dialog for creating and renaming albums.
 */
export const AlbumNameDialog: React.FC<AlbumNameDialogProps> = ({
  isOpen,
  mode,
  initialValue = '',
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const [category, setCategory] = useState<'travel' | 'events' | 'projects'>('travel');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const isCreate = mode === 'create';
  const title = isCreate ? 'Create New Collection' : 'Rename Album';
  const confirmLabel = isCreate ? 'Create Album' : 'Save Changes';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed, category);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#100e0d]/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#211f1e] border border-white/[0.1] shadow-2xl p-6 sm:p-7 flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl sm:text-2xl text-[#f5f5f4] tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Input field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#a8a29e]">
              Album Title
            </label>
            <input
              ref={inputRef}
              id="album-name-input"
              name="albumName"
              aria-label="Album title"
              type="text"
              placeholder={isCreate ? 'e.g. Kyoto Architectural Survey, Monsoon 2024...' : 'Album title'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-[#100e0d] border border-white/[0.08] focus:border-white/30 rounded-full px-4 py-2.5 text-[#e7e1df] placeholder-[#78716c] text-sm outline-none transition-colors"
            />
          </div>

          {/* Genre / Category selection for creation */}
          {isCreate && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#a8a29e]">
                Collection Genre
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'travel', label: 'Travel' },
                  { id: 'events', label: 'Events' },
                  { id: 'projects', label: 'Project' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as any)}
                    className={`py-2 px-3 rounded-full text-xs font-medium transition-all text-center cursor-pointer ${
                      category === item.id
                        ? 'bg-[#c6c6c7] text-[#151312] shadow-sm font-semibold'
                        : 'bg-[#1d1b1a] text-[#a8a29e] hover:bg-[#2c2928] hover:text-[#f5f5f4] border border-white/[0.04]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
            <span className="text-[11px] text-[#78716c] font-sans">
              Photos can be dragged into album once created.
            </span>
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-[#f5f5f4] text-[#1c1917] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

