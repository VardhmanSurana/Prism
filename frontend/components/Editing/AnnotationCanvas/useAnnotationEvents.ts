import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../AnnotationsPanel';
import { AnnotationCanvasProps, HandleId, DragMode } from './types';
import { getAnnotationDistance, detectHandleClick, getAnnotationBBox } from './utils';

/**
 * partialEraseAnnotation
 * For freehand / highlighter / textPath annotations: removes every point
 * that falls inside `radius` around `center`, then returns the surviving
 * point-runs as separate new Annotation objects (stroke-splitting).
 * For all other annotation types the whole annotation is returned unchanged
 * so the caller can decide whether to keep or delete it based on distance.
 */
function partialEraseAnnotation(
  ann: Annotation,
  center: { x: number; y: number },
  radius: number,
): Annotation[] {
  const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'] as const;
  type StrokeType = typeof STROKE_TYPES[number];
  const isStroke = (STROKE_TYPES as readonly string[]).includes(ann.type);

  if (!isStroke || !ann.points || ann.points.length === 0) return [ann];

  // Tag each point: true = inside eraser (to be removed)
  const tagged = ann.points.map(p => ({
    x: p.x,
    y: p.y,
    erase: Math.hypot(p.x - center.x, p.y - center.y) < radius,
  }));

  // If nothing falls in the eraser, return unchanged
  if (!tagged.some(p => p.erase)) return [ann];

  // Split into consecutive runs of non-erased points
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const p of tagged) {
    if (!p.erase) {
      current.push({ x: p.x, y: p.y });
    } else {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);

  // Return each surviving segment as its own annotation
  return segments.map((pts, i) => ({
    ...ann,
    id: i === 0 ? ann.id : `${ann.id}-seg${i}-${Date.now()}`,
    points: pts,
  }));
}

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

    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    textDecoration,
    textAlign,
    lineHeight,
    letterSpacing,
    doodleText,
    doodleFontSize,
    doodleFontFamily,
    showDoodleGuide,
  } = props;
  const activeOpacity = props.activeOpacity ?? 1;


  const [currentAnn, setCurrentAnn] = useState<Annotation | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [rotatingAnnId, setRotatingAnnId] = useState<string | null>(null);
  const rotateStartRef = useRef<{ centerX: number; centerY: number; startRotation: number; startAngleRad: number } | null>(null);

  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const propsRef = useRef(props);
  propsRef.current = props;

  const currentAnnRef = useRef(currentAnn);
  currentAnnRef.current = currentAnn;

  const dragModeRef = useRef(dragMode);
  dragModeRef.current = dragMode;

  const lastPosRef = useRef(lastPos);
  lastPosRef.current = lastPos;

  const rotatingAnnIdRef = useRef(rotatingAnnId);
  rotatingAnnIdRef.current = rotatingAnnId;

  const activeHandleRef = useRef(activeHandle);
  activeHandleRef.current = activeHandle;

  const animationFrameRef = useRef<number | null>(null);
  const latestPointerEventRef = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getCoordinates = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x, y };
  };

  const getCoordinatesFromClient = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 1000;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    propsRef.current.onStartGesture?.();
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
      const eraseRadius = propsRef.current.eraserSize ?? 35;
      const nextAnnotations: Annotation[] = [];
      let changed = false;
      for (const ann of annotations) {
        const result = partialEraseAnnotation(ann, { x, y }, eraseRadius);
        if (result.length !== 1 || result[0] !== ann) changed = true;
        // For non-stroke shapes, delete entirely if centre is within radius
        if (result.length === 1 && result[0] === ann) {
          const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'];
          if (!STROKE_TYPES.includes(ann.type) && getAnnotationDistance({ x, y }, ann) < eraseRadius) {
            changed = true;
            // drop it (don't push)
            continue;
          }
        }
        nextAnnotations.push(...result);
      }
      if (changed) onChange(nextAnnotations);
      return;
    }

    if (activeDrawTool === 'text') {
      const newAnn: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'text',
        color: activeColor,
        strokeWidth: strokeWidth,
        opacity: activeOpacity,
        text: '',
        fontFamily: fontFamily || 'Space Grotesk',
        fontSize: fontSize || 36,
        fontWeight: fontWeight || 'bold',
        fontStyle: fontStyle || 'normal',
        textDecoration: textDecoration || 'none',
        textAlign: textAlign || 'center',
        lineHeight: lineHeight || 1.2,
        letterSpacing: letterSpacing || 0,
        bounds: {
          x: Math.max(0, x - 125),
          y: Math.max(0, y - 50),
          w: 250,
          h: 100,
        },
      };
      onChange([...annotations, newAnn]);
      setSelectedAnnId?.(newAnn.id);
      setActiveDrawTool?.('select');
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
      ...(activeDrawTool === 'freehand' || activeDrawTool === 'arrow' || activeDrawTool === 'highlighter' || activeDrawTool === 'textPath'
        ? { points: [{ x, y }] }
        : { bounds: { x, y, w: 0, h: 0 } }),
      ...(activeDrawTool === 'textPath' ? {
        doodleText: doodleText || 'peace in the air',
        fontSize: doodleFontSize || 18,
        fontFamily: doodleFontFamily || 'Space Grotesk',
        showGuidePath: showDoodleGuide !== false,
      } : {}),
    };
    setCurrentAnn(newAnn);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;

    latestPointerEventRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
    };

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        if (!latestPointerEventRef.current || !isDrawing.current) return;

        const { clientX, clientY } = latestPointerEventRef.current;

        const currentRotatingAnnId = rotatingAnnIdRef.current;
        const currentActiveDrawTool = propsRef.current.activeDrawTool;
        const currentSelectedAnnId = propsRef.current.selectedAnnId;
        const currentDragMode = dragModeRef.current;
        const currentLastPos = lastPosRef.current;
        const currentActiveHandle = activeHandleRef.current;
        const currentCurrentAnn = currentAnnRef.current;
        const currentAnnotations = propsRef.current.annotations;
        const currentOnChange = propsRef.current.onChange;

        // Handle Text Box rotating using client coordinates
        if (currentRotatingAnnId && rotateStartRef.current) {
          const { centerX, centerY, startRotation, startAngleRad } = rotateStartRef.current;
          const currentAngleRad = Math.atan2(clientY - centerY, clientX - centerX);
          const angleDeltaRad = currentAngleRad - startAngleRad;
          const angleDeltaDeg = angleDeltaRad * (180 / Math.PI);
          
          let nextRotation = Math.round(startRotation + angleDeltaDeg);
          nextRotation = (nextRotation + 360) % 360;

          currentOnChange(
            currentAnnotations.map((ann) =>
              ann.id === currentRotatingAnnId ? { ...ann, rotation: nextRotation } : ann
            )
          );
          return;
        }

        const { x, y } = getCoordinatesFromClient(clientX, clientY);

        if (currentActiveDrawTool === 'select' && currentSelectedAnnId) {
          const dx = x - currentLastPos.x;
          const dy = y - currentLastPos.y;
          setLastPos({ x, y });

          currentOnChange(currentAnnotations.map(ann => {
            if (ann.id !== currentSelectedAnnId) return ann;

            if (currentDragMode === 'move') {
              if (ann.bounds) {
                return { ...ann, bounds: { ...ann.bounds, x: ann.bounds.x + dx, y: ann.bounds.y + dy } };
              }
              if (ann.points) {
                return { ...ann, points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
              }
            }

            if (currentDragMode === 'resize-edge' && currentActiveHandle) {
              if (ann.bounds) {
                const b = ann.bounds;
                const nx = b.w < 0 ? b.x + b.w : b.x;
                const ny = b.h < 0 ? b.y + b.h : b.y;
                const nw = Math.abs(b.w);
                const nh = Math.abs(b.h);

                switch (currentActiveHandle) {
                  case 'tl': {
                    const clampedX = Math.min(x, nx + nw - 10);
                    const clampedY = Math.min(y, ny + nh - 10);
                    return { ...ann, bounds: { x: clampedX, y: clampedY, w: b.w + (nx - clampedX), h: b.h + (ny - clampedY) } };
                  }
                  case 'tr': {
                    const newW = Math.max(10, x - nx);
                    const clampedY = Math.min(y, ny + nh - 10);
                    return { ...ann, bounds: { x: b.x, y: clampedY, w: newW, h: b.h + (ny - clampedY) } };
                  }
                  case 'bl': {
                    const clampedX = Math.min(x, nx + nw - 10);
                    const newH = Math.max(10, y - ny);
                    return { ...ann, bounds: { x: clampedX, y: b.y, w: b.w + (nx - clampedX), h: newH } };
                  }
                  case 'br': {
                    const newW = Math.max(10, x - nx);
                    const newH = Math.max(10, y - ny);
                    return { ...ann, bounds: { x: b.x, y: b.y, w: newW, h: newH } };
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

              // Freehand/highlighter/textPath: scale points within bounding box
              if (ann.points && ann.points.length > 0) {
                const bbox = getAnnotationBBox(ann);
                if (bbox.w === 0 && bbox.h === 0) return ann;

                let newBBox = { ...bbox };

                switch (currentActiveHandle) {
                  case 'tl': {
                    const clampedX = Math.min(x, bbox.x + bbox.w - 10);
                    const clampedY = Math.min(y, bbox.y + bbox.h - 10);
                    newBBox = { x: clampedX, y: clampedY, w: bbox.w + (bbox.x - clampedX), h: bbox.h + (bbox.y - clampedY) };
                    break;
                  }
                  case 'tr': {
                    const newW = Math.max(10, x - bbox.x);
                    const clampedY = Math.min(y, bbox.y + bbox.h - 10);
                    newBBox = { x: bbox.x, y: clampedY, w: newW, h: bbox.h + (bbox.y - clampedY) };
                    break;
                  }
                  case 'bl': {
                    const clampedX = Math.min(x, bbox.x + bbox.w - 10);
                    const newH = Math.max(10, y - bbox.y);
                    newBBox = { x: clampedX, y: bbox.y, w: bbox.w + (bbox.x - clampedX), h: newH };
                    break;
                  }
                  case 'br': {
                    const newW = Math.max(10, x - bbox.x);
                    const newH = Math.max(10, y - bbox.y);
                    newBBox = { x: bbox.x, y: bbox.y, w: newW, h: newH };
                    break;
                  }
                  case 'lm': {
                    const clampedX = Math.min(x, bbox.x + bbox.w - 10);
                    newBBox = { x: clampedX, y: bbox.y, w: bbox.w + (bbox.x - clampedX), h: bbox.h };
                    break;
                  }
                  case 'rm': {
                    newBBox = { x: bbox.x, y: bbox.y, w: Math.max(10, x - bbox.x), h: bbox.h };
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

            if (currentDragMode === 'resize-endpoint' && currentActiveHandle && ann.points && ann.points.length >= 2) {
              const points = [...ann.points];
              const idx = currentActiveHandle === 'ep0' ? 0 : points.length - 1;
              points[idx] = { x, y };
              return { ...ann, points };
            }

            return ann;
          }));
          return;
        }

        if (currentActiveDrawTool === 'eraser') {
          const eraseRadius = propsRef.current.eraserSize ?? 35;
          const nextAnnotations: Annotation[] = [];
          let changed = false;
          for (const ann of currentAnnotations) {
            const result = partialEraseAnnotation(ann, { x, y }, eraseRadius);
            if (result.length !== 1 || result[0] !== ann) changed = true;
            if (result.length === 1 && result[0] === ann) {
              const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'];
              if (!STROKE_TYPES.includes(ann.type) && getAnnotationDistance({ x, y }, ann) < eraseRadius) {
                changed = true;
                continue;
              }
            }
            nextAnnotations.push(...result);
          }
          if (changed) currentOnChange(nextAnnotations);
          return;
        }

        if (!currentCurrentAnn) return;

        if ((currentCurrentAnn.type === 'freehand' || currentCurrentAnn.type === 'highlighter' || currentCurrentAnn.type === 'textPath') && currentCurrentAnn.points) {
          setCurrentAnn({
            ...currentCurrentAnn,
            points: [...currentCurrentAnn.points, { x, y }],
          });
        } else if (currentCurrentAnn.type === 'arrow' && currentCurrentAnn.points) {
          setCurrentAnn({
            ...currentCurrentAnn,
            points: [currentCurrentAnn.points[0], { x, y }],
          });
        } else if (currentCurrentAnn.type === 'rect' || currentCurrentAnn.type === 'circle') {
          setCurrentAnn({
            ...currentCurrentAnn,
            bounds: {
              x: startPos.current.x,
              y: startPos.current.y,
              w: x - startPos.current.x,
              h: y - startPos.current.y,
            },
          });
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDrawing.current = false;
    setDragMode('none');
    setActiveHandle(null);
    setRotatingAnnId(null);
    rotateStartRef.current = null;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    latestPointerEventRef.current = null;

    propsRef.current.onEndGesture?.();

    if (activeDrawTool === 'eraser' || activeDrawTool === 'select') return;

    if (currentAnn) {
      let valid = true;
      if ((currentAnn.type === 'freehand' || currentAnn.type === 'highlighter' || currentAnn.type === 'arrow' || currentAnn.type === 'textPath') && currentAnn.points && currentAnn.points.length < 2) valid = false;
      if ((currentAnn.type === 'rect' || currentAnn.type === 'circle') && currentAnn.bounds && Math.abs(currentAnn.bounds.w) < 3 && Math.abs(currentAnn.bounds.h) < 3) valid = false;

      if (valid) onChange([...annotations, currentAnn]);
    }
    setCurrentAnn(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
  };

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

  const handleTextRotateStart = (e: React.PointerEvent, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation();
    e.preventDefault();
    const ann = annotations.find(a => a.id === annId);
    if (!ann) return;

    const el = document.getElementById(`text-layer-${annId}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cX = rect.left + rect.width / 2;
      const cY = rect.top + rect.height / 2;
      const startAngleRad = Math.atan2(e.clientY - cY, e.clientX - cX);
      rotateStartRef.current = {
        centerX: cX,
        centerY: cY,
        startRotation: ann.rotation || 0,
        startAngleRad,
      };
      setRotatingAnnId(annId);
      isDrawing.current = true;
      
      if (svgRef.current) {
        svgRef.current.setPointerCapture(e.pointerId);
      }
    }
  };

  const handleTextResizeStart = (e: React.PointerEvent, handleId: HandleId, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation();
    e.preventDefault();
    
    setDragMode('resize-edge');
    setActiveHandle(handleId);
    setSelectedAnnId?.(annId);
    isDrawing.current = true;
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 1000;
      const y = ((e.clientY - rect.top) / rect.height) * 1000;
      setLastPos({ x, y });
      svgRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handleTextMoveStart = (e: React.PointerEvent, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation();
    e.preventDefault();
    
    setDragMode('move');
    setActiveHandle(null);
    setSelectedAnnId?.(annId);
    isDrawing.current = true;

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 1000;
      const y = ((e.clientY - rect.top) / rect.height) * 1000;
      setLastPos({ x, y });
      svgRef.current.setPointerCapture(e.pointerId);
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
    handleTextRotateStart,
    handleTextResizeStart,
    handleTextMoveStart,
  };
};
