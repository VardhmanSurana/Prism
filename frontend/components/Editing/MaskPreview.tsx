/**
 * MaskPreview.tsx
 * Visual preview of the inpainting mask with adjustable opacity.
 */

import React from 'react';

interface MaskPreviewProps {
  maskDataUrl: string | null;
  opacity: number;
  visible: boolean;
}

export const MaskPreview: React.FC<MaskPreviewProps> = ({ maskDataUrl, opacity, visible }) => {
  if (!maskDataUrl || !visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        background: `url(${maskDataUrl}) center/contain no-repeat`,
        opacity: opacity / 100,
        mixBlendMode: 'normal',
      }}
    >
      {/* Colored overlay to show masked area */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(59, 130, 246, 0.4)', // Blue tint
          maskImage: `url(${maskDataUrl})`,
          maskSize: 'contain',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          WebkitMaskImage: `url(${maskDataUrl})`,
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};
