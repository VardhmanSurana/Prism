/**
 * CurveEditor.tsx
 * Tone curves & specialized color curves interactive editor.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Point } from '../spline';
import { computeHistogram } from '../histogramUtils';
import { SpecializedCurveKind } from '../curves';
import {
  CurveEditorProps,
  Channel,
  CurveCategory,
  CANVAS_SIZE,
  MARGIN,
  SVG_SIZE,
} from './types';
import { CurveHeader } from './CurveHeader';
import { CurveGraph } from './CurveGraph';

export const CurveEditor: React.FC<CurveEditorProps> = ({
  value,
  onChange,
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

    let x = (clientX - rect.left) * scaleX - MARGIN;
    let y = CANVAS_SIZE - ((clientY - rect.top) * scaleY - MARGIN);

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

      if (index === 0) {
        pts[index] = { x: 0.0, y };
      } else if (index === pts.length - 1) {
        pts[index] = { x: CANVAS_SIZE, y };
      } else {
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
    let insertIdx = 1;
    while (insertIdx < pts.length && pts[insertIdx].x < x) {
      insertIdx++;
    }

    if (Math.abs(pts[insertIdx - 1].x - x) < 5) return;
    if (insertIdx < pts.length && Math.abs(pts[insertIdx].x - x) < 5) return;

    pts.splice(insertIdx, 0, { x, y });
    onChange({ ...value, [activeChannel]: pts });
  }, [dragInfo, value, activeChannel, onChange]);

  const handleDoubleClickPoint = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (idx === 0 || idx === value[activeChannel].length - 1) {
      const pts = [...value[activeChannel]];
      pts[idx] = { x: pts[idx].x, y: idx === 0 ? 0 : CANVAS_SIZE };
      onChange({ ...value, [activeChannel]: pts });
      return;
    }

    const pts = [...value[activeChannel]];
    pts.splice(idx, 1);
    onChange({ ...value, [activeChannel]: pts });
  }, [value, activeChannel, onChange]);

  return (
    <div className="flex flex-col gap-3">
      <CurveHeader
        category={category}
        setCategory={setCategory}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        activeSpecializedKind={activeSpecializedKind}
        setActiveSpecializedKind={setActiveSpecializedKind}
      />

      <CurveGraph
        svgRef={svgRef}
        value={value}
        activeChannel={activeChannel}
        histData={histData}
        histPeak={histPeak}
        onSvgPointerDown={handleSvgClick}
        onPointPointerDown={handlePointerDown}
        onPointDoubleClick={handleDoubleClickPoint}
      />

      <p className="text-[10px] text-white/20 text-center leading-relaxed mt-2.5">
        Click to add a point. Drag to adjust. Double-click to remove.
      </p>
    </div>
  );
};

