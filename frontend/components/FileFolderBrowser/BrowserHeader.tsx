import React from 'react';
import { X } from 'lucide-react';

interface BrowserHeaderProps {
  title: string;
  onClose: () => void;
}

export const BrowserHeader: React.FC<BrowserHeaderProps> = ({ title, onClose }) => (
  <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
    <h3 className="text-sm font-semibold text-white/95 uppercase tracking-wider">
      {title}
    </h3>
    <button
      onClick={onClose}
      className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer"
    >
      <X size={16} />
    </button>
  </div>
);