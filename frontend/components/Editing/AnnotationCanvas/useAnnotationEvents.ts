import React, { useState, useRef } from 'react';
import { Annotation } from '../AnnotationsPanel';
import { AnnotationCanvasProps, HandleId, DragMode } from './types';
import { getAnnotationDistance, pointDistance, detectHandleClick, computeResizeAnchor, getAnnotationBBox } from './utils';

export const useAnnotationEvents = (props: AnnotationCanvasProps) => {
  const {
    annotations,
    onChange,
    activeDrawTool,
    setActiveDrawTool,
    activeColor,
    strokeWidth,
    selectedAnnId,
    setSelectedAnnId,
    readOnly,
  } = props;
  const activeOpacity = props.activeOpacity ?? 1;

  const [currentAnn, setCurrentAnn] = useState<Annotation | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [resizeAnchor, setResizeAnchor] = useState({ x: 0, y: 0 });

  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const getCoordinates = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = getCoordinates(e);

    if (activeDrawTool === 'select') {
      // 1. Check if clicking a handle on the selected annotation
      if (selectedAnnId) {
        const selAnn = annotations.find(a => a.id === selectedAnnId);
        if (selAnn) {
          const handleId = detectHandleClick(x, y, selAnn);
          if (handleId) {
            const isEndpoint = handleId === 'ep0' || handleId === 'ep1';
            setDragMode(isEndpoint ? 'resize-endpoint' : 'resize-edge');
            setActiveHandle(handleId);
            setResizeAnchor(computeResizeAnchor(handleId, selAnn));
            isDrawing.current = true;
            setLastPos({ x, y });
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // 2. Check if clicking any annotation to select + move
      const clickedAnn = [...annotations].reverse().find(
        (ann) => getAnnotationDistance({ x, y }, ann) < 40
      );

      if (clickedAnn) {
        setSelectedAnnId?.(clickedAnn.id);
        isDrawing.current = true;
        setLastPos({ x, y });
        setDragMode('move');
        setActiveHandle(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      } else {
        setSelectedAnnId?.(null);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeDrawTool === 'eraser') {
      isDrawing.current = true;
      const clickedAnn = annotations.find(
        (ann) => getAnnotationDistance({ x, y }, ann) < 35
      );
      if (clickedAnn) {
        onChange(annotations.filter((ann) => ann.id !== clickedAnn.id));
      }
      return;
    }

    isDrawing.current = true;
    startPos.current = { x, y };

    const newAnn: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: activeDrawTool,
      color: activeColor,
      opacity: activeDrawTool === 'highlighter' ? 0.4 : activeOpacity,
      strokeWidth: activeDrawTool === 'highlighter' ? strokeWidth * 2.5 : strokeWidth,
      ...(activeDrawTool === 'freehand' || activeDrawTool === 'arrow' || activeDrawTool === 'highlighter'
        ? { points: [{ x, y }] }
        : { bounds: { x, y, w: 0, h: 0 } }),
    };
    setCurrentAnn(newAnn);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    const { x, y } = getCoordinates(e);

    if (activeDrawTool === 'select' && selectedAnnId) {
      const dx = x - lastPos.x;
      const dy = y - lastPos.y;
      setLastPos({ x, y });

      onChange(annotations.map(ann => {
        if (ann.id !== selectedAnnId) return ann;

        if (dragMode === 'move') {
          if (ann.bounds) {
            return { ...ann, bounds: { ...ann.bounds, x: ann.bounds.x + dx, y: ann.bounds.y + dy } };
          }
          if (ann.points) {
            return { ...ann, points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          }
        }

        if (dragMode === 'resize-edge' && activeHandle) {
          if (ann.bounds) {
            const b = ann.bounds;
            const nx = b.w < 0 ? b.x + b.w : b.x;
            const ny = b.h < 0 ? b.y + b.h : b.y;
            const nw = Math.abs(b.w);
            const nh = Math.abs(b.h);

            switch (activeHandle) {
              case 'tm': {
                const clampedY = Math.min(y, ny + nh - 10);
                return { ...ann, bounds: { x: b.x, y: clampedY, w: b.w, h: b.h + (ny - clampedY) } };
              }
              case 'bm': {
                const newH = Math.max(10, y - ny);
                return { ...ann, bounds: { x: b.x, y: b.y, w: b.w, h: newH } };
              }
              case 'lm': {
                const clampedX = Math.min(x, nx + nw - 10);
                return { ...ann, bounds: { x: clampedX, y: b.y, w: b.w + (nx - clampedX), h: b.h } };
              }
              case 'rm': {
                const newW = Math.max(10, x - nx);
                return { ...ann, bounds: { x: b.x, y: b.y, w: newW, h: b.h } };
              }
            }
          }

          // Freehand/highlighter: scale points within bounding box
          if (ann.points && ann.points.length > 0) {
            const bbox = getAnnotationBBox(ann);
            if (bbox.w === 0 && bbox.h === 0) return ann;

            let newBBox = { ...bbox };

            switch (activeHandle) {
              case 'tm': {
                const clampedY = Math.min(y, bbox.y + bbox.h - 10);
                newBBox = { ...bbox, y: clampedY, h: bbox.h + (bbox.y - clampedY) };
                break;
              }
              case 'bm': {
                newBBox = { ...bbox, h: Math.max(10, y - bbox.y) };
                break;
              }
              case 'lm': {
                const clampedX = Math.min(x, bbox.x + bbox.w - 10);
                newBBox = { ...bbox, x: clampedX, w: bbox.w + (bbox.x - clampedX) };
                break;
              }
              case 'rm': {
                newBBox = { ...bbox, w: Math.max(10, x - bbox.x) };
                break;
              }
            }

            const scaleX = bbox.w > 0 ? newBBox.w / bbox.w : 1;
            const scaleY = bbox.h > 0 ? newBBox.h / bbox.h : 1;

            const newPoints = ann.points.map(p => ({
              x: newBBox.x + (p.x - bbox.x) * scaleX,
              y: newBBox.y + (p.y - bbox.y) * scaleY,
            }));

            return { ...ann, points: newPoints };
          }
        }

        if (dragMode === 'resize-endpoint' && activeHandle && ann.points && ann.points.length >= 2) {
          const points = [...ann.points];
          const idx = activeHandle === 'ep0' ? 0 : points.length - 1;
          points[idx] = { x, y };
          return { ...ann, points };
        }

        return ann;
      }));
      return;
    }

    if (activeDrawTool === 'eraser') {
      const closeAnns = annotations.filter(
        (ann) => getAnnotationDistance({ x, y }, ann) < 35
      );
      if (closeAnns.length > 0) {
        const closeIds = new Set(closeAnns.map((ann) => ann.id));
        onChange(annotations.filter((ann) => !closeIds.has(ann.id)));
      }
      return;
    }

    if (!currentAnn) return;

    if ((currentAnn.type === 'freehand' || currentAnn.type === 'highlighter') && currentAnn.points) {
      setCurrentAnn({
        ...currentAnn,
        points: [...currentAnn.points, { x, y }],
      });
    } else if (currentAnn.type === 'arrow' && currentAnn.points) {
      setCurrentAnn({
        ...currentAnn,
        points: [currentAnn.points[0], { x, y }],
      });
    } else if (currentAnn.type === 'rect' || currentAnn.type === 'circle') {
      setCurrentAnn({
        ...currentAnn,
        bounds: {
          x: startPos.current.x,
          y: startPos.current.y,
          w: x - startPos.current.x,
          h: y - startPos.current.y,
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDrawing.current = false;
    setDragMode('none');
    setActiveHandle(null);

    if (activeDrawTool === 'eraser' || activeDrawTool === 'select') return;

    if (currentAnn) {
      let valid = true;
      if ((currentAnn.type === 'freehand' || currentAnn.type === 'highlighter' || currentAnn.type === 'arrow') && currentAnn.points && currentAnn.points.length < 2) valid = false;
      if ((currentAnn.type === 'rect' || currentAnn.type === 'circle') && currentAnn.bounds && Math.abs(currentAnn.bounds.w) < 3 && Math.abs(currentAnn.bounds.h) < 3) valid = false;

      if (valid) onChange([...annotations, currentAnn]);
    }
    setCurrentAnn(null);
  };

  const handleDoubleClick = () => {};

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const { x, y } = getCoordinates(e as any);
      const clickedAnn = [...annotations].reverse().find((ann) => getAnnotationDistance({ x, y }, ann) < 35);
      if (clickedAnn) {
        setSelectedAnnId?.(clickedAnn.id);
        setActiveDrawTool?.('select');
      }
    }
  };

  return {
    currentAnn,
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleContextMenu,
  };
};
