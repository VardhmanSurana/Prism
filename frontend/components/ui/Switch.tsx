import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onToggle,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Styling properties matching fluidfunctionalism.com
  const trackWidth = 34;
  const trackHeight = 20;
  const thumbSize = 16;
  const offset = 2;
  const travel = trackWidth - thumbSize - offset * 2; // 34 - 16 - 4 = 14

  // Width expands slightly on hover/press
  const currentThumbWidth = isPressed
    ? thumbSize + 4 // press extend
    : isHovered
    ? thumbSize + 2 // pill extend
    : thumbSize;

  const currentThumbHeight = isPressed ? thumbSize - 4 : thumbSize;
  const thumbY = isPressed ? offset + 2 : offset;

  // X position based on checked status and width expansion
  const extraWidth = currentThumbWidth - thumbSize;
  const thumbX = checked ? offset + travel - extraWidth : offset;

  const springTransition = {
    type: 'spring',
    stiffness: 700,
    damping: 35,
    mass: 0.8,
  };

  return (
    <div
      className={`flex items-center justify-between py-2 px-1 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
    >
      <span
        className={`text-[13px] font-medium transition-colors duration-150 ${
          checked ? 'text-[#f7f8f8]' : 'text-[#8a8f98]'
        }`}
      >
        {label}
      </span>

      {/* Switch Track */}
      <div
        className="relative shrink-0 rounded-full border border-[#23252a] transition-colors duration-150"
        style={{
          width: trackWidth,
          height: trackHeight,
          backgroundColor: checked
            ? isHovered
              ? '#828fff'
              : '#5e6ad2' // violet matching Prism brand
            : isHovered
            ? '#1a1c1e'
            : '#0c0c0c',
        }}
      >
        {/* Animated Thumb */}
        <motion.span
          className="absolute rounded-full bg-white shadow-sm pointer-events-none"
          initial={false}
          animate={{
            x: thumbX,
            y: thumbY,
            width: currentThumbWidth,
            height: currentThumbHeight,
          }}
          transition={springTransition}
        />
      </div>
    </div>
  );
};
