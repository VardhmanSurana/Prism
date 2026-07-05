import React, { useState, useRef, useEffect } from 'react';
import { Plus, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useSyncStore } from '@/store/syncStore';
import { useImport } from '@/hooks/import';
import type { FloatingActionsProps } from '../types/floating-actions';

export function FloatingActions({ importStatus, onUpload, onImportProgress }: FloatingActionsProps) {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { handleFileUpload, handleFolderImport } = useImport({
    onUpload,
    onImportProgress,
  });

  // Click outside close handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end pointer-events-none"
      ref={menuRef}
    >
      {/* Progress Bars */}
      <div className="flex flex-col gap-4 items-end pointer-events-auto">
        <ProgressBar
          progress={importStatus.progress}
          total={importStatus.total_files}
          processed={importStatus.processed_files}
          isScanning={importStatus.is_scanning}
          label="Importing Photos..."
          color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
        />
        <ProgressBar
          progress={syncStatus.progress}
          total={syncStatus.total_files}
          processed={syncStatus.processed_files}
          isScanning={syncStatus.is_scanning}
        />
      </div>

      {/* Speed Dial Menu + FAB */}
      <div className="relative flex flex-col items-center pointer-events-auto">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center mb-2"
            >
              {/* Import Files Option */}
              <button
                onClick={() => {
                  handleFileUpload();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-surface border border-border hover:bg-surfaceHover text-gray-200 hover:text-white rounded-lg shadow-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
              >
                <ImageIcon size={14} className="text-purple-400" />
                <span>Import Files</span>
              </button>

              {/* Import Folder Option */}
              <button
                onClick={() => {
                  handleFolderImport();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-surface border border-border hover:bg-surfaceHover text-gray-200 hover:text-white rounded-lg shadow-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
              >
                <FolderOpen size={14} className="text-emerald-400" />
                <span>Import Folder</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Circular FAB */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-[0_0_20px_rgba(var(--color-primary),0.25)] hover:brightness-110 active:scale-95 transition-all cursor-pointer z-50"
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          title="Import Options"
        >
          <Plus size={24} />
        </motion.button>
      </div>
    </div>
  );
}
