import React from 'react';
import { AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === 'rose' ? 'bg-rose-500/20 text-rose-500' : 'bg-primary/20 text-primary'}`}>
            <AlertCircle size={24} />
          </div>
          <h3 className="text-2xl font-serif italic text-white">{title}</h3>
        </div>
        
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          {message}
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 ${type === 'rose' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-primary hover:opacity-90 text-black'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
