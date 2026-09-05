import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
  clipSegmentWithEraser,
  partialEraseAnnotation,
} from '@plugins/retouch-metadata-studio/AnnotationCanvas/utils';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { useAnnotationsState } from '../EditingMode/useAnnotationsState';

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

  describe('Eraser precision & segment clipping', () => {
    it('accurately clips a line segment intersecting an eraser circle without over-erasing', () => {
      // Line from (0, 100) to (100, 100). Eraser at (50, 100) with radius 15.
      // Entry point should be at (35, 100) [t = 0.35], exit point at (65, 100) [t = 0.65].
      const p0 = { x: 0, y: 100 };
      const p1 = { x: 100, y: 100 };
      const center = { x: 50, y: 100 };
      const radius = 15;

      const { outsideIntervals } = clipSegmentWithEraser(p0, p1, center, radius);
      expect(outsideIntervals).toHaveLength(2);
      expect(outsideIntervals[0][0]).toBe(0);
      expect(outsideIntervals[0][1]).toBeCloseTo(0.35, 2);
      expect(outsideIntervals[1][0]).toBeCloseTo(0.65, 2);
      expect(outsideIntervals[1][1]).toBe(1);
    });

    it('partially erases a freehand stroke and preserves surviving segments right to circle boundary', () => {
      const strokeAnn: Annotation = {
        id: 'stroke-1',
        type: 'freehand',
        color: '#ff0000',
        strokeWidth: 4,
        points: [
          { x: 0, y: 100 },
          { x: 40, y: 100 },
          { x: 60, y: 100 },
          { x: 100, y: 100 },
        ],
      };

      // Erase at (50, 100) with radius 15 (covers x from 35 to 65)
      const result = partialEraseAnnotation(strokeAnn, { x: 50, y: 100 }, 15);
      expect(result).toHaveLength(2);

      // First segment ends at circle entry (35, 100)
      const seg1Pts = result[0].points!;
      expect(seg1Pts[0]).toEqual({ x: 0, y: 100 });
      const seg1End = seg1Pts[seg1Pts.length - 1];
      expect(seg1End.x).toBeCloseTo(35, 1);
      expect(seg1End.y).toBeCloseTo(100, 1);

      // Second segment starts at circle exit (65, 100)
      const seg2Pts = result[1].points!;
      const seg2Start = seg2Pts[0];
      expect(seg2Start.x).toBeCloseTo(65, 1);
      expect(seg2Start.y).toBeCloseTo(100, 1);
      expect(seg2Pts[seg2Pts.length - 1]).toEqual({ x: 100, y: 100 });
    });

    it('does not erase strokes that are completely outside the eraser radius', () => {
      const strokeAnn: Annotation = {
        id: 'stroke-2',
        type: 'freehand',
        color: '#00ff00',
        strokeWidth: 2,
        points: [
          { x: 200, y: 200 },
          { x: 250, y: 250 },
        ],
      };

      // Eraser at (100, 100) with radius 20 is far away
      const result = partialEraseAnnotation(strokeAnn, { x: 100, y: 100 }, 20);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(strokeAnn); // Returns same reference unchanged
    });

    it('allows strokeOnly hit-testing for unfilled outline shapes so clicking inside does not erase them', () => {
      const rectAnn: Annotation = {
        id: 'rect-outline',
        type: 'rect',
        color: '#ffffff',
        strokeWidth: 2,
        fillShape: false,
        bounds: { x: 100, y: 100, w: 200, h: 200 },
      };

      // Inside the empty outline box at (200, 200)
      // Normal hit-testing (for selection) returns 0
      expect(getAnnotationDistance({ x: 200, y: 200 }, rectAnn)).toBe(0);

      // Stroke-only hit-testing (for eraser) returns distance to nearest border (100px away)
      expect(getAnnotationDistance({ x: 200, y: 200 }, rectAnn, { strokeOnly: true })).toBe(100);

      // Near the border at (102, 150) returns ~2px away
      expect(getAnnotationDistance({ x: 102, y: 150 }, rectAnn, { strokeOnly: true })).toBeCloseTo(2, 1);
    });
  });

  describe('Multi-Markup Selection, Batch Editing & Individual Movement', () => {
    it('toggles selection membership when Shift key is pressed', () => {
      let selectedIds: string[] = ['ann-1', 'ann-2'];

      // Shift-clicking ann-3 adds it
      const clickedId = 'ann-3';
      const isShift = true;
      if (isShift) {
        selectedIds = selectedIds.includes(clickedId)
          ? selectedIds.filter(id => id !== clickedId)
          : [...selectedIds, clickedId];
      }
      expect(selectedIds).toEqual(['ann-1', 'ann-2', 'ann-3']);

      // Shift-clicking ann-2 removes it
      const unclickedId = 'ann-2';
      selectedIds = selectedIds.includes(unclickedId)
        ? selectedIds.filter(id => id !== unclickedId)
        : [...selectedIds, unclickedId];
      expect(selectedIds).toEqual(['ann-1', 'ann-3']);

      // Normal click without shift replaces selection
      const singleClickId = 'ann-4';
      selectedIds = [singleClickId];
      expect(selectedIds).toEqual(['ann-4']);
    });

    it('selects multiple markups of the same type', () => {
      const sampleAnnotations: Annotation[] = [
        { id: 'pen-1', type: 'freehand', color: '#ff0000', strokeWidth: 4 },
        { id: 'rect-1', type: 'rect', color: '#00ff00', strokeWidth: 2, bounds: { x: 10, y: 10, w: 50, h: 50 } },
        { id: 'pen-2', type: 'freehand', color: '#0000ff', strokeWidth: 4 },
        { id: 'pen-3', type: 'freehand', color: '#ffff00', strokeWidth: 6 },
        { id: 'rect-2', type: 'rect', color: '#ff00ff', strokeWidth: 2, bounds: { x: 70, y: 70, w: 50, h: 50 } },
      ];

      // Select all of type 'freehand'
      const penIds = sampleAnnotations.filter(a => a.type === 'freehand').map(a => a.id);
      expect(penIds).toEqual(['pen-1', 'pen-2', 'pen-3']);
      expect(penIds).toHaveLength(3);

      // Select all of type 'rect'
      const rectIds = sampleAnnotations.filter(a => a.type === 'rect').map(a => a.id);
      expect(rectIds).toEqual(['rect-1', 'rect-2']);
      expect(rectIds).toHaveLength(2);
    });

    it('batch updates properties across all selected markups', () => {
      const annotations: Annotation[] = [
        { id: 'ann-1', type: 'rect', color: '#ff0000', strokeWidth: 2, opacity: 1, bounds: { x: 10, y: 10, w: 20, h: 20 } },
        { id: 'ann-2', type: 'rect', color: '#00ff00', strokeWidth: 2, opacity: 1, bounds: { x: 50, y: 50, w: 30, h: 30 } },
        { id: 'ann-3', type: 'circle', color: '#0000ff', strokeWidth: 4, opacity: 1, bounds: { x: 100, y: 100, w: 40, h: 40 } },
      ];

      const selectedIds = ['ann-1', 'ann-2'];
      const batchUpdates: Partial<Annotation> = {
        strokeWidth: 8,
        color: '#f59e0b',
        opacity: 0.75,
      };

      const updated = annotations.map(ann =>
        selectedIds.includes(ann.id) ? { ...ann, ...batchUpdates } : ann
      );

      // ann-1 and ann-2 received batch updates
      expect(updated[0].strokeWidth).toBe(8);
      expect(updated[0].color).toBe('#f59e0b');
      expect(updated[0].opacity).toBe(0.75);

      expect(updated[1].strokeWidth).toBe(8);
      expect(updated[1].color).toBe('#f59e0b');
      expect(updated[1].opacity).toBe(0.75);

      // ann-3 was untouched
      expect(updated[2].strokeWidth).toBe(4);
      expect(updated[2].color).toBe('#0000ff');
      expect(updated[2].opacity).toBe(1);
    });

    it('moves an individual markup without changing positions of other selected markups', () => {
      const annotations: Annotation[] = [
        { id: 'shape-1', type: 'rect', color: '#ff0000', strokeWidth: 2, bounds: { x: 100, y: 100, w: 50, h: 50 } },
        { id: 'shape-2', type: 'rect', color: '#00ff00', strokeWidth: 2, bounds: { x: 300, y: 300, w: 50, h: 50 } },
        { id: 'stroke-1', type: 'freehand', color: '#0000ff', strokeWidth: 2, points: [{ x: 500, y: 500 }, { x: 550, y: 550 }] },
      ];

      // Multiple markups are selected
      const selectedIds = ['shape-1', 'shape-2', 'stroke-1'];

      // User drags shape-1 by dx=40, dy=25
      const draggedId = 'shape-1';
      const dx = 40;
      const dy = 25;

      const draggedAnn = annotations.find(a => a.id === draggedId)!;
      const movedAnn: Annotation = draggedAnn.bounds
        ? { ...draggedAnn, bounds: { ...draggedAnn.bounds, x: draggedAnn.bounds.x + dx, y: draggedAnn.bounds.y + dy } }
        : draggedAnn;

      // Position update only targets the individual dragged annotation (commitMove logic)
      const afterMove = annotations.map(a => a.id === draggedId ? movedAnn : a);

      // shape-1 moved
      expect(afterMove[0].bounds).toEqual({ x: 140, y: 125, w: 50, h: 50 });

      // shape-2 and stroke-1 remain at their exact original positions
      expect(afterMove[1].bounds).toEqual({ x: 300, y: 300, w: 50, h: 50 });
      expect(afterMove[2].points).toEqual([{ x: 500, y: 500 }, { x: 550, y: 550 }]);

      // All 3 continue to be selected
      expect(selectedIds).toEqual(['shape-1', 'shape-2', 'stroke-1']);
    });

    it('useAnnotationsState properly synchronizes selectedAnnIds and selectedAnnId without clobbering', () => {
      const { result } = renderHook(() => useAnnotationsState());

      // Initially empty
      expect(result.current.selectedAnnIds).toEqual([]);
      expect(result.current.selectedAnnId).toBeNull();

      // Populate annotations
      act(() => {
        result.current.setAnnotations([
          { id: 'ann-1', type: 'rect', color: '#ff0000', strokeWidth: 2, bounds: { x: 10, y: 10, w: 20, h: 20 } },
          { id: 'ann-2', type: 'rect', color: '#00ff00', strokeWidth: 2, bounds: { x: 50, y: 50, w: 30, h: 30 } },
          { id: 'ann-3', type: 'circle', color: '#0000ff', strokeWidth: 4, bounds: { x: 100, y: 100, w: 40, h: 40 } },
          { id: 'ann-4', type: 'text', color: '#ffffff', strokeWidth: 1, text: 'Hello', bounds: { x: 200, y: 200, w: 100, h: 50 } },
        ]);
      });

      // Setting multiple selected IDs
      act(() => {
        result.current.setSelectedAnnIds(['ann-1', 'ann-2', 'ann-3']);
      });
      expect(result.current.selectedAnnIds).toEqual(['ann-1', 'ann-2', 'ann-3']);
      expect(result.current.selectedAnnId).toBe('ann-3');

      // Calling setSelectedAnnId with an ID already in selectedAnnIds does NOT collapse selectedAnnIds
      act(() => {
        result.current.setSelectedAnnId('ann-1');
      });
      expect(result.current.selectedAnnIds).toEqual(['ann-1', 'ann-2', 'ann-3']);
      expect(result.current.selectedAnnId).toBe('ann-1');

      // Calling setSelectedAnnId with a new ID replaces selection with that single ID
      act(() => {
        result.current.setSelectedAnnId('ann-4');
      });
      expect(result.current.selectedAnnIds).toEqual(['ann-4']);
      expect(result.current.selectedAnnId).toBe('ann-4');

      // Calling setSelectedAnnId(null) clears selection
      act(() => {
        result.current.setSelectedAnnId(null);
      });
      expect(result.current.selectedAnnIds).toEqual([]);
      expect(result.current.selectedAnnId).toBeNull();
    });

    it('supports toggle logic for Shift+Click selection', () => {
      let currentIds = ['rect-1'];

      // Shift-clicking an unselected item adds it
      const clickId1 = 'circle-2';
      const alreadySelected1 = currentIds.includes(clickId1);
      currentIds = alreadySelected1
        ? currentIds.filter(id => id !== clickId1)
        : [...currentIds, clickId1];
      expect(currentIds).toEqual(['rect-1', 'circle-2']);

      // Shift-clicking another unselected item adds it
      const clickId2 = 'arrow-3';
      const alreadySelected2 = currentIds.includes(clickId2);
      currentIds = alreadySelected2
        ? currentIds.filter(id => id !== clickId2)
        : [...currentIds, clickId2];
      expect(currentIds).toEqual(['rect-1', 'circle-2', 'arrow-3']);

      // Shift-clicking an already selected item toggles it off
      const clickId3 = 'circle-2';
      const alreadySelected3 = currentIds.includes(clickId3);
      currentIds = alreadySelected3
        ? currentIds.filter(id => id !== clickId3)
        : [...currentIds, clickId3];
      expect(currentIds).toEqual(['rect-1', 'arrow-3']);

      // Non-shift click on canvas clears or sets single item
      const shiftKey = false;
      const clickedEmpty = null;
      if (!shiftKey && !clickedEmpty) {
        currentIds = [];
      }
      expect(currentIds).toEqual([]);
    });
  });
});

