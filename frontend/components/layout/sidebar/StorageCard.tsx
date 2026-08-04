import React from 'react';
import { HardDrive } from 'lucide-react';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { useSidebar, formatBytes } from './useSidebar';

export const StorageCard: React.FC = () => {
  const { stats, totalBytes } = useSidebar();
  const usedLabel = formatBytes(totalBytes);

  return (
    <div className="px-4 pb-8 relative z-20">
      <GlassMaterial
        intensity="subtle"
        interactive
        borderRadius="1.25rem"
        className="p-4 group cursor-default"
      >
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-1.5 transition-colors duration-300 group-hover:text-white">
          <HardDrive size={16} className="text-gray-500 group-hover:text-primary transition-colors duration-300" />
          <span className="font-medium">Storage</span>
        </div>
        <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors duration-300">
          {totalBytes === 0
            ? stats === null
              ? 'Calculating…'
              : 'No media stored yet'
            : `${usedLabel} used`}
        </div>
      </GlassMaterial>
    </div>
  );
};
