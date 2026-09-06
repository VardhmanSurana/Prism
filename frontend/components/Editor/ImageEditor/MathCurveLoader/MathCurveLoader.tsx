/**
 * MathCurveLoader.tsx
 * High-performance mathematical curve loading animations built with SVG.
 * Implements smooth white comet ribbons on subtle orbit tracks with harmonic pulsation.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { MathCurveLoaderProps } from './types';
import { getDetailScale, getRotation, buildPath, getParticle } from './math';
import { MATH_CURVES } from './curves';

export const MathCurveLoader: React.FC<MathCurveLoaderProps> = ({
  curveType,
  size = 140,
  color = '#ffffff',
  showBadge = false,
}) => {
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<(SVGCircleElement | null)[]>([]);

  // Default to Rose Orbit or choose requested / random curve
  const selectedCurveKey = useMemo(() => {
    if (curveType && MATH_CURVES[curveType]) return curveType;
    return 'rose-orbit';
  }, [curveType]);

  const curve = MATH_CURVES[selectedCurveKey];

  useEffect(() => {
    const group = groupRef.current;
    const path = pathRef.current;
    if (!group || !path) return;

    let animId: number;
    const startedAt = performance.now();

    const render = (now: number) => {
      const time = now - startedAt;
      const progress = (time % curve.durationMs) / curve.durationMs;
      const detailScale = getDetailScale(time, curve);
      const rotation = getRotation(time, curve);

      group.setAttribute('transform', `rotate(${rotation.toFixed(2)} 50 50)`);
      path.setAttribute('d', buildPath(curve, detailScale));

      const particles = particlesRef.current;
      const count = curve.particleCount;
      for (let i = 0; i < count; i++) {
        const node = particles[i];
        if (!node) continue;
        const p = getParticle(curve, i, progress, detailScale);
        node.setAttribute('cx', p.x.toFixed(2));
        node.setAttribute('cy', p.y.toFixed(2));
        node.setAttribute('r', p.radius.toFixed(2));
        node.setAttribute('opacity', p.opacity.toFixed(3));
      }

      animId = requestAnimationFrame(render);
    };

    render(performance.now());
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [curve]);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        style={{ color }}
        className="overflow-visible select-none drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]"
      >
        <g ref={groupRef}>
          {/* Faint orbit track path */}
          <path
            ref={pathRef}
            stroke="currentColor"
            strokeWidth={curve.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.12}
          />
          {/* Overlapping glowing particles forming continuous smooth comet trail */}
          {Array.from({ length: curve.particleCount }, (_, i) => (
            <circle
              key={i}
              ref={(el) => {
                particlesRef.current[i] = el;
              }}
              fill="currentColor"
              cx="50"
              cy="50"
              r="2"
              opacity="0"
            />
          ))}
        </g>
      </svg>

      {showBadge && (
        <div className="mt-2 text-center space-y-1 animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-white/90 shadow-sm">
            <span>{curve.name}</span>
          </div>
          <p className="text-[11px] font-mono text-white/40 tracking-tight">{curve.formula}</p>
        </div>
      )}
    </div>
  );
};

