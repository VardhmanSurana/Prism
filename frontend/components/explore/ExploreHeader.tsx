import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '@/lib/motion-tokens';

interface ExploreHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const ExploreHeader: React.FC<ExploreHeaderProps> = ({ icon, title, subtitle }) => {
  return (
    <div className="mb-8 space-y-1">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={springs.gentle}
        className="flex items-center gap-2 text-primary/60"
      >
        {icon}
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.4em]">
          {subtitle || 'Discover'}
        </span>
      </motion.div>
      <h3 className="text-4xl font-serif italic text-white tracking-tight">{title}</h3>
    </div>
  );
};
