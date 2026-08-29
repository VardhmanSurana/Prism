/**
 * HistoryOverlay.tsx
 * Slide-out history drawer with an invisible click-outside overlay.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HistoryPanel } from '../../HistoryPanel';
import { HistoryEntry } from '../../history';
import { ToolId } from '../../Sidebar';

export interface HistoryOverlayProps {
  open: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  currentHistoryIndex: number;
  onToggleHide: (id: string) => void;
  onDelete: (id: string) => void;
  onJump: (index: number) => void;
  onResetAll: () => void;
  setActiveTool: (t: ToolId) => void;
}

export const HistoryOverlay: React.FC<HistoryOverlayProps> = (p) => (
  <AnimatePresence>
    {p.open && (
      <>
        <div onClick={p.onClose} className="absolute inset-0 z-30" />
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="absolute right-0 top-0 bottom-0 w-[320px] bg-[#0d0f14]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-40 flex flex-col"
        >
          <HistoryPanel
            history={p.history}
            currentHistoryIndex={p.currentHistoryIndex}
            onToggleHide={p.onToggleHide}
            onDelete={p.onDelete}
            onEdit={(entry) => {
              if (entry.toolId) {
                p.setActiveTool(entry.toolId as ToolId);
              }
            }}
            onJump={p.onJump}
            onResetAll={p.onResetAll}
            onClose={p.onClose}
          />
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
