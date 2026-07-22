import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { GlassMaterial } from '@/components/ui/GlassMaterial';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', description: 'Play / Pause Slideshow' },
  { key: 'S', description: 'Start Slideshow Mode' },
  { key: 'E', description: 'Open Image Editor / Video NLE' },
  { key: 'I', description: 'Toggle EXIF Info Panel' },
  { key: 'F', description: 'Toggle Star / Favorite' },
  { key: 'Cmd + L', description: 'Auto-Enhance Photo' },
  { key: 'Left / Right', description: 'Navigate Previous / Next Photo' },
  { key: 'Esc', description: 'Close Lightbox / Exit Slideshow' },
  { key: '?', description: 'Show Keyboard Shortcuts Overlay' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <GlassMaterial intensity="medium" className="relative w-full max-w-md rounded-2xl border border-white/15 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Keyboard size={20} className="text-primary" />
          <h3 className="text-xl font-serif font-bold text-white">Lightbox Keyboard Shortcuts</h3>
        </div>
        <p className="text-xs text-gray-400 mb-5">Quick keys for navigation, slideshow, and editing.</p>

        <div className="space-y-2.5">
          {SHORTCUTS.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-gray-300 font-medium">{item.description}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/20 text-xs font-mono font-semibold text-primary">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90"
          >
            Got It
          </button>
        </div>
      </GlassMaterial>
    </div>
  );
};
