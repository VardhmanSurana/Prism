import React, { useState, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

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
 * instead of GSAP to avoid Main Thread overhead.
 * 
 * When interactive=true, uses GSAP quickTo for 60fps mouse tracking
 * without React re-renders.
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

  // Non-interactive path: plain div, no GSAP, no springs
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

  // Interactive path: GSAP quickTo for pointer-following specular highlight
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
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const blurValue = {
    subtle: 'blur(4px)',
    regular: 'blur(12px)',
    prominent: 'blur(16px)',
  }[intensity];

  // GSAP quickTo for high-frequency mouse tracking — no React re-renders
  const quickHighlightX = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const quickHighlightY = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Lazy-init quickTo on first pointer move
    if (!quickHighlightX.current && highlightRef.current) {
      quickHighlightX.current = gsap.quickTo(highlightRef.current, 'x', {
        duration: 0.3,
        ease: 'power2.out',
      });
      quickHighlightY.current = gsap.quickTo(highlightRef.current, 'y', {
        duration: 0.3,
        ease: 'power2.out',
      });
    }

    if (quickHighlightX.current && quickHighlightY.current) {
      quickHighlightX.current(x);
      quickHighlightY.current(y);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (highlightRef.current) {
      gsap.to(highlightRef.current, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (highlightRef.current) {
      gsap.to(highlightRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        scale: 0.98,
        duration: 0.1,
        ease: 'power2.inOut',
      });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        scale: 1,
        duration: 0.15,
        ease: 'power2.out',
      });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius,
        backdropFilter: blurValue,
        WebkitBackdropFilter: blurValue,
        backgroundColor: tint || `rgba(255, 255, 255, ${opacityValue})`,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        willChange: 'transform',
      }}
    >
      {/* Specular highlight — follows pointer via GSAP quickTo */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(600px circle at 0px 0px, rgba(255,255,255,0.06), transparent 40%)',
          opacity: 0,
          willChange: 'transform, opacity',
        }}
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
    </div>
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
