import React, { useState, useRef, useEffect } from 'react';
import { Plus, Image as ImageIcon, FolderOpen, Cloud } from 'lucide-react';
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
      <div className="relative w-14 h-14 pointer-events-auto">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-18 right-0 w-52 bg-surface border border-border rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 mb-2 z-50"
            >
              {/* Context menu arrow */}
              <div className="absolute right-[22px] -bottom-1.5 w-3 h-3 bg-surface border-r border-b border-border rotate-45 z-[-1]" />

              {/* Import Images Option */}
              <button
                onClick={() => {
                  handleFileUpload();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-surfaceHover rounded-lg transition-all active:scale-[0.98] text-left font-medium"
              >
                <ImageIcon size={16} className="text-purple-400" />
                <span>Import Images</span>
              </button>

              {/* Import Folder Option */}
              <button
                onClick={() => {
                  handleFolderImport();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-surfaceHover rounded-lg transition-all active:scale-[0.98] text-left font-medium"
              >
                <FolderOpen size={16} className="text-emerald-400" />
                <span>Import Folder</span>
              </button>

              {/* Import from Cloud Option */}
              <button
                onClick={() => {
                  alert("Cloud import coming soon!");
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-surfaceHover rounded-lg transition-all active:scale-[0.98] text-left font-medium"
              >
                <Cloud size={16} className="text-sky-400" />
                <span>Import from Cloud</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Circular FAB */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-0 w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-[0_0_20px_rgba(var(--color-primary),0.25)] hover:brightness-110 active:scale-95 transition-all cursor-pointer z-50"
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
