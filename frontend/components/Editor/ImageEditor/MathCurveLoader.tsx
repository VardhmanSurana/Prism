/**
 * MathCurveLoader.tsx
 * High-performance mathematical curve loading animations built with HTML5 Canvas.
 * Implements Lemniscate Bloom, Rose Three, Spiral Search, Butterfly Phase, Rose Orbit,
 * and Hypotrochoid Loop inspired by https://github.com/Paidax01/math-curve-loaders.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';

export type MathCurveType =
  | 'lemniscate-bloom'
  | 'rose-three'
  | 'spiral-search'
  | 'butterfly-phase'
  | 'rose-orbit'
  | 'hypotrochoid-loop';

export interface CurveDefinition {
  id: MathCurveType;
  name: string;
  formula: string;
  speed: number;
  particleCount: number;
  trailLength: number;
  getPoint: (t: number, scale: number, time: number) => { x: number; y: number };
}

export const MATH_CURVES: Record<MathCurveType, CurveDefinition> = {
  'lemniscate-bloom': {
    id: 'lemniscate-bloom',
    name: 'Lemniscate Bloom',
    formula: 'r² = a² cos(2θ) · (1 + 0.2 sin(3t))',
    speed: 1.4,
    particleCount: 36,
    trailLength: 28,
    getPoint: (t, scale, time) => {
      // Bernoulli Lemniscate with harmonic breathing scale
      const pulse = 1 + 0.18 * Math.sin(time * 2.5);
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const r = scale * 1.15 * pulse;
      const x = (r * Math.cos(t)) / denom;
      const y = (r * Math.sin(t) * Math.cos(t)) / denom;
      return { x, y };
    },
  },
  'rose-three': {
    id: 'rose-three',
    name: 'Rose Three',
    formula: 'r = a cos(3θ) · rot(t)',
    speed: 1.2,
    particleCount: 38,
    trailLength: 30,
    getPoint: (t, scale, time) => {
      // 3-petal Rhodonea curve with rotation & inner pulsation
      const theta = t + time * 0.4;
      const r = scale * Math.cos(3 * theta) * (0.85 + 0.15 * Math.sin(time * 3));
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      return { x, y };
    },
  },
  'spiral-search': {
    id: 'spiral-search',
    name: 'Spiral Search',
    formula: 'r = a √(t/2π) · (1 + 0.2 cos(4t))',
    speed: 1.6,
    particleCount: 42,
    trailLength: 32,
    getPoint: (t, scale, time) => {
      // Fermat-Archimedean spiral with beacon search modulation
      const normT = (t % (Math.PI * 2)) / (Math.PI * 2);
      const beacon = 1 + 0.22 * Math.cos(4 * t - time * 4);
      const r = scale * Math.sqrt(normT + 0.05) * beacon;
      const angle = t * 2 + time * 1.2;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      return { x, y };
    },
  },
  'butterfly-phase': {
    id: 'butterfly-phase',
    name: 'Butterfly Phase',
    formula: 'r = e^{cos θ} - 2 cos(4θ) + sin⁵(θ/12)',
    speed: 1.3,
    particleCount: 44,
    trailLength: 34,
    getPoint: (t, scale, time) => {
      // Temple Fay's Butterfly Curve with flutter phase
      const flutter = 1 + 0.12 * Math.sin(time * 5);
      const rBase = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin(t / 12), 5);
      const r = (scale * 0.28 * rBase) * flutter;
      const x = r * Math.sin(t);
      const y = -r * Math.cos(t);
      return { x, y };
    },
  },
  'rose-orbit': {
    id: 'rose-orbit',
    name: 'Rose Orbit',
    formula: 'r = a(0.6 + 0.4 cos(5θ)) + orbit(t)',
    speed: 1.5,
    particleCount: 40,
    trailLength: 30,
    getPoint: (t, scale, time) => {
      // Multi-lobe Rose curve with orbital precession
      const r = scale * (0.65 + 0.35 * Math.cos(5 * t + time * 1.5));
      const orbitalAngle = t + 0.3 * Math.sin(2 * t + time * 2);
      const x = r * Math.cos(orbitalAngle);
      const y = r * Math.sin(orbitalAngle);
      return { x, y };
    },
  },
  'hypotrochoid-loop': {
    id: 'hypotrochoid-loop',
    name: 'Hypotrochoid Loop',
    formula: 'x = (R-r)cos t + d cos((R-r)t/r)',
    speed: 1.4,
    particleCount: 48,
    trailLength: 36,
    getPoint: (t, scale, time) => {
      // Rolling hypocycloid (R=5, r=3, d=4)
      const R = 5;
      const r = 3;
      const d = 4.2;
      const s = scale / 8.5;
      const rot = time * 0.3;
      const tRot = t + rot;
      const rawX = (R - r) * Math.cos(tRot) + d * Math.cos(((R - r) / r) * tRot);
      const rawY = (R - r) * Math.sin(tRot) - d * Math.sin(((R - r) / r) * tRot);
      return { x: rawX * s, y: rawY * s };
    },
  },
};

const ALL_CURVE_KEYS: MathCurveType[] = [
  'lemniscate-bloom',
  'rose-three',
  'spiral-search',
  'butterfly-phase',
  'rose-orbit',
  'hypotrochoid-loop',
];

interface MathCurveLoaderProps {
  curveType?: MathCurveType;
  size?: number;
  color?: string;
  showBadge?: boolean;
}

export const MathCurveLoader: React.FC<MathCurveLoaderProps> = ({
  curveType,
  size = 180,
  color = '#38bdf8',
  showBadge = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Randomly select one of the 6 curves if not explicitly passed
  const selectedCurveKey = useMemo(() => {
    if (curveType) return curveType;
    const randomIndex = Math.floor(Math.random() * ALL_CURVE_KEYS.length);
    return ALL_CURVE_KEYS[randomIndex];
  }, [curveType]);

  const curve = MATH_CURVES[selectedCurveKey];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const scale = (size * 0.42);
    const centerX = size / 2;
    const centerY = size / 2;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const time = elapsed * curve.speed;

      ctx.clearRect(0, 0, size, size);

      // Draw glowing mathematical background orbit guide (subtle faint trace)
      ctx.beginPath();
      const samples = 120;
      for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * Math.PI * 2;
        const pt = curve.getPoint(t, scale, time);
        if (i === 0) {
          ctx.moveTo(centerX + pt.x, centerY + pt.y);
        } else {
          ctx.lineTo(centerX + pt.x, centerY + pt.y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw moving particle trail with neon gradient glow
      const { particleCount, trailLength } = curve;
      for (let i = 0; i < particleCount; i++) {
        const particleOffset = (i / particleCount) * Math.PI * 2;
        const tHead = (time * 1.5 + particleOffset) % (Math.PI * 2);

        // Draw particle head
        const headPt = curve.getPoint(tHead, scale, time);
        const px = centerX + headPt.x;
        const py = centerY + headPt.y;

        // Head glow halo
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 6);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, `${color}99`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();

        // Core bright white dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Particle trail
        for (let j = 1; j <= trailLength; j++) {
          const trailT = tHead - j * 0.035;
          const trailPt = curve.getPoint(trailT, scale, time);
          const tx = centerX + trailPt.x;
          const ty = centerY + trailPt.y;
          const alpha = Math.max(0, (1 - j / trailLength) * 0.55);

          ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(0.6, 1.5 * (1 - j / trailLength)), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [curve, size, color]);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="drop-shadow-[0_0_20px_rgba(56,189,248,0.35)]"
        />
      </div>

      {showBadge && (
        <div className="mt-2 text-center space-y-0.5 animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-cyan-300 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{curve.name}</span>
          </div>
          <p className="text-[9px] font-mono text-white/30 tracking-tight">{curve.formula}</p>
        </div>
      )}
    </div>
  );
};

