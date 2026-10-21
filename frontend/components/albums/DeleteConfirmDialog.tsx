import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  albumName: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeleteConfirmDialog - Prism styled delete confirmation dialog.
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  albumName,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#100e0d]/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#211f1e] border border-white/[0.1] shadow-2xl p-6 flex flex-col gap-4 relative">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-[#f5f5f4]">Delete Collection</h3>
            <p className="text-[11px] font-mono text-[#a8a29e]">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-xs text-[#a8a29e] leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-medium text-[#f5f5f4]">"{albumName}"</span>?{' '}
          The media assets inside will remain safely preserved in your master library.
        </p>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-full text-xs font-medium text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] border border-white/[0.04] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 rounded-full text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-colors cursor-pointer shadow-sm"
          >
            Delete Collection
          </button>
        </div>
      </div>
    </div>
  );
};
