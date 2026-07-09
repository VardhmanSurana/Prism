import React, { useState } from 'react';
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
 * Performance note: When interactive=false (default), this uses plain CSS
 * instead of Framer Motion springs to avoid Main Thread overhead.
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
  // Intensity mappings — only use backdrop-blur for interactive or prominent instances
  const blurValue = interactive ? {
    subtle: 'blur(4px)',
    regular: 'blur(12px)',
    prominent: 'blur(16px)',
  }[intensity] : 'none';

  const opacityValue = {
    subtle: 0.02,
    regular: 0.05,
    prominent: 0.08,
  }[intensity];

  // Non-interactive path: plain div, no motion values, no springs
  if (!interactive) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden ${className}`}
        style={{
          borderRadius,
          backgroundColor: tint || `rgba(255, 255, 255, ${opacityValue})`,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
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
      </div>
    );
  }

  // Interactive path: motion values for pointer-following specular highlight
  return (
    <InteractiveGlass
      children={children}
      className={className}
      intensity={intensity}
      tint={tint}
      borderRadius={borderRadius}
      onClick={onClick}
      opacityValue={opacityValue}
    />
  );
};

const InteractiveGlass: React.FC<{
  children: React.ReactNode;
  className: string;
  intensity: 'regular' | 'prominent' | 'subtle';
  tint?: string;
  borderRadius: string;
  onClick?: () => void;
  opacityValue: number;
}> = ({ children, className, intensity, tint, borderRadius, onClick, opacityValue }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 150, damping: 20 });
  const [isHovered, setIsHovered] = useState(false);

  const blurValue = {
    subtle: 'blur(4px)',
    regular: 'blur(12px)',
    prominent: 'blur(16px)',
  }[intensity];

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useTransform(
    [smoothX, smoothY],
    ([x, y]) => {
      if (!isHovered) return `radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%)`;
      return `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 40%)`;
    }
  );

  return (
    <motion.div
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius,
        backdropFilter: blurValue,
        WebkitBackdropFilter: blurValue,
        backgroundColor: tint || `rgba(255, 255, 255, ${opacityValue})`,
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background }}
      />
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
