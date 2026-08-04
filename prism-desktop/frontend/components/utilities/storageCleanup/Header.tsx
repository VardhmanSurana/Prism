import React from 'react';
import { HardDrive } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <div className="flex items-center gap-2 mb-4 border-b border-white/[0.04] pb-4">
      <HardDrive size={16} className="text-[#5e6ad2]" />
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#8a8f98]">
        Smart Storage Cleanup & Disk Actions
      </span>
    </div>
  );
};

