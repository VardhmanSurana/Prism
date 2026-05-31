import React from 'react';

export const AgentLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`relative w-12 h-12 flex items-center justify-center ${className}`}>
      <div className="relative w-8 h-8 flex items-center justify-center">
        {/* Bar 1 */}
        <div className="absolute w-6 h-2 border-2 border-current rounded-sm translate-y-[-6px]" />
        <div className="absolute w-2 h-6 border-2 border-current rounded-sm translate-x-[6px]" />
        
        {/* Bar 2 - Rotated */}
        <div className="absolute w-6 h-2 border-2 border-current rounded-sm rotate-[120deg] translate-x-[-5px] translate-y-[3px]" />
        <div className="absolute w-2 h-6 border-2 border-current rounded-sm rotate-[120deg] translate-x-[-1px] translate-y-[6px]" />
        
        {/* Bar 3 - Rotated */}
        <div className="absolute w-6 h-2 border-2 border-current rounded-sm rotate-[240deg] translate-x-[5px] translate-y-[3px]" />
        <div className="absolute w-2 h-6 border-2 border-current rounded-sm rotate-[240deg] translate-x-[1px] translate-y-[-6px]" />
      </div>
    </div>
  );
};
