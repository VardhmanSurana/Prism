import React, { useCallback, useRef, type ReactNode } from 'react';
import { animate } from 'animejs';
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

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick, label, children, className = '', labelClassName = '',
  hoverRotate = false, pulseOnClick = false, lockSnap = false,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const hoverIn = useCallback(() => {
    const btn = btnRef.current;
    const lbl = labelRef.current;
    const icon = iconRef.current;
    if (hoverRotate && icon) {
      animate(icon, { rotate: 3, duration: 120, easing: EASE });
    } else if (btn) {
      animate(btn, { scale: 1.08, translateY: -2, duration: 120, easing: EASE });
    }
    if (lbl) animate(lbl, { opacity: 1, duration: 120, easing: EASE });
  }, [hoverRotate]);

  const hoverOut = useCallback(() => {
    const btn = btnRef.current;
    const lbl = labelRef.current;
    const icon = iconRef.current;
    if (hoverRotate && icon) {
      animate(icon, { rotate: 0, duration: 120, easing: EASE });
    } else if (btn) {
      animate(btn, { scale: 1, translateY: 0, duration: 120, easing: EASE });
    }
    if (lbl) animate(lbl, { opacity: 0.85, duration: 120, easing: EASE });
  }, [hoverRotate]);

  const pressDown = useCallback(() => {
    const btn = btnRef.current;
    if (btn) animate(btn, { scale: 0.94, duration: 70, easing: EASE });
  }, []);

  const pressUp = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    animate(btn, {
      keyframes: [
        { scale: 1.02, duration: 90 },
        { scale: 1, duration: 90 },
      ],
      easing: EASE,
    });
  }, []);

  const handleClick = useCallback(() => {
    const icon = iconRef.current;
    if (pulseOnClick && icon) {
      animate(icon, {
        keyframes: [
          { scale: 1.25, duration: 60 },
          { scale: 1, duration: 60 },
        ],
        easing: EASE,
      });
    }
    if (lockSnap && icon) {
      animate(icon, { rotate: [8, 0], duration: 120, easing: EASE });
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
