import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  ToastItem,
  dismissToast,
  registerDismissCallback,
  registerToastCallback,
} from '../../services/ToastService';

/**
 * ToastHost - Global toast renderer.
 *
 * Mount once near the app root (alongside ConfirmHost). Toasts stack
 * bottom-right, auto-dismiss individually, and announce politely to screen
 * readers via a shared aria-live region.
 */
export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    registerToastCallback((toast) => {
      setToasts((prev) => [...prev.slice(-4), toast]); // cap stack at 5
    });
    registerDismissCallback(removeToast);
    return () => {
      registerToastCallback(null);
      registerDismissCallback(null);
    };
  }, [removeToast]);

  // Live region text for screen readers (latest toast only).
  const liveMessage = toasts.length > 0 ? toasts[toasts.length - 1].message : '';

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

const VARIANT_STYLES: Record<ToastItem['variant'], { icon: React.ReactNode; cls: string }> = {
  info: {
    icon: <Info size={15} className="text-[#a8a29e] shrink-0" aria-hidden="true" />,
    cls: 'border-white/10',
  },
  success: {
    icon: <CheckCircle2 size={15} className="text-emerald-400 shrink-0" aria-hidden="true" />,
    cls: 'border-emerald-500/30',
  },
  error: {
    icon: <AlertCircle size={15} className="text-red-400 shrink-0" aria-hidden="true" />,
    cls: 'border-red-500/30',
  },
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [progress, setProgress] = useState(100);
  const { icon, cls } = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    const interval = 50;
    const step = (interval / toast.durationMs) * 100;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return prev - step;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className={`pointer-events-auto w-80 max-w-[90vw] overflow-hidden rounded-xl bg-[#211f1e] border ${cls} shadow-2xl px-4 py-3`}
      data-testid={`toast-${toast.variant}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon}
          <span className="text-xs font-medium text-white break-words">{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5" aria-hidden="true">
        <div
          className="h-full bg-white/25 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};
