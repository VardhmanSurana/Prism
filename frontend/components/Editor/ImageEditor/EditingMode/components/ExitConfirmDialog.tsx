/**
 * ExitConfirmDialog.tsx
 * "Unsaved changes" modal: keep draft, discard, or cancel.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Check } from 'lucide-react';

export interface ExitConfirmDialogProps {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const ExitConfirmDialog: React.FC<ExitConfirmDialogProps> = ({
  open, onKeep, onDiscard, onCancel,
}) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Unsaved Changes</h3>
              <p className="text-xs text-white/50 mt-0.5">What would you like to do?</p>
            </div>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            You have active edits on this photo. You can keep them saved as a draft to resume anytime or discard them completely.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onKeep}
              className="w-full py-2.5 px-4 bg-primary text-black font-semibold text-xs rounded-xl hover:brightness-110 transition active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Keep Draft & Exit</span>
            </button>
            <button
              onClick={onDiscard}
              className="w-full py-2.5 px-4 bg-red-500/15 border border-red-500/30 text-red-300 font-semibold text-xs rounded-xl hover:bg-red-500/25 transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Discard All Edits & Exit</span>
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 px-4 text-white/45 hover:text-white text-xs font-medium rounded-xl hover:bg-white/5 transition"
            >
              Cancel (Stay in Editor)
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
