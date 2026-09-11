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
  const labelRef = useRef<HTMLSpanElement>(null);

  return (
    <div className="flex flex-col items-center gap-0">
      <button
        onClick={onClick}
        className={`p-2 rounded-full text-gray-300 hover:text-white transition-colors flex items-center justify-center ${className}`}
      >
        <span className="flex items-center justify-center">{children}</span>
      </button>
      {label && (
        <span
          ref={labelRef}
          className={`text-[11px] font-medium text-gray-300 whitespace-nowrap leading-none select-none pointer-events-none text-center truncate -mt-0.5 ${labelClassName}`}
          style={{ opacity: 0.85 }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
