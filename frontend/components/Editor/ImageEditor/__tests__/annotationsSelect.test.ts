import { describe, it, expect } from 'vitest';
import {
  getAnnotationBBox,
  getAnnotationDistance,
  detectHandleClick,
  getSvgRotationTransform,
  getAnnRotationTransform,
  doodleLinePoints,
  generateSmoothSpline,
  constructVariableWidthRibbon,
  findClosestSegmentIndex,
  getWidthAtParam,
} from '@plugins/retouch-metadata-studio/AnnotationCanvas/utils';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

describe('Annotation Select Tool & Utils', () => {
  it('computes accurate bounding boxes for bounded shapes and point annotations', () => {
    const rectAnn: Annotation = {
      id: 'rect-1',
      type: 'rect',
      color: '#ff0000',
      strokeWidth: 4,
      bounds: { x: 100, y: 150, w: 200, h: 100 },
    };

    const bbox = getAnnotationBBox(rectAnn);
    expect(bbox).toEqual({ x: 100, y: 150, w: 200, h: 100 });

    const lineAnn: Annotation = {
      id: 'line-1',
      type: 'line',
      color: '#00ff00',
      strokeWidth: 2,
      points: [
        { x: 50, y: 50 },
        { x: 250, y: 350 },
      ],
    };

    const lineBBox = getAnnotationBBox(lineAnn);
    expect(lineBBox).toEqual({ x: 50, y: 50, w: 200, h: 300 });
  });

  it('accurately hit-tests annotations including rotated shapes', () => {
    const rectAnn: Annotation = {
      id: 'rect-1',
      type: 'rect',
      color: '#ff0000',
      strokeWidth: 4,
      bounds: { x: 100, y: 100, w: 200, h: 100 }, // center (200, 150)
    };

    // Point inside unrotated rect
    expect(getAnnotationDistance({ x: 200, y: 150 }, rectAnn)).toBe(0);
    // Point outside unrotated rect
    expect(getAnnotationDistance({ x: 50, y: 50 }, rectAnn)).toBeGreaterThan(0);

    // Rotated 90 degrees around center (200, 150): width 100, height 200 => bounds in world are x in [150, 250], y in [50, 250]
    const rotatedRect: Annotation = {
      ...rectAnn,
      rotation: 90,
    };

    // (200, 60) is inside the rotated rectangle (top part)
    expect(getAnnotationDistance({ x: 200, y: 60 }, rotatedRect)).toBe(0);
    // (110, 150) is now outside because the 90-deg rotated width is only 100 (from 150 to 250)
    expect(getAnnotationDistance({ x: 110, y: 150 }, rotatedRect)).toBeGreaterThan(0);
  });

  it('detects endpoint handles for lines and arrows', () => {
    const arrowAnn: Annotation = {
      id: 'arrow-1',
      type: 'arrow',
      color: '#22c55e',
      strokeWidth: 3,
      points: [
        { x: 100, y: 100 },
        { x: 400, y: 400 },
      ],
    };

    // Clicking near start point
    expect(detectHandleClick(105, 98, arrowAnn)).toBe('ep0');
    // Clicking near end point
    expect(detectHandleClick(395, 402, arrowAnn)).toBe('ep1');
    // Clicking in middle of arrow
    expect(detectHandleClick(250, 250, arrowAnn)).toBeNull();
  });

  it('detects corner and edge handles for bounded shapes with rotation', () => {
    const rectAnn: Annotation = {
      id: 'rect-1',
      type: 'rect',
      color: '#22c55e',
      strokeWidth: 3,
      bounds: { x: 200, y: 200, w: 200, h: 200 }, // corners: tl(200,200), tr(400,200), bl(200,400), br(400,400)
    };

    expect(detectHandleClick(202, 198, rectAnn)).toBe('tl');
    expect(detectHandleClick(398, 202, rectAnn)).toBe('tr');
    expect(detectHandleClick(198, 402, rectAnn)).toBe('bl');
    expect(detectHandleClick(402, 398, rectAnn)).toBe('br');
    expect(detectHandleClick(200, 300, rectAnn)).toBe('lm');
    expect(detectHandleClick(400, 300, rectAnn)).toBe('rm');
    expect(detectHandleClick(300, 200, rectAnn)).toBe('tm');
    expect(detectHandleClick(300, 400, rectAnn)).toBe('bm');
  });

  it('generates aspect-corrected isotropic affine rotation transform matrices', () => {
    const matrix1 = getSvgRotationTransform(90, 500, 500, 1.0);
    expect(matrix1).toBeDefined();
    expect(matrix1).toContain('matrix');

    const matrixAspect16_9 = getSvgRotationTransform(45, 500, 500, 16 / 9);
    expect(matrixAspect16_9).toBeDefined();

    const ann: Annotation = {
      id: 'star-1',
      type: 'star',
      color: '#ffcc00',
      strokeWidth: 2,
      rotation: 30,
      bounds: { x: 300, y: 300, w: 200, h: 200 },
    };

    const annTransform = getAnnRotationTransform(ann, 1.5);
    expect(annTransform).toBeDefined();
    expect(annTransform).toContain('matrix');
  });

  it('generates doodle waves pinned to both endpoints', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 300, y: 0 };
    for (const style of ['wave', 'zigzag'] as const) {
      const pts = doodleLinePoints(p0, p1, style);
      expect(pts.length).toBeGreaterThan(2);
      expect(pts[0]).toEqual(p0);
      const last = pts[pts.length - 1];
      expect(last.x).toBeCloseTo(p1.x, 5);
      expect(last.y).toBeCloseTo(p1.y, 5);
      // Stays near the segment (bounded amplitude)
      for (const p of pts) {
        expect(Math.abs(p.y)).toBeLessThan(40);
        expect(p.x).toBeGreaterThanOrEqual(-1);
        expect(p.x).toBeLessThanOrEqual(301);
      }
    }
  });

  it('detects multiple endpoint and waypoint handles for curved lines', () => {
    const multiPointLine: Annotation = {
      id: 'multi-line-1',
      type: 'line',
      color: '#38bdf8',
      strokeWidth: 4,
      points: [
        { x: 100, y: 100 },
        { x: 250, y: 50 },
        { x: 400, y: 200 },
        { x: 600, y: 150 },
      ],
    };

    expect(detectHandleClick(102, 98, multiPointLine)).toBe('ep0');
    expect(detectHandleClick(248, 52, multiPointLine)).toBe('ep1');
    expect(detectHandleClick(401, 199, multiPointLine)).toBe('ep2');
    expect(detectHandleClick(598, 153, multiPointLine)).toBe('ep3');
    expect(detectHandleClick(300, 300, multiPointLine)).toBeNull();
  });

  it('finds closest segment index to insert new control points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];

    // Near first segment (0,0) -> (100,0)
    expect(findClosestSegmentIndex({ x: 50, y: 5 }, points)).toBe(0);
    // Near second segment (100,0) -> (100,100)
    expect(findClosestSegmentIndex({ x: 95, y: 60 }, points)).toBe(1);
  });

  it('generates smooth Catmull-Rom splines passing directly through control points', () => {
    const controlPoints = [
      { x: 50, y: 100 },
      { x: 150, y: 40 },
      { x: 300, y: 120 },
      { x: 450, y: 60 },
    ];

    const spine = generateSmoothSpline(controlPoints, 20);
    expect(spine.length).toBeGreaterThan(controlPoints.length);

    // Spine must begin at P0 and end at Pn
    expect(spine[0].x).toBeCloseTo(controlPoints[0].x, 1);
    expect(spine[0].y).toBeCloseTo(controlPoints[0].y, 1);
    const last = spine[spine.length - 1];
    expect(last.x).toBeCloseTo(controlPoints[controlPoints.length - 1].x, 1);
    expect(last.y).toBeCloseTo(controlPoints[controlPoints.length - 1].y, 1);
  });

  it('constructs closed variable-width ribbon polygons with hand-drawn calligraphic taper', () => {
    const spine = [
      { x: 100, y: 100 },
      { x: 200, y: 120 },
      { x: 300, y: 110 },
      { x: 400, y: 100 },
    ];

    const ribbon = constructVariableWidthRibbon(spine, 20, 'hand');
    expect(ribbon).toContain('M');
    expect(ribbon).toContain('Q'); // Rounded end caps
    expect(ribbon).toContain('Z'); // Closed polygon

    // Check taper profile values: thin start, body pressure swell, organic exit
    const wStart = getWidthAtParam(0.01, 20, 'hand');
    const wMid = getWidthAtParam(0.4, 20, 'hand');
    const wEnd = getWidthAtParam(0.95, 20, 'hand');

    expect(wStart).toBeLessThan(wMid); // Entry is thinner than body
    expect(wMid).toBeGreaterThan(12); // Swell body
    expect(wEnd).toBeLessThan(wMid); // Exit tapers down
  });
});

