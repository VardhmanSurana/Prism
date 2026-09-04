/**
 * useAnnotationEvents.ts
 *
 * Drag is handled via native window pointermove/pointerup listeners registered
 * on pointerdown — the same pattern the editor (CanvasViewport.tsx) uses for its
 * resize/rotate handlers. This bypasses React's synthetic event batching overhead
 * and gives smooth 60 fps moves on every annotation type.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../AnnotationsPanel';
import { AnnotationCanvasProps, HandleId, DragMode } from './types';
import { getAnnotationDistance, detectHandleClick, getAnnotationBBox } from './utils';

// ─── Partial erase ────────────────────────────────────────────────────────────

function partialEraseAnnotation(ann: Annotation, center: { x: number; y: number }, radius: number): Annotation[] {
  const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'] as const;
  if (!(STROKE_TYPES as readonly string[]).includes(ann.type) || !ann.points?.length) return [ann];

  const tagged = ann.points.map(p => ({ ...p, erase: Math.hypot(p.x - center.x, p.y - center.y) < radius }));
  if (!tagged.some(p => p.erase)) return [ann];

  const segs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const p of tagged) {
    if (!p.erase) run.push({ x: p.x, y: p.y });
    else { if (run.length >= 2) segs.push(run); run = []; }
  }
  if (run.length >= 2) segs.push(run);
  return segs.map((pts, i) => ({ ...ann, id: i === 0 ? ann.id : `${ann.id}-seg${i}-${Date.now()}`, points: pts }));
}

// ─── Resize (pure) ────────────────────────────────────────────────────────────

function applyResize(ann: Annotation, handleId: HandleId, x: number, y: number): Annotation {
  if (ann.bounds) {
    const b = ann.bounds;
    const nx = b.w < 0 ? b.x + b.w : b.x, ny = b.h < 0 ? b.y + b.h : b.y;
    const nw = Math.abs(b.w), nh = Math.abs(b.h);
    let nb = { ...b };
    switch (handleId) {
      case 'tl': { const cx=Math.min(x,nx+nw-10), cy=Math.min(y,ny+nh-10); nb={x:cx,y:cy,w:b.w+(nx-cx),h:b.h+(ny-cy)}; break; }
      case 'tr': { const cy=Math.min(y,ny+nh-10); nb={x:b.x,y:cy,w:Math.max(10,x-nx),h:b.h+(ny-cy)}; break; }
      case 'bl': { const cx=Math.min(x,nx+nw-10); nb={x:cx,y:b.y,w:b.w+(nx-cx),h:Math.max(10,y-ny)}; break; }
      case 'br': nb={x:b.x,y:b.y,w:Math.max(10,x-nx),h:Math.max(10,y-ny)}; break;
      case 'lm': { const cx=Math.min(x,nx+nw-10); nb={x:cx,y:b.y,w:b.w+(nx-cx),h:b.h}; break; }
      case 'rm': nb={x:b.x,y:b.y,w:Math.max(10,x-nx),h:b.h}; break;
    }
    return { ...ann, bounds: nb };
  }
  if (ann.points?.length) {
    const bbox = getAnnotationBBox(ann);
    if (bbox.w === 0 && bbox.h === 0) return ann;
    let nb = { ...bbox };
    switch (handleId) {
      case 'tl': { const cx=Math.min(x,bbox.x+bbox.w-10), cy=Math.min(y,bbox.y+bbox.h-10); nb={x:cx,y:cy,w:bbox.w+(bbox.x-cx),h:bbox.h+(bbox.y-cy)}; break; }
      case 'tr': { const cy=Math.min(y,bbox.y+bbox.h-10); nb={x:bbox.x,y:cy,w:Math.max(10,x-bbox.x),h:bbox.h+(bbox.y-cy)}; break; }
      case 'bl': { const cx=Math.min(x,bbox.x+bbox.w-10); nb={x:cx,y:bbox.y,w:bbox.w+(bbox.x-cx),h:Math.max(10,y-bbox.y)}; break; }
      case 'br': nb={x:bbox.x,y:bbox.y,w:Math.max(10,x-bbox.x),h:Math.max(10,y-bbox.y)}; break;
      case 'lm': { const cx=Math.min(x,bbox.x+bbox.w-10); nb={x:cx,y:bbox.y,w:bbox.w+(bbox.x-cx),h:bbox.h}; break; }
      case 'rm': nb={x:bbox.x,y:bbox.y,w:Math.max(10,x-bbox.x),h:bbox.h}; break;
    }
    const sx = bbox.w > 0 ? nb.w/bbox.w : 1, sy = bbox.h > 0 ? nb.h/bbox.h : 1;
    return { ...ann, points: ann.points.map(p => ({ x: nb.x+(p.x-bbox.x)*sx, y: nb.y+(p.y-bbox.y)*sy })) };
  }
  return ann;
}

// ─── SVG coordinate conversion ────────────────────────────────────────────────

function clientToSvg(svgEl: SVGSVGElement, clientX: number, clientY: number) {
  const r = svgEl.getBoundingClientRect();
  return { x: ((clientX - r.left) / r.width) * 1000, y: ((clientY - r.top) / r.height) * 1000 };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAnnotationEvents = (props: AnnotationCanvasProps) => {
  const {
    annotations, onChange, activeDrawTool, setActiveDrawTool,
    activeColor, strokeWidth, selectedAnnId, setSelectedAnnId,
    fontFamily, fontSize, fontWeight, fontStyle,
    textDecoration, textAlign, lineHeight, letterSpacing,
    doodleText, doodleFontSize, doodleFontFamily, showDoodleGuide,
  } = props;
  const activeOpacity = props.activeOpacity ?? 1;

  const [currentAnn,   setCurrentAnn]   = useState<Annotation | null>(null);
  const [dragMode,     setDragMode]     = useState<DragMode>('none');
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  const [rotatingAnnId, setRotatingAnnId] = useState<string | null>(null);

  const isDrawing  = useRef(false);
  const startPos   = useRef({ x: 0, y: 0 });
  const svgRef     = useRef<SVGSVGElement>(null);

  // Always-fresh props ref
  const propsRef = useRef(props);
  propsRef.current = props;

  const currentAnnRef       = useRef(currentAnn);
  currentAnnRef.current     = currentAnn;
  const dragModeRef         = useRef(dragMode);
  dragModeRef.current       = dragMode;
  const rotatingAnnIdRef    = useRef(rotatingAnnId);
  rotatingAnnIdRef.current  = rotatingAnnId;
  const activeHandleRef     = useRef(activeHandle);
  activeHandleRef.current   = activeHandle;
  const selectedAnnIdRef    = useRef(selectedAnnId);
  selectedAnnIdRef.current  = selectedAnnId;

  // Native drag state (lives completely outside React)
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const dragAnnIdRef      = useRef<string | null>(null);
  const rotateStartRef    = useRef<{ centerX: number; centerY: number; startRotation: number; startAngleRad: number } | null>(null);
  // ponytail: coalesce pointermove to 1 emit/frame; all transforms are absolute so dropping frames is lossless
  const rafIdRef          = useRef<number | null>(null);
  const pendingMoveRef    = useRef<{ clientX: number; clientY: number } | null>(null);
  // ponytail: transient move — DOM nodes written directly during drag, React commits once on pointerup
  const dragSvgNodesRef    = useRef<{ node: SVGGElement; base: string }[]>([]);
  const dragHtmlNodeRef   = useRef<HTMLElement | null>(null);
  const dragRectRef       = useRef<{ width: number; height: number } | null>(null);

  // cleanup on unmount
  useEffect(() => () => { removeNativeListeners(); }, []);

  // ─── Native listener management ──────────────────────────────────────────

  function removeNativeListeners() {
    window.removeEventListener('pointermove', onNativeMove);
    window.removeEventListener('pointerup',   onNativeUp);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingMoveRef.current = null;
  }

  // ─── Transient move (Excalidraw pattern: mutate view directly, commit state once) ──

  function beginTransientDrag(annId: string) {
    const svg = svgRef.current;
    dragSvgNodesRef.current = svg
      ? (Array.from(svg.querySelectorAll(`[data-ann-id="${annId}"]`)) as SVGGElement[])
          .map(node => ({ node, base: node.getAttribute('transform') ?? '' }))
      : [];
    dragHtmlNodeRef.current =
      document.getElementById(`ann-layer-${annId}`) ?? document.getElementById(`text-layer-${annId}`);
    const r = svg?.getBoundingClientRect();
    dragRectRef.current = r && r.width > 0 ? { width: r.width, height: r.height } : null;
  }

  function applyTransientMove(dx: number, dy: number) {
    // SVG user units (0-1000 space) — exact, no React involved; existing rotation preserved
    for (const { node, base } of dragSvgNodesRef.current) {
      node.setAttribute('transform', `translate(${dx} ${dy})${base ? ` ${base}` : ''}`);
    }
    const html = dragHtmlNodeRef.current;
    const rect = dragRectRef.current;
    if (html && rect) {
      // CSS `translate` composes independently of the overlay's `rotate()` transform
      html.style.translate = `${(dx / 1000) * rect.width}px ${(dy / 1000) * rect.height}px`;
    }
  }

  function clearTransientMove() {
    for (const { node, base } of dragSvgNodesRef.current) {
      if (base) node.setAttribute('transform', base);
      else node.removeAttribute('transform');
    }
    const html = dragHtmlNodeRef.current;
    if (html) html.style.translate = '';
    dragSvgNodesRef.current = [];
    dragHtmlNodeRef.current = null;
    dragRectRef.current = null;
  }

  function commitMove(clientX: number, clientY: number) {
    const svg = svgRef.current;
    const startAnn = dragStartAnnRef.current;
    const annId = dragAnnIdRef.current;
    if (!svg || !startAnn || !annId) return;
    const { x, y } = clientToSvg(svg, clientX, clientY);
    const dx = x - dragStartMouseRef.current.x;
    const dy = y - dragStartMouseRef.current.y;
    clearTransientMove();
    const anns = propsRef.current.annotations;
    const emit = propsRef.current.onChange;
    let next: Annotation;
    if (startAnn.bounds) {
      next = { ...startAnn, bounds: { ...startAnn.bounds, x: startAnn.bounds.x + dx, y: startAnn.bounds.y + dy } };
    } else if (startAnn.points) {
      next = { ...startAnn, points: startAnn.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    } else return;
    emit(anns.map(a => a.id === annId ? next : a));
  }

  /**
   * Native pointermove — coalesced to one emit per animation frame.
   * Pointer events can fire faster than display refresh; without this each
   * extra event is a full top-level setAnnotations + full-tree re-render.
   * Move mode skips React entirely (transient DOM transform, see above).
   */
  function onNativeMove(e: PointerEvent) {
    pendingMoveRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const pending = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (pending) flushMove(pending.clientX, pending.clientY);
    });
  }

  function flushMove(clientX: number, clientY: number) {
    if (!svgRef.current) return;

    const annId    = dragAnnIdRef.current;
    const rotating = rotatingAnnIdRef.current;
    const mode     = dragModeRef.current;
    const handle   = activeHandleRef.current;
    const anns     = propsRef.current.annotations;
    const emit     = propsRef.current.onChange;

    // ── Rotate ──
    if (rotating && rotateStartRef.current) {
      const { centerX, centerY, startRotation, startAngleRad } = rotateStartRef.current;
      const angle = Math.atan2(clientY - centerY, clientX - centerX);
      let rot = Math.round(startRotation + (angle - startAngleRad) * (180 / Math.PI));
      rot = ((rot % 360) + 360) % 360;
      emit(anns.map(a => a.id === rotating ? { ...a, rotation: rot } : a));
      return;
    }

    if (!annId) return;
    const { x, y } = clientToSvg(svgRef.current, clientX, clientY);
    const ann = anns.find(a => a.id === annId);
    if (!ann) return;

    let next: Annotation;

    if (mode === 'move') {
      // Transient: write straight to the DOM — zero setState until pointerup
      const startMouse = dragStartMouseRef.current;
      const startAnn   = dragStartAnnRef.current;
      if (!startAnn) return;
      applyTransientMove(x - startMouse.x, y - startMouse.y);
      return;
    } else if (mode === 'resize-edge' && handle) {
      next = applyResize(ann, handle, x, y);
    } else if (mode === 'resize-endpoint' && handle && ann.points && ann.points.length >= 2) {
      const pts = [...ann.points];
      pts[handle === 'ep0' ? 0 : pts.length - 1] = { x, y };
      next = { ...ann, points: pts };
    } else return;

    emit(anns.map(a => a.id === annId ? next : a));
  }

  function onNativeUp(e: PointerEvent) {
    // Flush the last coalesced position so the drop point is exact.
    // Move commits once (transient DOM transform → single state update).
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (dragModeRef.current === 'move' && dragAnnIdRef.current) {
      if (pending) commitMove(pending.clientX, pending.clientY);
      else clearTransientMove();
    } else if (pending) {
      flushMove(pending.clientX, pending.clientY);
    }
    removeNativeListeners();
    isDrawing.current   = false;
    dragAnnIdRef.current = null;
    dragStartAnnRef.current = null;
    rotatingAnnIdRef.current = null;
    rotateStartRef.current   = null;
    dragModeRef.current      = 'none';
    activeHandleRef.current  = null;

    setDragMode('none');
    setActiveHandle(null);
    setRotatingAnnId(null);
    propsRef.current.onEndGesture?.();
  }

  // Snapshot of annotation at drag start — for absolute-position move (no delta drift)
  const dragStartAnnRef = useRef<Annotation | null>(null);

  // ─── SVG event handlers ───────────────────────────────────────────────────

  const getCoords = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 1000 };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    propsRef.current.onStartGesture?.();
    const { x, y } = getCoords(e);

    if (activeDrawTool === 'select') {
      const curSelId = selectedAnnIdRef.current || selectedAnnId;

      // Hit-test handle on currently selected annotation
      if (curSelId) {
        const selAnn = annotations.find(a => a.id === curSelId);
        if (selAnn) {
          const handleId = detectHandleClick(x, y, selAnn);
          if (handleId) {
            const nextMode = (handleId === 'ep0' || handleId === 'ep1') ? 'resize-endpoint' : 'resize-edge';
            dragModeRef.current     = nextMode; setDragMode(nextMode);
            activeHandleRef.current = handleId; setActiveHandle(handleId);
            dragAnnIdRef.current    = selAnn.id;
            dragStartAnnRef.current = selAnn;
            isDrawing.current       = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            window.addEventListener('pointermove', onNativeMove);
            window.addEventListener('pointerup',   onNativeUp);
            return;
          }
        }
      }

      // Hit-test any annotation
      const clicked = [...annotations].reverse().find(ann => getAnnotationDistance({ x, y }, ann) < 40);
      if (clicked) {
        selectedAnnIdRef.current = clicked.id; setSelectedAnnId?.(clicked.id);
        dragModeRef.current      = 'move';     setDragMode('move');
        activeHandleRef.current  = null;       setActiveHandle(null);
        dragAnnIdRef.current     = clicked.id;
        dragStartAnnRef.current  = clicked;
        dragStartMouseRef.current = { x, y };
        isDrawing.current        = true;
        beginTransientDrag(clicked.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onNativeMove);
        window.addEventListener('pointerup',   onNativeUp);
        return;
      }

      selectedAnnIdRef.current = null; setSelectedAnnId?.(null);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeDrawTool === 'eraser') {
      isDrawing.current = true;
      doErase({ x, y }, annotations, onChange, propsRef.current.eraserSize ?? 35);
      window.addEventListener('pointermove', onNativeEraseMove);
      window.addEventListener('pointerup',   onNativeEraseUp);
      return;
    }

    if (activeDrawTool === 'text') {
      const newAnn: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'text', color: activeColor, strokeWidth, opacity: activeOpacity,
        text: '', fontFamily: fontFamily || 'Space Grotesk', fontSize: fontSize || 36,
        fontWeight: fontWeight || 'bold', fontStyle: fontStyle || 'normal',
        textDecoration: textDecoration || 'none', textAlign: textAlign || 'center',
        lineHeight: lineHeight || 1.2, letterSpacing: letterSpacing || 0,
        bounds: { x: Math.max(0, x - 125), y: Math.max(0, y - 50), w: 250, h: 100 },
      };
      onChange([...annotations, newAnn]);
      setSelectedAnnId?.(newAnn.id);
      setActiveDrawTool?.('select');
      return;
    }

    if (activeDrawTool === 'emoji') return;

    isDrawing.current = true;
    startPos.current  = { x, y };

    const isPointShape = ['freehand','arrow','doubleArrow','line','highlighter','textPath'].includes(activeDrawTool);
    const newAnn: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: activeDrawTool,
      color: activeColor,
      opacity: activeDrawTool === 'highlighter' ? 0.4 : activeOpacity,
      strokeWidth: activeDrawTool === 'highlighter' ? strokeWidth * 2.5 : strokeWidth,
      ...(isPointShape ? { points: [{ x, y }] } : { bounds: { x, y, w: 0, h: 0 } }),
      ...(activeDrawTool === 'textPath' ? { doodleText: doodleText||'peace in the air', fontSize: doodleFontSize||18, fontFamily: doodleFontFamily||'Space Grotesk', showGuidePath: showDoodleGuide !== false } : {}),
      ...(activeDrawTool === 'freehand' ? { penStyle: propsRef.current.penSettings?.style??'solid', closePath: propsRef.current.penSettings?.closeFill??false, fillOpacity: propsRef.current.penSettings?.fillOpacity??0.5, arrowEnd: propsRef.current.penSettings?.arrowEnd??false } : {}),
    };
    currentAnnRef.current = newAnn;
    setCurrentAnn(newAnn);
  };

  // ─── Drawing stroke handlers (SVG synthetic — fine for drawing) ───────────

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    if (dragModeRef.current !== 'none' || rotatingAnnIdRef.current) return; // handled natively
    if (propsRef.current.activeDrawTool === 'eraser') return; // handled natively
    if (propsRef.current.activeDrawTool !== 'select') {
      const r = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 1000;
      const y = ((e.clientY - r.top)  / r.height) * 1000;
      const cur = currentAnnRef.current;
      if (!cur) return;
      let next: Annotation | null = null;
      if ((cur.type==='freehand'||cur.type==='highlighter'||cur.type==='textPath') && cur.points) {
        next = { ...cur, points: [...cur.points, { x, y }] };
      } else if ((cur.type==='arrow'||cur.type==='doubleArrow'||cur.type==='line') && cur.points) {
        next = { ...cur, points: [cur.points[0], { x, y }] };
      } else if (cur.bounds) {
        next = { ...cur, bounds: { x: startPos.current.x, y: startPos.current.y, w: x-startPos.current.x, h: y-startPos.current.y } };
      }
      if (next) { currentAnnRef.current = next; setCurrentAnn(next); }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Drag/rotate is cleaned up by onNativeUp — only handle drawing here
    if (dragModeRef.current !== 'none' || rotatingAnnIdRef.current) return;
    if (propsRef.current.activeDrawTool === 'eraser' || propsRef.current.activeDrawTool === 'select') {
      isDrawing.current = false;
      propsRef.current.onEndGesture?.();
      return;
    }

    isDrawing.current = false;
    propsRef.current.onEndGesture?.();

    const finalAnn = currentAnnRef.current ?? currentAnn;
    if (finalAnn) {
      let valid = true;
      if (['freehand','highlighter','arrow','doubleArrow','line','textPath'].includes(finalAnn.type) && finalAnn.points && finalAnn.points.length < 2) valid = false;
      if (finalAnn.bounds && Math.abs(finalAnn.bounds.w) < 3 && Math.abs(finalAnn.bounds.h) < 3) valid = false;
      if (valid) onChange([...annotations, finalAnn]);
    }
    currentAnnRef.current = null;
    setCurrentAnn(null);
  };

  // ─── Native eraser handlers ───────────────────────────────────────────────

  const onNativeEraseMove = (e: PointerEvent) => {
    if (!svgRef.current) return;
    const { x, y } = clientToSvg(svgRef.current, e.clientX, e.clientY);
    doErase({ x, y }, propsRef.current.annotations, propsRef.current.onChange, propsRef.current.eraserSize ?? 35);
  };

  const onNativeEraseUp = () => {
    window.removeEventListener('pointermove', onNativeEraseMove);
    window.removeEventListener('pointerup',   onNativeEraseUp);
    isDrawing.current = false;
    propsRef.current.onEndGesture?.();
  };

  // ─── Transform handle starters ────────────────────────────────────────────

  const handleTextRotateStart = (e: React.PointerEvent, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation(); e.preventDefault();
    const ann = propsRef.current.annotations.find(a => a.id === annId);
    if (!ann) return;

    let cX = 0, cY = 0;
    const el = document.getElementById(`text-layer-${annId}`) || document.getElementById(`ann-layer-${annId}`);
    if (el) { const r = el.getBoundingClientRect(); cX = r.left + r.width/2; cY = r.top + r.height/2; }
    else if (svgRef.current) {
      const r = svgRef.current.getBoundingClientRect();
      const bbox = getAnnotationBBox(ann);
      cX = r.left + (bbox.x + bbox.w/2) * (r.width/1000);
      cY = r.top  + (bbox.y + bbox.h/2) * (r.height/1000);
    }

    rotateStartRef.current     = { centerX: cX, centerY: cY, startRotation: ann.rotation||0, startAngleRad: Math.atan2(e.clientY-cY, e.clientX-cX) };
    rotatingAnnIdRef.current   = annId; setRotatingAnnId(annId);
    dragAnnIdRef.current       = annId;
    isDrawing.current          = true;

    if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  const handleTextResizeStart = (e: React.PointerEvent, handleId: HandleId, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation(); e.preventDefault();
    const ann = propsRef.current.annotations.find(a => a.id === annId);

    dragModeRef.current      = 'resize-edge'; setDragMode('resize-edge');
    activeHandleRef.current  = handleId;      setActiveHandle(handleId);
    selectedAnnIdRef.current = annId;         setSelectedAnnId?.(annId);
    dragAnnIdRef.current     = annId;
    dragStartAnnRef.current  = ann ?? null;
    isDrawing.current        = true;

    if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  const handleTextMoveStart = (e: React.PointerEvent, annId: string) => {
    propsRef.current.onStartGesture?.();
    e.stopPropagation(); e.preventDefault();
    if (!svgRef.current) return;
    const ann = propsRef.current.annotations.find(a => a.id === annId);
    const r   = svgRef.current.getBoundingClientRect();
    const sx  = ((e.clientX - r.left) / r.width)  * 1000;
    const sy  = ((e.clientY - r.top)  / r.height) * 1000;

    dragModeRef.current      = 'move'; setDragMode('move');
    activeHandleRef.current  = null;   setActiveHandle(null);
    selectedAnnIdRef.current = annId;  setSelectedAnnId?.(annId);
    dragAnnIdRef.current     = annId;
    dragStartAnnRef.current  = ann ?? null;
    dragStartMouseRef.current = { x: sx, y: sy };
    isDrawing.current        = true;
    beginTransientDrag(annId);

    if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  // ─── Misc ─────────────────────────────────────────────────────────────────

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => { e.preventDefault(); };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 1000;
      const y = ((e.clientY - r.top)  / r.height) * 1000;
      const hit = [...annotations].reverse().find(a => getAnnotationDistance({ x, y }, a) < 35);
      if (hit) { setSelectedAnnId?.(hit.id); setActiveDrawTool?.('select'); }
    }
  };

  return {
    currentAnn, svgRef,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleDoubleClick, handleContextMenu,
    handleTextRotateStart, handleTextResizeStart, handleTextMoveStart,
  };
};

// ─── Eraser helper ────────────────────────────────────────────────────────────

function doErase(pos: { x: number; y: number }, anns: Annotation[], emit: (n: Annotation[]) => void, radius: number) {
  const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'];
  const next: Annotation[] = [];
  let changed = false;
  for (const ann of anns) {
    const result = partialEraseAnnotation(ann, pos, radius);
    if (result.length !== 1 || result[0] !== ann) { changed = true; }
    else if (!STROKE_TYPES.includes(ann.type) && getAnnotationDistance(pos, ann) < radius) { changed = true; continue; }
    next.push(...result);
  }
  if (changed) emit(next);
}
