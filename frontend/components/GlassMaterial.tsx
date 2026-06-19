import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface GlassMaterialProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: 'regular' | 'prominent' | 'subtle';
  tint?: string;
  interactive?: boolean;
  borderRadius?: string;
  onClick?: () => void;
}

/**
 * Liquid Glass Material (iOS 26 Style for Web)
 * 
 * Implements the core principles of Apple's Liquid Glass:
 * - Dynamic blur via backdrop-filter
 * - Light reflection/specular highlight following the pointer
 * - Interactive response to touch/pointer
 * - Adaptive tinting
 */
export const GlassMaterial: React.FC<GlassMaterialProps> = ({
  children,
  className = '',
  intensity = 'regular',
  tint,
  interactive = false,
  borderRadius = '1rem',
  onClick,
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smoothing for the light reflection
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 30 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 30 });

  const [isHovered, setIsHovered] = useState(false);

  // Intensity mappings
  const blurValue = {
    subtle: 'blur(8px)',
    regular: 'blur(20px)',
    prominent: 'blur(40px)',
  }[intensity];

  const opacityValue = {
    subtle: 0.02,
    regular: 0.05,
    prominent: 0.08,
  }[intensity];

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  // Light reflection (specular highlight)
  const background = useTransform(
    [smoothX, smoothY],
    ([x, y]) => {
      if (!isHovered && interactive) return `radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%)`;
      return `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 40%)`;
    }
  );

  return (
    <motion.div
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={interactive ? { scale: 0.98 } : {}}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius,
        backdropFilter: blurValue,
        WebkitBackdropFilter: blurValue, // For Safari
        backgroundColor: tint || `rgba(255, 255, 255, ${opacityValue})`,
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Specular Highlight Layer */}
      {interactive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background }}
        />
      )}
      
      {/* Edge Reflection (Simulating glass depth) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1)',
          borderRadius
        }}
      />

      <div className="relative z-10 h-full">
        {children}
      </div>
    </motion.div>
  );
};

interface GlassEffectContainerProps {
  children: React.ReactNode;
  className?: string;
  spacing?: number;
}

/**
 * Container that manages shared glass context.
 * In a real iOS 26 implementation, this would handle morphing between siblings.
 */
export const GlassEffectContainer: React.FC<GlassEffectContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`glass-effect-container ${className}`}>
      {children}
    </div>
  );
};
