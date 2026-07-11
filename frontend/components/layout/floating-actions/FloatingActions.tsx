import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useSyncStore } from '@/store/syncStore';
import { useImport } from '@/hooks/import';
import type { FloatingActionsProps } from '../types/floating-actions';

const springPreset = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
  mass: 0.7,
} as const;

const menuContainerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
      staggerChildren: 0.04,
      delayChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: {
      duration: 0.16,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
} as const;

const menuItemVariants = {
  hidden: { opacity: 0, y: 10, x: 6 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { ...springPreset, duration: 0.22 },
  },
  exit: {
    opacity: 0,
    y: 8,
    x: 4,
    transition: { duration: 0.12, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  },
} as const;

const iconVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springPreset,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.1 },
  },
} as const;

const fabVariants = {
  closed: { rotate: 0 },
  open: { rotate: 135 },
};

const UltraLightIcon = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const ImageIcon = () => (
  <UltraLightIcon className="w-[15px] h-[15px] text-[#a78bfa]">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </UltraLightIcon>
);

const FolderIcon = () => (
  <UltraLightIcon className="w-[15px] h-[15px] text-[#34d399]">
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </UltraLightIcon>
);

const CloudIcon = () => (
  <UltraLightIcon className="w-[15px] h-[15px] text-[#38bdf8]">
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
  </UltraLightIcon>
);

const CloseIcon = () => (
  <UltraLightIcon className="w-5 h-5">
    <path d="M18 6L6 18M6 6l12 12" />
  </UltraLightIcon>
);

export function FloatingActions({ importStatus, onUpload, onImportProgress }: FloatingActionsProps) {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { handleFileUpload, handleFolderImport } = useImport({
    onUpload,
    onImportProgress,
  });

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
      className="fixed inset-0 z-50 pointer-events-none"
      ref={menuRef}
    >
      {/* Content */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-5 pointer-events-none">
        {/* Progress Bars */}
        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          <ProgressBar
            progress={importStatus.progress}
            total={importStatus.total_files}
            processed={importStatus.processed_files}
            isScanning={importStatus.is_scanning}
            label="Importing Files..."
            color="bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          />
          <ProgressBar
            progress={syncStatus.progress}
            total={syncStatus.total_files}
            processed={syncStatus.processed_files}
            isScanning={syncStatus.is_scanning}
          />
        </div>

        {/* Menu + FAB */}
        <div className="relative flex items-center justify-end pointer-events-auto">
          <AnimatePresence>
            {isOpen && (
              <motion.div
                variants={menuContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute bottom-[88px] right-2 w-64 p-[3px] rounded-[1.75rem] origin-bottom-right"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                {/* Inner core */}
                <div
                  className="rounded-[calc(1.75rem-3px)] p-1.5 flex flex-col gap-0.5"
                  style={{
                    background: 'rgba(12,12,12,0.92)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(0,0,0,0.4)',
                  }}
                >
                  <motion.button
                    variants={menuItemVariants}
                    onClick={() => {
                      handleFileUpload();
                      setIsOpen(false);
                    }}
                    className="group relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left"
                    style={{
                      transition: 'background 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ x: 3 }}
                  >
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                      style={{
                        background: 'rgba(167,139,250,0.08)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <motion.span variants={iconVariants}>
                        <ImageIcon />
                      </motion.span>
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-white/90 tracking-wide">
                        Import Files
                      </span>
                      <span className="text-[10px] text-white/35 font-mono mt-0.5">
                        or drag &amp; drop onto the window
                      </span>
                    </span>
                  </motion.button>

                  <motion.button
                    variants={menuItemVariants}
                    onClick={() => {
                      handleFolderImport();
                      setIsOpen(false);
                    }}
                    className="group relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left"
                    style={{
                      transition: 'background 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ x: 3 }}
                  >
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                      style={{
                        background: 'rgba(52,211,153,0.08)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <motion.span variants={iconVariants}>
                        <FolderIcon />
                      </motion.span>
                    </span>
                    <span className="text-[13px] font-medium text-white/90 tracking-wide">
                      Import Folder
                    </span>
                  </motion.button>

                  <motion.button
                    variants={menuItemVariants}
                    onClick={() => {
                      alert('Cloud import coming soon!');
                      setIsOpen(false);
                    }}
                    className="group relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left"
                    style={{
                      transition: 'background 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ x: 3 }}
                  >
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                      style={{
                        background: 'rgba(56,189,248,0.08)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <motion.span variants={iconVariants}>
                        <CloudIcon />
                      </motion.span>
                    </span>
                    <span className="text-[13px] font-medium text-white/90 tracking-wide">
                      Import from Cloud
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Action Button */}
          <motion.button
            variants={fabVariants}
            animate={isOpen ? 'open' : 'closed'}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }}
            onClick={() => setIsOpen((prev) => !prev)}
            className="relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer z-50"
            style={{
              background: isOpen
                ? 'rgba(255,255,255,0.92)'
                : 'rgba(20,20,20,0.85)',
              boxShadow: isOpen
                ? '0 0 0 1px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)'
                : '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
              transition: 'background 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              color: isOpen ? '#050505' : 'rgba(255,255,255,0.85)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Import Options"
          >
            <motion.span
              animate={{ rotate: isOpen ? 135 : 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }}
              className="flex items-center justify-center"
            >
              <CloseIcon />
            </motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
