import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Sparkles, Navigation, Image, Sliders } from 'lucide-react';

interface ShortcutsCheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  icon: React.ElementType;
  shortcuts: { key: string; description: string }[];
}

const CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    icon: Navigation,
    shortcuts: [
      { key: 'Cmd/Ctrl + K', description: 'Command Palette' },
      { key: '1', description: 'Gallery' },
      { key: '2', description: 'Explore' },
      { key: '3', description: 'Map' },
      { key: '4', description: 'People' },
      { key: '8', description: 'Culling Workspace' },
      { key: ',', description: 'Utilities & Settings' },
      { key: '?', description: 'Shortcuts Cheatsheet' },
    ],
  },
  {
    title: 'Fast Culling Workspace',
    icon: Sparkles,
    shortcuts: [
      { key: 'P', description: 'Pick (Green Flag) + Next' },
      { key: 'X', description: 'Reject (Red Flag) + Next' },
      { key: 'U', description: 'Unflag + Next' },
      { key: '1 - 5', description: 'Set Star Rating (1 to 5)' },
      { key: '0', description: 'Clear Star Rating' },
      { key: 'C', description: 'Toggle Dual-Photo Comparison' },
      { key: 'Space', description: 'Toggle 100% Inspection Zoom' },
    ],
  },
  {
    title: 'Lightbox & Viewer',
    icon: Image,
    shortcuts: [
      { key: '→ / ←', description: 'Next / Previous Photo' },
      { key: 'F', description: 'Toggle Favorite' },
      { key: 'L', description: 'Toggle Private Vault Lock' },
      { key: 'Delete', description: 'Move to Trash' },
      { key: 'Esc', description: 'Close Viewer / Dismiss Modal' },
    ],
  },
  {
    title: 'Actions & Utilities',
    icon: Sliders,
    shortcuts: [
      { key: 'U', description: 'Upload Photos (in Gallery)' },
      { key: 'Ctrl + Z', description: 'Undo Last Bulk Action' },
      { key: 'Esc', description: 'Clear Active Selection' },
    ],
  },
];

export const ShortcutsCheatsheetModal: React.FC<ShortcutsCheatsheetModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-2xl bg-[#14171D] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">Keyboard Shortcuts</h3>
                  <p className="text-xs text-gray-400">Power-user keybindings across Prism</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {CATEGORIES.map((category) => (
                <div
                  key={category.title}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                    <category.icon size={14} />
                    <span>{category.title}</span>
                  </div>

                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03] last:border-0"
                      >
                        <span className="text-gray-300">{shortcut.description}</span>
                        <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[11px] text-white font-medium shadow-sm">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-gray-300">?</kbd> anywhere to toggle this cheatsheet</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
