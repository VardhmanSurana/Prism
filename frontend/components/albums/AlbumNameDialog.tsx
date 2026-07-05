import React, { useState, useEffect, useRef } from 'react';
import { X, FolderPlus, Pencil } from 'lucide-react';

interface AlbumNameDialogProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialValue?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export const AlbumNameDialog: React.FC<AlbumNameDialogProps> = ({
  isOpen,
  mode,
  initialValue = '',
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const isCreate = mode === 'create';
  const title = isCreate ? 'New Album' : 'Rename Album';
  const Icon = isCreate ? FolderPlus : Pencil;
  const confirmLabel = isCreate ? 'Create' : 'Save';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-gray-500">
              {isCreate ? 'Give your new album a name' : 'Enter a new name for this album'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            placeholder={isCreate ? 'e.g. Summer 2025' : 'Album name'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-indigo-500/60 rounded-xl text-white placeholder-gray-600 focus:outline-none text-sm transition-colors"
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
