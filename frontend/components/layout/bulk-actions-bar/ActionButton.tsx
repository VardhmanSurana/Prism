import React, { useCallback, useRef, type ReactNode } from 'react';

export interface ActionButtonProps {
  onClick?: () => void;
  label?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  hoverRotate?: boolean;
  pulseOnClick?: boolean;
  lockSnap?: boolean;
}

/**
 * ActionButton - Renders action button.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick, label, children, className = '', labelClassName = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`group/btn flex flex-col items-center justify-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-all text-[#d6d3d1] hover:text-white ${className}`}
    >
      <span className="flex items-center justify-center transition-transform duration-150 group-hover/btn:scale-105">
        {children}
      </span>
      {label && (
        <span
          className={`text-[11px] font-sans font-normal tracking-normal text-[#a8a29e] group-hover/btn:text-[#e7e5e4] transition-colors leading-none select-none text-center ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </button>
  );
};
