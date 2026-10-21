/**
 * CurveGraph.tsx
 * Interactive SVG curve graph with histogram background, spline curves, and control points.
 */

import React from 'react';
import { Point, splineToSvgPath } from '../spline';
import {
  Channel,
  channelColors,
  CANVAS_SIZE,
  MARGIN,
  SVG_SIZE,
  HIT_RADIUS,
  BINS,
} from './types';

interface CurveGraphProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  value: Record<Channel, Point[]>;
  activeChannel: Channel;
  histData: number[] | null;
  histPeak: number;
  onSvgPointerDown: (e: React.PointerEvent) => void;
  onPointPointerDown: (e: React.PointerEvent, idx: number) => void;
  onPointDoubleClick: (e: React.MouseEvent, idx: number) => void;
}

const channels: Channel[] = ['master', 'red', 'green', 'blue'];

export const CurveGraph: React.FC<CurveGraphProps> = ({
  svgRef,
  value,
  activeChannel,
  histData,
  histPeak,
  onSvgPointerDown,
  onPointPointerDown,
  onPointDoubleClick,
}) => {
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
        className="transition-opacity 75ms ease-out, transition-d 75ms ease-out"
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  return (
    <div className="bg-[#14151a] rounded overflow-hidden border border-white/5 select-none touch-none">
      <svg
        ref={svgRef as React.RefObject<SVGSVGElement>}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full h-auto cursor-crosshair"
        onPointerDown={onSvgPointerDown}
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
            onPointerDown={(e) => onPointPointerDown(e, i)}
            onDoubleClick={(e) => onPointDoubleClick(e, i)}
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
  );
};

