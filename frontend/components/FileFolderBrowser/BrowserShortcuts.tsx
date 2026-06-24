import React from 'react';
import { ShortcutItem } from './types';

interface BrowserShortcutsProps {
  shortcuts: ShortcutItem[];
  onShortcutClick: (path: string) => void;
}

export const BrowserShortcuts: React.FC<BrowserShortcutsProps> = ({ shortcuts, onShortcutClick }) => {
  if (shortcuts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] text-gray-500 font-mono uppercase mr-1">Quick:</span>
      {shortcuts.map((s) => (
        <button
          key={s.name}
          onClick={() => onShortcutClick(s.path)}
          className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer"
        >
          {s.name}
        </button>
      ))}
    </div>
  );
};