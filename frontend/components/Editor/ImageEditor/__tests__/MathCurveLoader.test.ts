import { describe, it, expect } from 'vitest';
import { MATH_CURVES, MathCurveType } from '../MathCurveLoader';

describe('Math Curve Loaders (https://github.com/Paidax01/math-curve-loaders)', () => {
  const CURVE_KEYS: MathCurveType[] = [
    'lemniscate-bloom',
    'rose-three',
    'spiral-search',
    'butterfly-phase',
    'rose-orbit',
    'hypotrochoid-loop',
  ];

  it('contains all 6 requested mathematical curve definitions', () => {
    CURVE_KEYS.forEach((key) => {
      const curve = MATH_CURVES[key];
      expect(curve).toBeDefined();
      expect(curve.name).toBeTruthy();
      expect(curve.formula).toBeTruthy();
      expect(typeof curve.getPoint).toBe('function');
      expect(curve.particleCount).toBeGreaterThan(0);
    });
  });

  it('computes valid finite (x, y) coordinates for all curves across sample domains', () => {
    const scale = 100;
    const time = 1.5;

    CURVE_KEYS.forEach((key) => {
      const curve = MATH_CURVES[key];
      for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        const pt = curve.getPoint(t, scale, time);
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
        expect(Number.isNaN(pt.x)).toBe(false);
        expect(Number.isNaN(pt.y)).toBe(false);
      }
    });
  });
});
