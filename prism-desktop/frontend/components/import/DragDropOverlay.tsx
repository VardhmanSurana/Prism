import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle, X } from 'lucide-react';
import type { DragDropPhase } from '@/hooks/import/useDragDropImport';

interface DragDropOverlayProps {
  phase: DragDropPhase;
  error?: string | null;
  onDismissError?: () => void;
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({
  phase,
  error,
  onDismissError,
}) => {
  const showHover = phase === 'hover';

  useEffect(() => {
    if (!error || !onDismissError) return;
    const t = window.setTimeout(onDismissError, 5000);
    return () => window.clearTimeout(t);
  }, [error, onDismissError]);

  return (
    <>
      <AnimatePresence>
        {showHover && (
          <motion.div
            key="drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[2000] pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative mx-6 max-w-md w-full rounded-3xl border-2 border-dashed border-primary/50 bg-[#0c0c0c]/90 px-8 py-10 text-center shadow-2xl shadow-primary/10"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Drop to import
              </h2>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">
                Release files or folders to add them to your Prism library.
                Supported images and videos will be scanned automatically.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="drag-error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[2000] -translate-x-1/2 max-w-sm w-[min(100%-2rem,24rem)]"
          >
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-[#141414]/95 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur-md">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span className="flex-1 leading-snug">{error}</span>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="shrink-0 p-0.5 text-white/40 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
