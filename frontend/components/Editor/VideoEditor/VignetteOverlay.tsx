import React from 'react';

interface VignetteOverlayProps {
  intensity: number;
}

export const VignetteOverlay: React.FC<VignetteOverlayProps> = ({ intensity }) => {
  const opacity = (intensity / 100) * 0.7;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <defs>
        <radialGradient id="vignette-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="70%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity={opacity} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#vignette-gradient)" />
    </svg>
  );
};
