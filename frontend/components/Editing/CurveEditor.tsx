import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Point,
  createMonotoneCubicSpline,
  generateLUT,
  compositeLUTs,
  splineToSvgPath,
} from './spline';

// Re-export Point so consumers can import it from here if needed
export type { Point } from './spline';

// Curve State

export type CurveState = {
  master: Point[];
  red:    Point[];
  green:  Point[];
  blue:   Point[];
};

export const DEFAULT_CURVE: CurveState = {
  master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red:    [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green:  [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
};

/**
 * Compute the SVG `feFuncR/G/B` `tableValues` strings for the active curve set.
 * Composites each channel LUT over the master LUT. Returns identity strings
 * ('0 1') for the default curve to avoid needless filter work.
 */
export function getCurvesTableValues(curves: CurveState): { r: string, g: string, b: string } {
  if (curves === DEFAULT_CURVE) {
    return { r: '0 1', g: '0 1', b: '0 1' };
  }

  const scalePoints = (pts: Point[]) => pts.map(p => ({ x: p.x / 255, y: p.y / 255 }));

  const masterFn = createMonotoneCubicSpline(scalePoints(curves.master));
  const rFn      = createMonotoneCubicSpline(scalePoints(curves.red));
  const gFn      = createMonotoneCubicSpline(scalePoints(curves.green));
  const bFn      = createMonotoneCubicSpline(scalePoints(curves.blue));

  const masterLut = generateLUT(masterFn, 8);
  const rLut      = generateLUT(rFn, 8);
  const gLut      = generateLUT(gFn, 8);
  const bLut      = generateLUT(bFn, 8);

  const finalR = compositeLUTs(rLut, masterLut);
  const finalG = compositeLUTs(gLut, masterLut);
  const finalB = compositeLUTs(bLut, masterLut);

  return {
    r: finalR.map(v => v.toFixed(4)).join(' '),
    g: finalG.map(v => v.toFixed(4)).join(' '),
    b: finalB.map(v => v.toFixed(4)).join(' '),
  };
}

interface CurveEditorProps {
  value: CurveState;
  onChange: (value: CurveState) => void;
}

type Channel = 'master' | 'red' | 'green' | 'blue';

const CANVAS_SIZE = 255;
const MARGIN = 10;
const SVG_SIZE = CANVAS_SIZE + MARGIN * 2;
const HIT_RADIUS = 15;

const channelColors = {
  master: '#ffffff',
  red:    '#ff4444',
  green:  '#44ff44',
  blue:   '#4444ff',
};

export const CurveEditor: React.FC<CurveEditorProps> = ({ value, onChange }) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('master');
  const svgRef = useRef<SVGSVGElement>(null);

  const [dragInfo, setDragInfo] = useState<{
    index: number;
    channel: Channel;
  } | null>(null);

  // Helper to map mouse event to SVG coordinate system
  const getCoordinates = (e: React.PointerEvent | PointerEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_SIZE / rect.width;
    const scaleY = SVG_SIZE / rect.height;
    
    // We flip Y because SVG (0,0) is top-left, but curves usually have (0,0) at bottom-left
    let x = (e.clientX - rect.left) * scaleX - MARGIN;
    let y = CANVAS_SIZE - ((e.clientY - rect.top) * scaleY - MARGIN);

    // Clamp to valid area
    x = Math.max(0, Math.min(CANVAS_SIZE, x));
    y = Math.max(0, Math.min(CANVAS_SIZE, y));
    
    return { x, y };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragInfo({ index: idx, channel: activeChannel });
  }, [activeChannel]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragInfo) return;
    
    const { x, y } = getCoordinates(e);
    const { index, channel } = dragInfo;
    const pts = [...value[channel]];

    // Restrict movement based on neighbors
    if (index === 0) {
      // First point: lock X to 0
      pts[index] = { x: 0, y };
    } else if (index === pts.length - 1) {
      // Last point: lock X to 255
      pts[index] = { x: CANVAS_SIZE, y };
    } else {
      // Middle points: constrain X between neighbors
      const minX = pts[index - 1].x + 1;
      const maxX = pts[index + 1].x - 1;
      pts[index] = { x: Math.max(minX, Math.min(maxX, x)), y };
    }

    onChange({ ...value, [channel]: pts });
  }, [dragInfo, value, onChange]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (dragInfo) {
      setDragInfo(null);
    }
  }, [dragInfo]);

  useEffect(() => {
    if (dragInfo) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [dragInfo, handlePointerMove, handlePointerUp]);

  const handleSvgClick = useCallback((e: React.PointerEvent) => {
    if (dragInfo) return;
    const { x, y } = getCoordinates(e);
    
    const pts = [...value[activeChannel]];
    // Find where to insert
    let insertIdx = 1;
    while (insertIdx < pts.length && pts[insertIdx].x < x) {
      insertIdx++;
    }
    
    // Prevent points too close to each other
    if (Math.abs(pts[insertIdx - 1].x - x) < 5) return;
    if (insertIdx < pts.length && Math.abs(pts[insertIdx].x - x) < 5) return;

    pts.splice(insertIdx, 0, { x, y });
    onChange({ ...value, [activeChannel]: pts });
  }, [dragInfo, value, activeChannel, onChange]);

  const handleDoubleClickPoint = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    // Don't allow deleting the end points
    if (idx === 0 || idx === value[activeChannel].length - 1) {
      // Reset endpoint Y instead
      const pts = [...value[activeChannel]];
      pts[idx] = { x: pts[idx].x, y: idx === 0 ? 0 : CANVAS_SIZE };
      onChange({ ...value, [activeChannel]: pts });
      return;
    }
    
    const pts = [...value[activeChannel]];
    pts.splice(idx, 1);
    onChange({ ...value, [activeChannel]: pts });
  }, [value, activeChannel, onChange]);

  const channels: Channel[] = ['master', 'red', 'green', 'blue'];

  // Helper to map internal bottom-left (0,0) to SVG top-left (0,0) with margins
  const mapSvgY = (y: number) => CANVAS_SIZE - y + MARGIN;
  const mapSvgX = (x: number) => x + MARGIN;

  const renderCurvePath = (channel: Channel, strokeWidth: number, opacity: number) => {
    const pts = value[channel];
    // We map the points directly to SVG coordinates to draw them
    const mappedPts = pts.map(p => ({ x: mapSvgX(p.x), y: mapSvgY(p.y) }));
    const d = splineToSvgPath(mappedPts, 100);
    return (
      <path
        d={d}
        fill="none"
        stroke={channelColors[channel]}
        strokeWidth={strokeWidth}
        opacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Channel Tabs */}
      <div className="flex bg-white/5 rounded-lg p-1 gap-1">
        {channels.map(ch => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-md transition-colors ${
              activeChannel === ch
                ? 'bg-[#1a1a1a] text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {ch === 'master' ? 'RGB' : ch.charAt(0)}
          </button>
        ))}
      </div>

      {/* Graph Area */}
      <div className="bg-[#111] rounded-xl overflow-hidden border border-white/10 select-none touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="w-full h-auto cursor-crosshair"
          onPointerDown={handleSvgClick}
        >
          {/* Grid */}
          {[1, 2, 3].map(i => {
            const pos = MARGIN + (CANVAS_SIZE / 4) * i;
            return (
              <React.Fragment key={i}>
                <line x1={pos} y1={MARGIN} x2={pos} y2={MARGIN + CANVAS_SIZE} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                <line x1={MARGIN} y1={pos} x2={MARGIN + CANVAS_SIZE} y2={pos} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
              </React.Fragment>
            );
          })}
          
          {/* Background curves */}
          {channels.filter(ch => ch !== activeChannel).map(ch => (
            <React.Fragment key={ch}>
              {renderCurvePath(ch, 1.5, ch === 'master' ? 0.3 : 0.5)}
            </React.Fragment>
          ))}

          {/* Active curve */}
          {renderCurvePath(activeChannel, 2, 1)}

          {/* Active points */}
          {value[activeChannel].map((p, i) => (
            <g
              key={i}
              transform={`translate(${mapSvgX(p.x)}, ${mapSvgY(p.y)})`}
              onPointerDown={(e) => handlePointerDown(e, i)}
              onDoubleClick={(e) => handleDoubleClickPoint(e, i)}
              className="cursor-move"
            >
              <circle r={HIT_RADIUS} fill="transparent" />
              <rect x="-3" y="-3" width="6" height="6" fill={channelColors[activeChannel]} />
            </g>
          ))}
        </svg>
      </div>
      
      <p className="text-[10px] text-white/30 text-center leading-relaxed">
        Click to add a point. Drag to adjust.<br/>Double-click a point to remove it.
      </p>
    </div>
  );
};
