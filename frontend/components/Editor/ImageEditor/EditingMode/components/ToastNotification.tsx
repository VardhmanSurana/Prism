/**
 * ToastNotification.tsx
 * Floating bottom-center toast with success/error styling.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle } from 'lucide-react';
import { ToastMessage } from '../hooks/useToast';

export const ToastNotification: React.FC<{ message: ToastMessage | null }> = ({ message }) => (
  <AnimatePresence>
    {message && (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.7)] text-xs font-semibold select-none pointer-events-none ${
          message.isError
            ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
            : 'bg-[#181a20]/95 border-white/15 text-white'
        }`}
      >
        {message.isError ? (
          <AlertCircle size={15} className="text-rose-400 shrink-0" />
        ) : (
          <Check size={15} className="text-emerald-400 shrink-0" />
        )}
        <span>{message.text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);
