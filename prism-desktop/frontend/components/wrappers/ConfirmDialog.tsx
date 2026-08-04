import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Lock, Unlock, AlertCircle, X } from 'lucide-react';
import { registerConfirmCallback, unregisterConfirmCallback } from '@/services/ConfirmService';

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  resolve: (value: boolean) => void;
}

export const ConfirmDialog: React.FC = () => {
  const [state, setState] = useState<ConfirmState | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerConfirmCallback((options) => {
      setState({
        isOpen: true,
        message: options.message,
        title: options.title,
        resolve: options.resolve,
      });
    });

    return () => {
      unregisterConfirmCallback();
    };
  }, []);

  useEffect(() => {
    if (state?.isOpen) {
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
  }, [state?.isOpen]);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  useEffect(() => {
    if (!state?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state?.resolve(false);
        setState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  if (!state || !state.isOpen) return null;

  const titleText = state.title || 'Confirm Action';
  const messageText = state.message;

  const isDestructive = /delete|trash|purge|remove/i.test(titleText) || /delete|trash|purge|remove/i.test(messageText);
  const isLock = /lock|encrypt/i.test(titleText) || /lock|encrypt/i.test(messageText);
  const isUnlock = /unlock|decrypt/i.test(titleText) || /unlock|decrypt/i.test(messageText);

  let IconComponent = AlertCircle;
  let iconBgClass = 'bg-white/5 text-white/60';
  let iconGlowClass = 'rgba(255, 255, 255, 0.05)';
  let confirmBtnClass = 'bg-white text-black hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.15)]';

  if (isDestructive) {
    IconComponent = Trash2;
    iconBgClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
    iconGlowClass = 'rgba(239, 68, 68, 0.2)';
    confirmBtnClass = 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]';
  } else if (isLock) {
    IconComponent = Lock;
    iconBgClass = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    iconGlowClass = 'rgba(168, 85, 247, 0.2)';
    confirmBtnClass = 'bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]';
  } else if (isUnlock) {
    IconComponent = Unlock;
    iconBgClass = 'bg-green-500/10 text-green-400 border border-green-500/20';
    iconGlowClass = 'rgba(34, 197, 94, 0.2)';
    confirmBtnClass = 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]';
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
          className="absolute inset-0 bg-black/70"
        />

        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="relative max-w-sm w-full bg-[#0a0a0a]/90 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center"
        >
          <div
            className="absolute -top-16 w-32 h-32 rounded-full blur-[40px] pointer-events-none opacity-40 transition-all duration-300"
            style={{ backgroundColor: iconGlowClass }}
          />

          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>

          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBgClass}`}>
            <IconComponent size={22} className="stroke-[1.75]" />
          </div>

          <h3 className="text-sm font-semibold text-white/95 tracking-wide uppercase mb-2">
            {titleText}
          </h3>

          <p className="text-xs text-white/50 leading-relaxed max-w-[280px] mb-6">
            {messageText}
          </p>

          <div className="flex w-full gap-3 mt-1">
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white/75 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider flex-1 cursor-pointer"
            >
              Cancel
            </button>
            <button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              className={`px-4 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex-1 cursor-pointer ${confirmBtnClass}`}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
