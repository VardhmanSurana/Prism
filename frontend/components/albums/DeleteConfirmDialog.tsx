import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  albumName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  albumName,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Delete Album</h3>
            <p className="text-xs text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-white">"{albumName}"</span>?{' '}
          The photos inside will not be deleted.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-400 rounded-xl text-white text-sm font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
