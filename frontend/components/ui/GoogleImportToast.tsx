import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncStore } from '@/store/syncStore';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

interface GoogleImportToastProps {
  onStop?: () => void;
  onShowMore?: () => void;
  previewImg?: string;
  forceShow?: boolean;
}

/**
 * GoogleImportToast - Renders google import toast.
 */
export const GoogleImportToast: React.FC<GoogleImportToastProps> = ({
  onStop,
  onShowMore,
  previewImg,
  forceShow = false,
}) => {
  /**
   * syncStatus - Performs sync status.
   */
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const { galleryStyle } = useGalleryLayout();
  const [isDismissed, setIsDismissed] = useState(false);

  // Show if scanning/syncing or if forceShow is enabled in Google theme
  const isVisible =
    galleryStyle === 'google' &&
    !isDismissed &&
    (forceShow || syncStatus.is_scanning || (syncStatus.total_files > 0 && syncStatus.processed_files < syncStatus.total_files));

  if (!isVisible) return null;

  const total = syncStatus.total_files || 4;
  const processed = syncStatus.processed_files || 0;
  const progress = syncStatus.progress || (total > 0 ? (processed / total) * 100 : 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-6 z-50 w-[360px] bg-[#1E1F22] rounded-2xl shadow-2xl border border-white/10 overflow-hidden font-sans select-none"
      >
        <div className="p-5 flex items-start justify-between gap-4">
          {/* Left Column: Counter, Text, Buttons */}
          <div className="flex-1 min-w-0 pr-1">
            <span className="text-xs font-sans text-gray-300 font-normal block mb-1">
              {processed} of {total}
            </span>
            <h3 className="text-sm font-sans font-medium text-[#E3E2E6] leading-snug mb-4">
              Backing up your items will take about 1 minute
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  onStop?.();
                  setIsDismissed(true);
                }}
                className="px-5 py-2 rounded-full bg-[#A8C7FA] text-[#001D35] font-sans font-medium text-xs hover:bg-[#C2E7FF] active:scale-95 transition-transform 100ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease shadow-sm cursor-pointer"
              >
                Stop
              </button>
              <button
                onClick={onShowMore}
                className="px-2 py-2 text-xs font-sans font-medium text-[#A8C7FA] hover:text-white transition-colors cursor-pointer"
              >
                Show more
              </button>
            </div>
          </div>

          {/* Right Column: Thumbnail Image Card */}
          <div className="w-20 h-28 shrink-0 rounded-xl overflow-hidden shadow-md border border-white/10 relative bg-[#28292C]">
            {previewImg ? (
              <img src={previewImg} alt="Import preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full p-2 flex flex-col justify-between text-[#C4C6D0] bg-gradient-to-b from-[#28292C] to-[#1E1F22]">
                <div className="space-y-1">
                  <div className="h-1.5 w-12 bg-white/20 rounded" />
                  <div className="h-1.5 w-14 bg-white/15 rounded" />
                  <div className="h-1.5 w-10 bg-white/15 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-14 bg-white/15 rounded" />
                  <div className="h-1.5 w-12 bg-white/20 rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Blue Progress Line */}
        <div className="w-full bg-white/10 h-1 overflow-hidden">
          <div
            className="bg-[#A8C7FA] h-full transition-transform 300ms cubic-bezier(0.23, 1, 0.32, 1)"
            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
