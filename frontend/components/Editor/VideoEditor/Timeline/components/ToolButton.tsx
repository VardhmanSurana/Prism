import React from 'react';

interface ToolButtonProps {
  title: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
      active
        ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30'
        : 'text-[#666] hover:text-[#999] hover:bg-[#252525]'
    }`}
  >
    {children}
  </button>
);
