import { Point, createMonotoneCubicSpline, generateLUT, compositeLUTs } from './spline';

export type CurveState = {
  master: Point[];
  red: Point[];
  green: Point[];
  blue: Point[];
};

export interface CurveLuts {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
}

export const DEFAULT_CURVE: CurveState = {
  master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
};

const scalePoints = (pts: Point[]) => pts.map((p) => ({ x: p.x / 255, y: p.y / 255 }));

const arePointsEqual = (a: Point[], b: Point[]) =>
  a.length === b.length && a.every((point, index) => point.x === b[index].x && point.y === b[index].y);

export const isIdentityCurve = (curves: CurveState) =>
  arePointsEqual(curves.master, DEFAULT_CURVE.master) &&
  arePointsEqual(curves.red, DEFAULT_CURVE.red) &&
  arePointsEqual(curves.green, DEFAULT_CURVE.green) &&
  arePointsEqual(curves.blue, DEFAULT_CURVE.blue);

const toByteLut = (lut: number[]) => Uint8Array.from(lut.map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255)));

export function getCompositeCurveLuts(curves: CurveState, samples: number = 256): CurveLuts {
  if (isIdentityCurve(curves)) {
    const identity = Uint8Array.from({ length: samples }, (_, index) =>
      Math.round(index / Math.max(1, samples - 1) * 255),
    );

    return { r: identity, g: identity.slice(), b: identity.slice() };
  }

  const masterFn = createMonotoneCubicSpline(scalePoints(curves.master));
  const redFn = createMonotoneCubicSpline(scalePoints(curves.red));
  const greenFn = createMonotoneCubicSpline(scalePoints(curves.green));
  const blueFn = createMonotoneCubicSpline(scalePoints(curves.blue));

  const masterLut = generateLUT(masterFn, samples);
  const redLut = generateLUT(redFn, samples);
  const greenLut = generateLUT(greenFn, samples);
  const blueLut = generateLUT(blueFn, samples);

  return {
    r: toByteLut(compositeLUTs(redLut, masterLut)),
    g: toByteLut(compositeLUTs(greenLut, masterLut)),
    b: toByteLut(compositeLUTs(blueLut, masterLut)),
  };
}

export function getCurvesTableValues(curves: CurveState): { r: string; g: string; b: string } {
  if (isIdentityCurve(curves)) {
    return { r: '0 1', g: '0 1', b: '0 1' };
  }

  const { r, g, b } = getCompositeCurveLuts(curves, 256);
  const toTableValues = (lut: Uint8Array) => Array.from(lut, (value) => (value / 255).toFixed(4)).join(' ');

  return {
    r: toTableValues(r),
    g: toTableValues(g),
    b: toTableValues(b),
  };
}
