import React from 'react';
import { Search, X } from 'lucide-react';

interface BrowserSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const BrowserSearch: React.FC<BrowserSearchProps> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <span className="absolute inset-y-0 left-3 flex items-center text-white/40">
      <Search size={14} />
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder-white/30"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute inset-y-0 right-3 flex items-center text-white/40 hover:text-white/80"
      >
        <X size={12} />
      </button>
    )}
  </div>
);