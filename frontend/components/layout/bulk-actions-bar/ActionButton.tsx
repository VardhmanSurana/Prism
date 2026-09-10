import React, { useCallback, useRef, type ReactNode } from 'react';
import { animate } from 'framer-motion';
import { EASE } from './animationHelpers';

export interface ActionButtonProps {
  onClick?: () => void;
  label?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  hoverRotate?: boolean;   // trash: tilt 3°
  pulseOnClick?: boolean;  // heart: 1 → 1.25 → 1
  lockSnap?: boolean;      // lock: rotate 8° → 0°
}

/**
 * ActionButton - Renders action button.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick, label, children, className = '', labelClassName = '',
  hoverRotate = false, pulseOnClick = false, lockSnap = false,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  /**
   * hoverIn - Performs hover in.
   */
  const hoverIn = useCallback(() => {
    const btn = btnRef.current;
    const lbl = labelRef.current;
    const icon = iconRef.current;
    if (hoverRotate && icon) {
      animate(icon, { rotate: 3 }, { duration: 0.12, ease: EASE });
    } else if (btn) {
      animate(btn, { scale: 1.08, y: -2 }, { duration: 0.12, ease: EASE });
    }
    if (lbl) animate(lbl, { opacity: 1 }, { duration: 0.12, ease: EASE });
  }, [hoverRotate]);

  /**
   * hoverOut - Performs hover out.
   */
  const hoverOut = useCallback(() => {
    const btn = btnRef.current;
    const lbl = labelRef.current;
    const icon = iconRef.current;
    if (hoverRotate && icon) {
      animate(icon, { rotate: 0 }, { duration: 0.12, ease: EASE });
    } else if (btn) {
      animate(btn, { scale: 1, y: 0 }, { duration: 0.12, ease: EASE });
    }
    if (lbl) animate(lbl, { opacity: 0.85 }, { duration: 0.12, ease: EASE });
  }, [hoverRotate]);

  /**
   * pressDown - Performs press down.
   */
  const pressDown = useCallback(() => {
    const btn = btnRef.current;
    if (btn) animate(btn, { scale: 0.94 }, { duration: 0.07, ease: EASE });
  }, []);

  /**
   * pressUp - Performs press up.
   */
  const pressUp = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    animate(btn, { scale: [0.94, 1.02, 1] }, { duration: 0.18, ease: EASE });
  }, []);

  /**
   * handleClick - Handles click.
   */
  const handleClick = useCallback(() => {
    const icon = iconRef.current;
    if (pulseOnClick && icon) {
      animate(icon, { scale: [1, 1.25, 1] }, { duration: 0.12, ease: EASE });
    }
    if (lockSnap && icon) {
      animate(icon, { rotate: [8, 0] }, { duration: 0.12, ease: EASE });
    }
    onClick?.();
  }, [pulseOnClick, lockSnap, onClick]);

  return (
    <div className="flex flex-col items-center gap-0">
      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onMouseDown={pressDown}
        onMouseUp={pressUp}
        className={`p-2 rounded-full text-gray-300 hover:text-white transition-colors flex items-center justify-center ${className}`}
      >
        <span ref={iconRef} className="flex items-center justify-center">{children}</span>
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
