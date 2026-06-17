import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Point,
  splineToSvgPath,
} from './spline';
import { CurveState, DEFAULT_CURVE } from './curves';

// Re-export Point so consumers can import it from here if needed
export type { Point } from './spline';
export type { CurveState } from './curves';
export { DEFAULT_CURVE } from './curves';

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

  const rafRef = useRef<number | undefined>(undefined);

  // Helper to map mouse client coordinates to SVG coordinate system with float precision
  const getCoordinates = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_SIZE / rect.width;
    const scaleY = SVG_SIZE / rect.height;
    
    // We flip Y because SVG (0,0) is top-left, but curves usually have (0,0) at bottom-left
    let x = (clientX - rect.left) * scaleX - MARGIN;
    let y = CANVAS_SIZE - ((clientY - rect.top) * scaleY - MARGIN);

    // Only clamp, don't round (allows sub-pixel precision)
    x = Math.max(0.0, Math.min(CANVAS_SIZE, x));
    y = Math.max(0.0, Math.min(CANVAS_SIZE, y));
    
    return { x, y };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragInfo({ index: idx, channel: activeChannel });
  }, [activeChannel]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragInfo) return;
    
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const { x, y } = getCoordinates(clientX, clientY);
      const { index, channel } = dragInfo;
      const pts = [...value[channel]];

      // Restrict movement based on neighbors with sub-pixel precision (0.1px step)
      if (index === 0) {
        // First point: lock X to 0
        pts[index] = { x: 0.0, y };
      } else if (index === pts.length - 1) {
        // Last point: lock X to 255
        pts[index] = { x: CANVAS_SIZE, y };
      } else {
        // Middle points: constrain X between neighbors
        const minX = pts[index - 1].x + 0.1;
        const maxX = pts[index + 1].x - 0.1;
        pts[index] = { x: Math.max(minX, Math.min(maxX, x)), y };
      }

      onChange({ ...value, [channel]: pts });
    });
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
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [dragInfo, handlePointerMove, handlePointerUp]);

  const handleSvgClick = useCallback((e: React.PointerEvent) => {
    if (dragInfo) return;
    const { x, y } = getCoordinates(e.clientX, e.clientY);
    
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
        className="transition-all duration-75 ease-out"
        style={{ pointerEvents: 'none' }}
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
