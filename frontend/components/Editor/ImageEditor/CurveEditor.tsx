import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Point,
  splineToSvgPath,
} from './spline';
import { computeHistogram } from './Histogram';

// Re-export Point so consumers can import it from here if needed
export type { Point } from './spline';
export type { CurveState } from './curves';
export { DEFAULT_CURVE } from './curves';

import { CurveState, SpecializedCurvesState, SpecializedCurveKind, DEFAULT_SPECIALIZED_CURVE_POINTS } from './curves';

interface CurveEditorProps {
  value: CurveState;
  onChange: (value: CurveState) => void;
  specializedValue?: SpecializedCurvesState;
  onSpecializedChange?: (value: SpecializedCurvesState) => void;
  imageSrc?: string;
  filterString?: string;
}

type Channel = 'master' | 'red' | 'green' | 'blue';
type CurveCategory = 'rgb' | 'specialized';

const CANVAS_SIZE = 255;
const MARGIN = 10;
const SVG_SIZE = CANVAS_SIZE + MARGIN * 2;
const HIT_RADIUS = 15;
const BINS = 256;

const channelColors = {
  master: '#ffffff',
  red:    '#ef4444',
  green:  '#22c55e',
  blue:   '#3b82f6',
};

export const CurveEditor: React.FC<CurveEditorProps> = ({
  value,
  onChange,
  specializedValue,
  onSpecializedChange,
  imageSrc,
  filterString,
}) => {
  const [category, setCategory] = useState<CurveCategory>('rgb');
  const [activeChannel, setActiveChannel] = useState<Channel>('master');
  const [activeSpecializedKind, setActiveSpecializedKind] = useState<SpecializedCurveKind>('hueVsSat');
  const svgRef = useRef<SVGSVGElement>(null);

  const [dragInfo, setDragInfo] = useState<{
    index: number;
    channel: Channel;
  } | null>(null);

  const [histData, setHistData] = useState<number[] | null>(null);
  const [histPeak, setHistPeak] = useState<number>(1);
  const histTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rafRef = useRef<number | undefined>(undefined);

  // Compute live histogram behind curves
  useEffect(() => {
    if (!imageSrc) return;
    if (histTimerRef.current) clearTimeout(histTimerRef.current);
    histTimerRef.current = setTimeout(async () => {
      const result = await computeHistogram(imageSrc, filterString || 'none');
      setHistData(result.lum);
      setHistPeak(result.peak);
    }, 400);
    return () => {
      if (histTimerRef.current) clearTimeout(histTimerRef.current);
    };
  }, [imageSrc, filterString]);

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

  const handlePointerUp = useCallback(() => {
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

  const buildHistogramPath = (bins: number[], peak: number): string => {
    if (peak === 0) return '';
    const scaleY = (v: number) => MARGIN + CANVAS_SIZE - (v / peak) * CANVAS_SIZE;

    const pts: string[] = [`M${MARGIN},${MARGIN + CANVAS_SIZE}`];
    for (let i = 0; i < BINS; i++) {
      const x = MARGIN + (i / (BINS - 1)) * CANVAS_SIZE;
      const y = scaleY(bins[i]);
      pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pts.push(`L${MARGIN + CANVAS_SIZE},${MARGIN + CANVAS_SIZE}`, 'Z');
    return pts.join(' ');
  };

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
      {/* Category selector */}
      <div className="flex rounded-lg bg-black/40 p-1 border border-white/5">
        <button
          onClick={() => setCategory('rgb')}
          className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
            category === 'rgb' ? 'bg-white/15 text-white font-semibold shadow-sm' : 'text-white/50 hover:text-white'
          }`}
        >
          RGB Curves
        </button>
        <button
          onClick={() => setCategory('specialized')}
          className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
            category === 'specialized' ? 'bg-white/15 text-white font-semibold shadow-sm' : 'text-white/50 hover:text-white'
          }`}
        >
          Color vs Color
        </button>
      </div>

      {category === 'rgb' ? (
        /* Channel Tabs - Sleek dark rectangles */
        <div className="flex rounded-lg p-0.5 gap-2 max-w-fit mb-1">
          {channels.map(ch => {
            const isActive = activeChannel === ch;
            let textStyle = '';
            let activeStyle = '';
            let labelElement: React.ReactNode = null;

            if (ch === 'master') {
              labelElement = (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
                  <path
                    d="M2,13 C5,13 8,3 14,3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              );
              textStyle = isActive ? 'text-black' : 'text-white/60 hover:text-white';
              activeStyle = isActive ? 'bg-white text-black shadow-sm' : 'bg-white/5 hover:bg-white/10';
            } else if (ch === 'red') {
              labelElement = <span className="font-bold text-[11px] font-sans">R</span>;
              textStyle = 'text-[#ef4444]';
              activeStyle = isActive ? 'bg-[#ef4444]/20 border border-[#ef4444]/40 shadow-sm' : 'bg-white/5 hover:bg-[#ef4444]/10 border border-[#ef4444]/10';
            } else if (ch === 'green') {
              labelElement = <span className="font-bold text-[11px] font-sans">G</span>;
              textStyle = 'text-[#22c55e]';
              activeStyle = isActive ? 'bg-[#22c55e]/20 border border-[#22c55e]/40 shadow-sm' : 'bg-white/5 hover:bg-[#22c55e]/10 border border-[#22c55e]/10';
            } else if (ch === 'blue') {
              labelElement = <span className="font-bold text-[11px] font-sans">B</span>;
              textStyle = 'text-[#3b82f6]';
              activeStyle = isActive ? 'bg-[#3b82f6]/20 border border-[#3b82f6]/40 shadow-sm' : 'bg-white/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/10';
            }

            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`w-9 h-7 flex items-center justify-center rounded border border-white/5 transition-all duration-150 cursor-pointer ${activeStyle} ${textStyle}`}
              >
                {labelElement}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {(['hueVsHue', 'hueVsSat', 'hueVsLum', 'lumVsSat', 'satVsSat'] as SpecializedCurveKind[]).map(k => {
            const labels: Record<SpecializedCurveKind, string> = {
              hueVsHue: 'Hue vs Hue',
              hueVsSat: 'Hue vs Sat',
              hueVsLum: 'Hue vs Lum',
              lumVsSat: 'Lum vs Sat',
              satVsSat: 'Sat vs Sat',
            };
            const isActive = activeSpecializedKind === k;
            return (
              <button
                key={k}
                onClick={() => setActiveSpecializedKind(k)}
                className={`px-2 py-1 text-[10px] rounded border transition-all ${
                  isActive ? 'bg-primary/25 border-primary text-primary font-semibold' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {labels[k]}
              </button>
            );
          })}
        </div>
      )}

      {/* Graph Area */}
      <div className="bg-[#14151a] rounded overflow-hidden border border-white/5 select-none touch-none">
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
                <line x1={pos} y1={MARGIN} x2={pos} y2={MARGIN + CANVAS_SIZE} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1={MARGIN} y1={pos} x2={MARGIN + CANVAS_SIZE} y2={pos} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              </React.Fragment>
            );
          })}

          {/* Histogram background */}
          {histData && (
            <path
              d={buildHistogramPath(histData, histPeak)}
              fill="rgba(255, 255, 255, 0.08)"
              style={{ pointerEvents: 'none' }}
            />
          )}
          
          {/* Background curves */}
          {channels.filter(ch => ch !== activeChannel).map(ch => (
            <React.Fragment key={ch}>
              {renderCurvePath(ch, 1.5, ch === 'master' ? 0.2 : 0.4)}
            </React.Fragment>
          ))}

          {/* Active curve */}
          {renderCurvePath(activeChannel, 2, 1)}

          {/* Active points - circular white nodes */}
          {value[activeChannel].map((p, i) => (
            <g
              key={i}
              transform={`translate(${mapSvgX(p.x)}, ${mapSvgY(p.y)})`}
              onPointerDown={(e) => handlePointerDown(e, i)}
              onDoubleClick={(e) => handleDoubleClickPoint(e, i)}
              className="cursor-move group/node"
            >
              <circle r={HIT_RADIUS} fill="transparent" />
              <circle 
                r={4.5} 
                fill="white" 
                stroke="rgba(0,0,0,0.6)" 
                strokeWidth={1.5}
                className="transition-transform group-hover/node:scale-125 shadow-md"
              />
            </g>
          ))}
        </svg>
      </div>
      
      <p className="text-[10px] text-white/20 text-center leading-relaxed mt-2.5">
        Click to add a point. Drag to adjust. Double-click to remove.
      </p>
    </div>
  );
};
