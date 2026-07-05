import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'primary' | 'rose';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  type,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-[#0c0c0c] border border-[#23252a] rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-6">
          <h3 className="font-serif italic text-[#f7f8f8] text-xl leading-tight">
            {title}
          </h3>
          <p className="text-sm text-[#d0d6e0] mt-3 leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="flex gap-3 p-6 pt-0">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-[#0c0c0c] border border-[#23252a] text-[#d0d6e0] hover:bg-[#141516] rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`flex-1 px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white transition-colors ${
              type === 'rose'
                ? 'bg-[#e5484d] hover:bg-[#dc3d42]'
                : 'bg-[#5e6ad2] hover:bg-[#828fff]'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
