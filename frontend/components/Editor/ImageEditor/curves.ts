import { Point, createMonotoneCubicSpline, generateLUT, compositeLUTs } from './spline';

export type CurveState = {
  master: Point[];
  red: Point[];
  green: Point[];
  blue: Point[];
};

export type SpecializedCurveKind = 'hueVsHue' | 'hueVsSat' | 'hueVsLum' | 'lumVsSat' | 'satVsSat';

export type SpecializedCurvesState = {
  hueVsHue: Point[];
  hueVsSat: Point[];
  hueVsLum: Point[];
  lumVsSat: Point[];
  satVsSat: Point[];
};

export const DEFAULT_SPECIALIZED_CURVE_POINTS: Record<SpecializedCurveKind, Point[]> = {
  hueVsHue: [{ x: 0, y: 180 }, { x: 90, y: 180 }, { x: 180, y: 180 }, { x: 270, y: 180 }, { x: 360, y: 180 }],
  hueVsSat: [{ x: 0, y: 100 }, { x: 90, y: 100 }, { x: 180, y: 100 }, { x: 270, y: 100 }, { x: 360, y: 100 }],
  hueVsLum: [{ x: 0, y: 100 }, { x: 90, y: 100 }, { x: 180, y: 100 }, { x: 270, y: 100 }, { x: 360, y: 100 }],
  lumVsSat: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
  satVsSat: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
};

export const DEFAULT_SPECIALIZED_CURVES: SpecializedCurvesState = {
  hueVsHue: [...DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsHue],
  hueVsSat: [...DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsSat],
  hueVsLum: [...DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsLum],
  lumVsSat: [...DEFAULT_SPECIALIZED_CURVE_POINTS.lumVsSat],
  satVsSat: [...DEFAULT_SPECIALIZED_CURVE_POINTS.satVsSat],
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

export const isIdentitySpecializedCurves = (sc: SpecializedCurvesState | undefined) => {
  if (!sc) return true;
  return (
    arePointsEqual(sc.hueVsHue, DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsHue) &&
    arePointsEqual(sc.hueVsSat, DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsSat) &&
    arePointsEqual(sc.hueVsLum, DEFAULT_SPECIALIZED_CURVE_POINTS.hueVsLum) &&
    arePointsEqual(sc.lumVsSat, DEFAULT_SPECIALIZED_CURVE_POINTS.lumVsSat) &&
    arePointsEqual(sc.satVsSat, DEFAULT_SPECIALIZED_CURVE_POINTS.satVsSat)
  );
};

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
