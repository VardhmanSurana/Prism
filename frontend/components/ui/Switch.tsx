import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';

interface SwitchProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({ label, checked, onToggle, disabled = false, ariaLabel }) => {
  const [isHovered, setIsHovered] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);

  const trackWidth = 34;
  const trackHeight = 20;
  const borderSize = 2;
  const innerWidth = trackWidth - borderSize * 2;
  const innerHeight = trackHeight - borderSize * 2;
  const thumbSize = 15; // exactly half of innerWidth
  const travel = innerWidth - thumbSize;
  const currentThumbWidth = thumbSize;
  const currentThumbHeight = innerHeight;
  const thumbY = 0;
  const thumbX = checked ? travel : 0;

  // GSAP tween for smooth thumb slide
  useEffect(() => {
    if (thumbRef.current) {
      gsap.to(thumbRef.current, {
        x: thumbX,
        y: thumbY,
        width: currentThumbWidth,
        height: currentThumbHeight,
        duration: 0.15,
        ease: 'power3.out',
      });
    }
  }, [checked, thumbX, thumbY, currentThumbWidth, currentThumbHeight]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      disabled={disabled}
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      className={`flex w-full items-center justify-between rounded-md px-1 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#5e6ad2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c] ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      <span className={`text-[13px] font-bold transition-colors duration-150 ${checked ? 'text-[#f7f8f8]' : 'text-[#8a8f98]'}`}>
        {label}
      </span>
      <span
        aria-hidden="true"
        className="relative shrink-0 rounded-[2px] border-2 border-[#23252a] transition-colors duration-150"
        style={{
          width: trackWidth,
          height: trackHeight,
          backgroundColor: checked ? (isHovered ? 'var(--switch-on-hover)' : 'var(--switch-on)') : isHovered ? 'var(--switch-off-hover)' : 'var(--switch-off)',
        }}
      >
        <span
          ref={thumbRef}
          className="pointer-events-none absolute rounded-[1px] bg-white shadow-sm"
          style={{
            width: currentThumbWidth,
            height: currentThumbHeight,
            willChange: 'transform',
          }}
        />
      </span>
    </button>
  );
};
