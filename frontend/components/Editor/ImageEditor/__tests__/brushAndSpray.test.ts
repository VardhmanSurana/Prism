import { describe, it, expect } from 'vitest';
import {
  generateSprayDots,
  constructCalligraphyRibbon,
  getAnnotationBBox,
  partialEraseAnnotation,
} from '@plugins/retouch-metadata-studio/AnnotationCanvas/utils';
import { ALL_BRUSHES } from '@plugins/retouch-metadata-studio/AnnotationsPanel/BrushesPalette';
import {
  getChalkFilterValues,
  CHALK_PRESETS,
  getCrayonFilterValues,
  CRAYON_PRESETS,
  getDrybrushFilterValues,
  DRYBRUSH_PRESETS,
  getWatercolorFilterValues,
  WATERCOLOR_PRESETS,
  getCalligraphyNibValues,
  CALLIGRAPHY_PRESETS,
  getDashArrayString,
} from '@plugins/retouch-metadata-studio/AnnotationsPanel/brushUtils';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

describe('MS Paint Brushes & Spray Paint Engine', () => {
  describe('Brushes Catalog', () => {
    it('defines all 10 MS Paint-style brushes with names and default sizes', () => {
      expect(ALL_BRUSHES.length).toBe(10);
      const brushIds = ALL_BRUSHES.map(b => b.id);
      expect(brushIds).toContain('brush');
      expect(brushIds).toContain('spray');
      expect(brushIds).toContain('calligraphy1');
      expect(brushIds).toContain('calligraphy2');
      expect(brushIds).toContain('oil');
      expect(brushIds).toContain('crayon');
      expect(brushIds).toContain('chalk');
      expect(brushIds).toContain('drybrush');
      expect(brushIds).toContain('watercolor');
      expect(brushIds).toContain('pen');
    });

    it('sets sensible default sizes for paint brush and spray paint', () => {
      const spray = ALL_BRUSHES.find(b => b.id === 'spray')!;
      const brush = ALL_BRUSHES.find(b => b.id === 'brush')!;
      const pen = ALL_BRUSHES.find(b => b.id === 'pen')!;

      expect(spray.defaultSize).toBeGreaterThanOrEqual(20);
      expect(brush.defaultSize).toBeGreaterThanOrEqual(6);
      expect(pen.defaultSize).toBeLessThanOrEqual(4);
    });

    it('defines short names for compact UI display on all brushes', () => {
      for (const b of ALL_BRUSHES) {
        expect(b.shortName).toBeDefined();
        expect(b.shortName.length).toBeGreaterThan(0);
        expect(b.shortName.length).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('generateSprayDots', () => {
    it('generates the specified count of droplets within the circular radius', () => {
      const cx = 500;
      const cy = 500;
      const radius = 30;
      const count = 15;

      const dots = generateSprayDots(cx, cy, radius, count);
      expect(dots.length).toBe(count);

      for (const d of dots) {
        expect(d).toHaveProperty('x');
        expect(d).toHaveProperty('y');
        expect(d).toHaveProperty('r');
        expect(d.r).toBeGreaterThan(0);

        // Distance from center must be <= radius + small tolerance
        const dist = Math.hypot(d.x - cx, d.y - cy);
        expect(dist).toBeLessThanOrEqual(radius + 0.1);
      }
    });

    it('enforces a safe minimum radius', () => {
      const dots = generateSprayDots(100, 100, 1, 5);
      expect(dots.length).toBe(5);
    });
  });

  describe('constructCalligraphyRibbon', () => {
    it('returns empty string for single point or empty points', () => {
      expect(constructCalligraphyRibbon([], 10, 45)).toBe('');
      expect(constructCalligraphyRibbon([{ x: 10, y: 10 }], 10, 45)).toBe('');
    });

    it('constructs a closed polygon ribbon for 2 or more points at 45 degrees', () => {
      const pts = [
        { x: 100, y: 100 },
        { x: 100, y: 200 },
        { x: 200, y: 200 },
      ];
      const ribbon = constructCalligraphyRibbon(pts, 12, 45);
      expect(ribbon.startsWith('M ')).toBe(true);
      expect(ribbon.endsWith(' Z')).toBe(true);
      expect(ribbon).toContain(' L ');
    });

    it('constructs a closed polygon ribbon for -45 degrees (Calligraphy 2)', () => {
      const pts = [
        { x: 50, y: 50 },
        { x: 150, y: 150 },
      ];
      const ribbon = constructCalligraphyRibbon(pts, 8, -45);
      expect(ribbon.startsWith('M ')).toBe(true);
      expect(ribbon.endsWith(' Z')).toBe(true);
    });
  });

  describe('getAnnotationBBox with sprayDots', () => {
    it('calculates bounding box encompassing all spray droplets', () => {
      const ann: Annotation = {
        id: 'spray-1',
        type: 'freehand',
        brushType: 'spray',
        color: '#ff0000',
        strokeWidth: 20,
        sprayDots: [
          { x: 200, y: 300, r: 2 },
          { x: 250, y: 350, r: 3 },
          { x: 180, y: 280, r: 1 },
        ],
      };

      const bbox = getAnnotationBBox(ann);
      // Min X is 180 - 1 = 179, Max X is 250 + 3 = 253
      // Min Y is 280 - 1 = 279, Max Y is 350 + 3 = 353
      expect(bbox.x).toBeCloseTo(179, 1);
      expect(bbox.y).toBeCloseTo(279, 1);
      expect(bbox.w).toBeCloseTo(253 - 179, 1);
      expect(bbox.h).toBeCloseTo(353 - 279, 1);
    });
  });

  describe('partialEraseAnnotation with sprayDots', () => {
    it('removes droplets within eraser radius and preserves external droplets', () => {
      const ann: Annotation = {
        id: 'spray-erase-test',
        type: 'freehand',
        brushType: 'spray',
        color: '#00ff00',
        strokeWidth: 20,
        sprayDots: [
          { x: 100, y: 100, r: 2 }, // Inside eraser at (100, 100) with r=20
          { x: 105, y: 105, r: 1 }, // Inside eraser
          { x: 500, y: 500, r: 2 }, // Outside eraser
        ],
      };

      const result = partialEraseAnnotation(ann, { x: 100, y: 100 }, 20, 1);
      expect(result.length).toBe(1);
      expect(result[0].sprayDots).toBeDefined();
      expect(result[0].sprayDots?.length).toBe(1);
      expect(result[0].sprayDots?.[0].x).toBe(500);
      expect(result[0].sprayDots?.[0].y).toBe(500);
    });

    it('completely deletes annotation if all droplets are erased', () => {
      const ann: Annotation = {
        id: 'spray-all-erased',
        type: 'freehand',
        brushType: 'spray',
        color: '#00ff00',
        strokeWidth: 20,
        sprayDots: [
          { x: 100, y: 100, r: 2 },
          { x: 102, y: 102, r: 1 },
        ],
      };

      const result = partialEraseAnnotation(ann, { x: 100, y: 100 }, 25, 1);
      expect(result.length).toBe(0);
    });

    it('returns unchanged if no droplets intersect eraser', () => {
      const ann: Annotation = {
        id: 'spray-none-erased',
        type: 'freehand',
        brushType: 'spray',
        color: '#00ff00',
        strokeWidth: 20,
        sprayDots: [{ x: 500, y: 500, r: 2 }],
      };

      const result = partialEraseAnnotation(ann, { x: 100, y: 100 }, 20, 1);
      expect(result.length).toBe(1);
      expect(result[0].sprayDots?.length).toBe(1);
    });
  });

  describe('Chalk Texture Variable Controls', () => {
    it('produces exact default parameters matching standard chalk filter', () => {
      const defaults = getChalkFilterValues();
      expect(defaults.offset).toBe('-0.22');
      expect(defaults.baseFreq).toBe('0.68');
      expect(defaults.scale).toBe(4.2);
    });

    it('computes expected min and max ranges for pressure, grain, and roughness', () => {
      const minVals = getChalkFilterValues(0, 0, 0);
      expect(minVals.offset).toBe('-0.52');
      expect(minVals.baseFreq).toBe('0.34');
      expect(minVals.scale).toBe(0);

      const maxVals = getChalkFilterValues(100, 100, 100);
      expect(maxVals.offset).toBe('-0.02');
      expect(maxVals.baseFreq).toBe('1.02');
      expect(maxVals.scale).toBe(8.4);
    });

    it('provides standard chalk presets with valid ranges', () => {
      expect(CHALK_PRESETS.length).toBeGreaterThanOrEqual(3);
      const names = CHALK_PRESETS.map(p => p.name);
      expect(names).toContain('Soft Dust');
      expect(names).toContain('Blackboard');
      expect(names).toContain('Sidewalk');

      for (const preset of CHALK_PRESETS) {
        expect(preset.pressure).toBeGreaterThanOrEqual(0);
        expect(preset.pressure).toBeLessThanOrEqual(100);
        expect(preset.grain).toBeGreaterThanOrEqual(0);
        expect(preset.grain).toBeLessThanOrEqual(100);
        expect(preset.roughness).toBeGreaterThanOrEqual(0);
        expect(preset.roughness).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Crayon Texture Variable Controls', () => {
    it('produces default parameters matching standard crayon filter', () => {
      const defaults = getCrayonFilterValues();
      expect(defaults.offset).toBe('-0.35');
      expect(defaults.baseFreq).toBe('0.45');
      expect(defaults.scale).toBe(5.5);
    });

    it('computes expected min and max ranges for crayon parameters', () => {
      const minVals = getCrayonFilterValues(0, 0, 0);
      expect(minVals.offset).toBe('-0.55');
      expect(minVals.baseFreq).toBe('0.25');
      expect(minVals.scale).toBe(0);

      const maxVals = getCrayonFilterValues(100, 100, 100);
      expect(maxVals.offset).toBe('-0.15');
      expect(maxVals.baseFreq).toBe('0.65');
      expect(maxVals.scale).toBe(11.0);
    });

    it('provides standard crayon presets', () => {
      expect(CRAYON_PRESETS.length).toBeGreaterThanOrEqual(3);
      const names = CRAYON_PRESETS.map(p => p.name);
      expect(names).toContain('Heavy Wax');
      expect(names).toContain('Classic Crayon');
      expect(names).toContain('Gritty Rubbing');
    });
  });

  describe('Drybrush & Oil Texture Variable Controls', () => {
    it('produces default parameters matching standard drybrush filter', () => {
      const defaults = getDrybrushFilterValues();
      expect(defaults.offset).toBe('-0.28');
      expect(defaults.baseFreq).toBe('0.82 0.08');
      expect(defaults.scale).toBe(3.0);
    });

    it('computes expected min and max ranges for drybrush parameters', () => {
      const minVals = getDrybrushFilterValues(0, 0, 0);
      expect(minVals.offset).toBe('-0.48');
      expect(minVals.baseFreq).toBe('0.52 0.04');
      expect(minVals.scale).toBe(0);

      const maxVals = getDrybrushFilterValues(100, 100, 100);
      expect(maxVals.offset).toBe('-0.08');
      expect(maxVals.baseFreq).toBe('1.12 0.12');
      expect(maxVals.scale).toBe(6.0);
    });

    it('provides standard drybrush & oil presets', () => {
      expect(DRYBRUSH_PRESETS.length).toBeGreaterThanOrEqual(3);
      const names = DRYBRUSH_PRESETS.map(p => p.name);
      expect(names).toContain('Rich Impasto');
      expect(names).toContain('Bristle Drag');
      expect(names).toContain('Dry Scratch');
    });
  });

  describe('Watercolor Texture Variable Controls', () => {
    it('produces default parameters matching standard watercolor filter', () => {
      const defaults = getWatercolorFilterValues();
      expect(defaults.stdDeviation).toBe('0.8');
      expect(defaults.scale).toBe(2.5);
      expect(defaults.opacity).toBe(0.45);
    });

    it('computes expected min and max ranges for watercolor parameters', () => {
      const minVals = getWatercolorFilterValues(0, 0, 0);
      expect(minVals.stdDeviation).toBe('0.2');
      expect(minVals.scale).toBe(0.5);
      expect(minVals.opacity).toBe(0.25);

      const maxVals = getWatercolorFilterValues(100, 100, 100);
      expect(maxVals.stdDeviation).toBe('1.4');
      expect(maxVals.scale).toBe(4.5);
      expect(maxVals.opacity).toBe(0.65);
    });

    it('provides standard watercolor presets', () => {
      expect(WATERCOLOR_PRESETS.length).toBeGreaterThanOrEqual(3);
      const names = WATERCOLOR_PRESETS.map(p => p.name);
      expect(names).toContain('Light Glaze');
      expect(names).toContain('Wet-on-Dry');
      expect(names).toContain('Wet-on-Wet');
    });
  });

  describe('Calligraphy Nib Controls & Dash Dynamics', () => {
    it('computes standard nib weight ratio and angles', () => {
      const defNib = getCalligraphyNibValues(45, 50);
      expect(defNib.angle).toBe(45);
      expect(defNib.weightRatio).toBe(0.75);

      const italicNib = getCalligraphyNibValues(-45, 80);
      expect(italicNib.angle).toBe(-45);
      expect(italicNib.weightRatio).toBe(0.9);
    });

    it('provides standard calligraphy presets', () => {
      expect(CALLIGRAPHY_PRESETS.length).toBeGreaterThanOrEqual(4);
      const names = CALLIGRAPHY_PRESETS.map(p => p.name);
      expect(names).toContain('Italic 45°');
      expect(names).toContain('Left Hand -45°');
      expect(names).toContain('Broad Edge 0°');
    });

    it('formats dynamic dash and dot arrays correctly', () => {
      expect(getDashArrayString(10, 'solid')).toBeUndefined();
      expect(getDashArrayString(10, 'dashed', 5, 4)).toBe('25 20');
      expect(getDashArrayString(10, 'dotted', 5, 4)).toBe('0.1 16');
    });
  });
});

