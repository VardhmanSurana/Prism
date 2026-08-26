import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Command, 
  Search, 
  Shield, 
  Sparkles, 
  Keyboard, 
  HelpCircle, 
  BookOpen, 
  Lock,
  Heart,
  Sliders,
  Maximize2
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const SHORTCUTS = [
    { key: 'Space', desc: 'Open photo in full-screen Lightbox' },
    { key: '/', desc: 'Focus global AI & metadata search bar' },
    { key: 'F', desc: 'Toggle Favorite status on selected photo' },
    { key: 'L', desc: 'Encrypt & move item to Locked Vault' },
    { key: 'E', desc: 'Open 19-tool Image Editor suite' },
    { key: 'Esc', desc: 'Close lightbox, dialogs, or selection mode' },
    { key: '← / →', desc: 'Navigate previous/next photo in Lightbox' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-[#131314] border border-white/10 rounded-2xl p-6 shadow-2xl text-gray-200 space-y-6 font-sans overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-md">
                <img src="/prism-logo.png" alt="Prism Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Prism Help & Guide</h3>
                <p className="text-xs text-gray-400">Local AI Photo Library & Creative Studio Guide</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
            
            {/* Shortcuts Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
                <Keyboard size={14} className="text-[#828fff]" /> Keyboard Shortcuts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SHORTCUTS.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
                    <span className="text-gray-300">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/20 font-mono text-[11px] font-semibold text-white shadow-sm">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Features Guide */}
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" /> Core Features & Capabilities
              </h4>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Search size={13} className="text-[#828fff]" /> Zero-Shot AI & Face Search
                  </p>
                  <p className="text-gray-400 text-[11px]">
                    Type queries like "sunset at beach", "cats", or search by person name in the top search bar. All AI model inferences run 100% locally.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Shield size={13} className="text-emerald-400" /> Argon2id Locked Vault
                  </p>
                  <p className="text-gray-400 text-[11px]">
                    Media inside the Locked Folder is encrypted with DEK/KEK envelope keys. Nobody can access your private vault without your master passphrase.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sliders size={13} className="text-amber-400" /> Image & Video Studio
                  </p>
                  <p className="text-gray-400 text-[11px]">
                    Full non-linear multi-track video timeline editor (NLE) and a 19-tool image editing suite with color curves, crop, flip, and AI Magic Eraser.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs font-mono text-gray-500">
            <span>Prism Core v0.4.2</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#5e6ad2] hover:bg-[#505cb8] text-white font-sans font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
