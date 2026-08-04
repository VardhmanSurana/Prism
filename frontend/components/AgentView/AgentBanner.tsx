import React from 'react';
import { motion } from 'framer-motion';

interface AgentBannerProps {
  title: string;
  subtitle: string;
}

export const AgentBanner: React.FC<AgentBannerProps> = ({ title, subtitle }) => {
  return (
    <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
      <motion.img
        src="/agent-logo.jpeg"
        alt="Agent Logo"
        className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-md"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      />
      <div>
        <h2 className="text-md font-bold text-white tracking-wide">{title}</h2>
        <p className="text-[11px] text-gray-400 font-medium">{subtitle}</p>
      </div>
    </div>
  );
};