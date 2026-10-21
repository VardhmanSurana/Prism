/**
 * CanvasFilters.tsx
 * Hidden SVG `<defs>` for curves, sharpness, and vignette masks.
 */
import React from 'react';
import { Adjustments, getStringHash } from '../../filterEngine';
import { isIdentityCurve } from '../../curves';

export interface CanvasFiltersProps {
  adjustments: Adjustments;
  curvesTable: { r: string; g: string; b: string };
}

export const CanvasFilters: React.FC<CanvasFiltersProps> = (p) => {
  const sharpnessAmount = (p.adjustments.sharpness / 100) * 2.5;
  const k2 = 1 + sharpnessAmount;
  const k3 = -sharpnessAmount;
  const vignetteOpacity = Math.min(0.9, Math.abs((p.adjustments.vignette || 0) / 100));

  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {!isIdentityCurve(p.adjustments.curves) && (
          <filter
            id={`curves-filter-${getStringHash(JSON.stringify(p.adjustments.curves))}`}
            colorInterpolationFilters="sRGB"
          >
            <feComponentTransfer>
              <feFuncR type="table" tableValues={p.curvesTable.r} />
              <feFuncG type="table" tableValues={p.curvesTable.g} />
              <feFuncB type="table" tableValues={p.curvesTable.b} />
            </feComponentTransfer>
          </filter>
        )}

        {p.adjustments.sharpness > 0 && (
          <filter id="sharpness-filter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
            <feComposite
              in="SourceGraphic"
              in2="blur"
              operator="arithmetic"
              k2={k2}
              k3={k3}
            />
          </filter>
        )}

        <radialGradient id="vignette-mask" r="65%" cx="50%" cy="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity={vignetteOpacity} />
        </radialGradient>
      </defs>
    </svg>
  );
};
