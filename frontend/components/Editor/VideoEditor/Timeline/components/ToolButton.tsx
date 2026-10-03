import React from 'react';

interface ToolButtonProps {
  title: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}

/**
 * ToolButton - Renders tool button.
 */
export const ToolButton: React.FC<ToolButtonProps> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
      active
        ? 'bg-[#e5a93c]/15 text-[#e5a93c] border border-[#e5a93c]/50 shadow-sm'
        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`}
  >
    {children}
  </button>
);
