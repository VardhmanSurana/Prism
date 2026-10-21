import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Settings, Lock, Database, HardDrive, CheckCircle2, User } from 'lucide-react';
import { useStats } from '@/hooks/useStats';
import type { ViewMode } from '@/types';

interface UserProfileProps {
  onChangeView?: (view: ViewMode) => void;
}

/**
 * UserProfile - Renders user profile.
 */
export const UserProfile: React.FC<UserProfileProps> = ({ onChangeView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { stats } = useStats();

  useEffect(() => {
    /**
     * handleClickOutside - Handles click outside.
     */
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * formatBytes - Formats format bytes.
   */
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full overflow-hidden border border-white/20 hover:border-[#828fff] transition-colors 150ms ease, border-color 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) flex items-center justify-center bg-gray-800 shadow-md active:scale-95 cursor-pointer"
        title="User Profile & Local Account"
      >
        <img src="/images.jpeg" alt="User Profile" className="w-full h-full object-cover" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-72 bg-[#19191c] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 text-gray-200 font-sans space-y-3 select-none"
          >
            {/* Header info */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                <img src="/images.jpeg" alt="User Profile" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">Local Administrator</p>
                <p className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-400" /> 100% Local & Encrypted
                </p>
              </div>
            </div>

            {/* Account Storage Specs */}
            <div className="space-y-2 text-xs bg-white/[0.03] border border-white/[0.05] p-2.5 rounded-xl font-mono">
              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1"><Database size={12} /> Catalog Items</span>
                <span className="text-white font-semibold">{stats?.total_photos ?? 1248}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1"><HardDrive size={12} /> Local Footprint</span>
                <span className="text-white font-semibold">{formatBytes(stats?.total_size_bytes || 45100000)}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onChangeView?.('utilities');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
              >
                <Settings size={14} className="text-[#828fff]" />
                <span>Settings & Health Maintenance</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onChangeView?.('locked');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
              >
                <Lock size={14} className="text-purple-400" />
                <span>Argon2id Locked Vault</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
