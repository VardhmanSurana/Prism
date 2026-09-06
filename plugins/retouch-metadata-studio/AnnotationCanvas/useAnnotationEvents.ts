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
import {
  getAnnotationDistance,
  detectHandleClick,
  getAnnotationBBox,
  getSvgRotationTransform,
  generateSmoothSpline,
  constructVariableWidthRibbon,
  findClosestSegmentIndex,
  pointDistance,
  smoothPath,
  doodleLinePoints,
  partialEraseAnnotation,
  generateSprayDots,
} from './utils';

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
      case 'tm': { const cy=Math.min(y,ny+nh-10); nb={x:b.x,y:cy,w:b.w,h:b.h+(ny-cy)}; break; }
      case 'bm': nb={x:b.x,y:b.y,w:b.w,h:Math.max(10,y-ny)}; break;
    }
    return { ...ann, bounds: nb };
  }
  if (ann.points?.length || ann.sprayDots?.length) {
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
      case 'tm': { const cy=Math.min(y,bbox.y+bbox.h-10); nb={x:bbox.x,y:cy,w:bbox.w,h:bbox.h+(bbox.y-cy)}; break; }
      case 'bm': nb={x:bbox.x,y:bbox.y,w:bbox.w,h:Math.max(10,y-bbox.y)}; break;
    }
    const sx = bbox.w > 0 ? nb.w/bbox.w : 1, sy = bbox.h > 0 ? nb.h/bbox.h : 1;
    return {
      ...ann,
      points: ann.points?.map(p => ({ x: nb.x+(p.x-bbox.x)*sx, y: nb.y+(p.y-bbox.y)*sy })),
      sprayDots: ann.sprayDots?.map(d => ({ x: nb.x+(d.x-bbox.x)*sx, y: nb.y+(d.y-bbox.y)*sy, r: Math.max(0.4, d.r * Math.sqrt(Math.abs(sx * sy))) })),
    };
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
  const sprayIntervalRef = useRef<any>(null);
  const sprayLastPosRef  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (sprayIntervalRef.current) {
        clearInterval(sprayIntervalRef.current);
        sprayIntervalRef.current = null;
      }
    };
  }, []);

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
  const rotateStartRef    = useRef<{ centerX: number; centerY: number; startRotation: number; startAngleRad: number; cx: number; cy: number; aspect: number; ax: number; ay: number } | null>(null);
  // ponytail: coalesce pointermove to 1 emit/frame; all transforms are absolute so dropping frames is lossless
  const rafIdRef          = useRef<number | null>(null);
  const pendingMoveRef    = useRef<{ clientX: number; clientY: number } | null>(null);
  // ponytail: last live pointer pos — pending is empty if the user pauses before release, commit must still land
  const lastPosRef        = useRef<{ clientX: number; clientY: number } | null>(null);
  // ponytail: transient drag writes ONLY through channels React never manages
  // (SVG transform attrs + CSS translate/scale/rotate individual props).
  // Writing React-managed props (left/top/width/height/transform) would be
  // clobbered back to committed values by any mid-drag re-render.
  const dragSvgNodesRef    = useRef<{ node: SVGGElement; base: string }[]>([]);
  const dragHtmlNodeRef   = useRef<HTMLElement | null>(null);
  const dragBarOnlyRef    = useRef(false);
  const dragRectRef       = useRef<{ width: number; height: number } | null>(null);
  // ponytail: original normalized bbox for resize — scale-about-fixed-corner reproduces applyResize exactly
  const dragObRef         = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const hasMovedRef       = useRef(false);

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
    lastPosRef.current = null;
  }

  // ─── Transient move (Excalidraw pattern: mutate view directly, commit state once) ──

  function beginTransientDrag(annId: string) {
    lastPosRef.current = null;
    hasMovedRef.current = false;
    const svg = svgRef.current;
    dragSvgNodesRef.current = svg
      ? (Array.from(svg.querySelectorAll(`[data-ann-id="${annId}"]`)) as SVGGElement[])
          .map(node => ({ node, base: node.getAttribute('transform') ?? '' }))
      : [];
    // ponytail: strokes/lines expose a bare floating bar (no box overlay) — it rides the same transient path
    dragHtmlNodeRef.current =
      document.getElementById(`stroke-bar-${annId}`) ?? document.getElementById(`ann-layer-${annId}`)
        ?? document.getElementById(`text-layer-${annId}`);
    dragBarOnlyRef.current = (dragHtmlNodeRef.current?.id ?? '').startsWith('stroke-bar-');
    const startAnn = dragStartAnnRef.current;
    dragObRef.current = startAnn ? getAnnotationBBox(startAnn) : null;
    const r = svg?.getBoundingClientRect();
    dragRectRef.current = r && r.width > 0 ? { width: r.width, height: r.height } : null;
  }

  function applyTransientMove(dx: number, dy: number) {
    // SVG user units (0-1000 space) — exact, no React involved; existing rotation preserved
    for (const { node, base } of dragSvgNodesRef.current) {
      node.setAttribute('transform', `translate(${dx} ${dy})${base ? ` ${base}` : ''}`);
    }
    let html = dragHtmlNodeRef.current;
    if (!html) {
      const annId = dragAnnIdRef.current;
      if (annId) {
        html = document.getElementById(`stroke-bar-${annId}`)
          ?? document.getElementById(`ann-layer-${annId}`)
          ?? document.getElementById(`text-layer-${annId}`);
        dragHtmlNodeRef.current = html;
        dragBarOnlyRef.current = (html?.id ?? '').startsWith('stroke-bar-');
      }
    }
    let rect = dragRectRef.current;
    if (!rect && svgRef.current) {
      const r = svgRef.current.getBoundingClientRect();
      if (r && r.width > 0) {
        rect = { width: r.width, height: r.height };
        dragRectRef.current = rect;
      }
    }
    if (html && rect) {
      const pxX = (dx / 1000) * rect.width;
      const pxY = (dy / 1000) * rect.height;
      // CSS `translate` moves the layer by the exact pixel delta without doubling or clobbering inline transforms
      html.style.translate = `${pxX}px ${pxY}px`;
    }
  }

  function clearTransientMove() {
    for (const { node, base } of dragSvgNodesRef.current) {
      if (base) node.setAttribute('transform', base);
      else node.removeAttribute('transform');
      if (node.classList.contains('selection-handles')) {
        node.querySelectorAll('circle').forEach(c => {
          const orig = c.getAttribute('data-orig-r');
          if (orig !== null) {
            if (orig) c.setAttribute('r', orig);
            else c.removeAttribute('r');
            c.removeAttribute('data-orig-r');
          }
        });
      }
    }
    const html = dragHtmlNodeRef.current;
    if (html) {
      html.style.translate = '';
      html.style.scale = '';
      html.style.rotate = '';
      html.style.transformOrigin = '';
      for (const child of Array.from(html.children)) {
        (child as HTMLElement).style.scale = '';
      }
      const label = html.querySelector('[data-rot-label]') as HTMLElement | null;
      if (label) {
        const startRot = rotateStartRef.current?.startRotation ?? 0;
        label.style.display = startRot !== 0 ? 'inline' : 'none';
        label.textContent = `${startRot}°`;
      }
    }
    dragSvgNodesRef.current = [];
    dragHtmlNodeRef.current = null;
    dragBarOnlyRef.current = false;
    dragRectRef.current = null;
    dragObRef.current = null;
  }

  function totalRotation(clientX: number, clientY: number): number | null {
    const rs = rotateStartRef.current;
    if (!rs) return null;
    const angle = Math.atan2(clientY - rs.centerY, clientX - rs.centerX);
    const rot = Math.round(rs.startRotation + (angle - rs.startAngleRad) * (180 / Math.PI));
    return ((rot % 360) + 360) % 360;
  }

  function applyTransientRotate(rot: number) {
    const rs = rotateStartRef.current;
    if (!rs) return;
    // Exact same aspect-corrected matrix the committed render uses
    const t = getSvgRotationTransform(rot, rs.cx, rs.cy, rs.aspect);
    for (const { node } of dragSvgNodesRef.current) {
      if (t) node.setAttribute('transform', t);
      else node.removeAttribute('transform');
    }
    // Overlay: individual `rotate` DELTA composes with (not clobbered by) the committed transform
    let html = dragHtmlNodeRef.current;
    if (!html) {
      const annId = dragAnnIdRef.current;
      if (annId) {
        html = document.getElementById(`stroke-bar-${annId}`)
          ?? document.getElementById(`ann-layer-${annId}`)
          ?? document.getElementById(`text-layer-${annId}`);
        dragHtmlNodeRef.current = html;
        dragBarOnlyRef.current = (html?.id ?? '').startsWith('stroke-bar-');
      }
    }
    if (!html) return;
    const label = html.querySelector('[data-rot-label]') as HTMLElement | null;
    if (label) {
      label.style.display = rot !== 0 ? 'inline' : 'none';
      label.textContent = `${rot}°`;
    }
    if (dragBarOnlyRef.current) {
      // ponytail: bare bar has no box to rotate — track its anchor orbiting the bbox center
      const rect = dragRectRef.current;
      if (!rect || rect.width === 0) return;
      const dRad = ((rot - rs.startRotation) * Math.PI) / 180;
      const cos = Math.cos(dRad), sin = Math.sin(dRad);
      const relX = rs.ax - rs.cx, relY = rs.ay - rs.cy;
      const dx = (relX * cos - relY * sin - relX) / 1000 * rect.width;
      const dy = (relX * sin + relY * cos - relY) / 1000 * rect.height;
      html.style.translate = `${dx}px ${dy}px`;
      return;
    }
    html.style.rotate = `${rot - rs.startRotation}deg`;
  }

  function commitRotate(clientX: number, clientY: number) {
    const rot = totalRotation(clientX, clientY);
    const rotating = rotatingAnnIdRef.current;
    if (rot === null || !rotating) return;
    const html = dragHtmlNodeRef.current;
    if (html && !dragBarOnlyRef.current) {
      html.style.transform = `rotate(${rot}deg)`;
      html.style.rotate = '';
    }
    clearTransientMove();
    const anns = propsRef.current.annotations;
    const emit = propsRef.current.onChange;
    emit(anns.map(a => a.id === rotating ? { ...a, rotation: rot } : a));
  }

  // ─── Transient resize: scale-about-fixed-corner === applyResize math ──

  const OPP_CORNER: Record<string, 'tl' | 'tr' | 'bl' | 'br' | 'lm' | 'rm' | 'tm' | 'bm'> =
    { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl', lm: 'rm', rm: 'lm', tm: 'bm', bm: 'tm' };

  function cornerOf(b: { x: number; y: number; w: number; h: number }, c: string) {
    switch (c) {
      case 'tr': return { x: b.x + b.w, y: b.y };
      case 'bl': return { x: b.x, y: b.y + b.h };
      case 'br': return { x: b.x + b.w, y: b.y + b.h };
      case 'lm': return { x: b.x, y: b.y + b.h / 2 };
      case 'rm': return { x: b.x + b.w, y: b.y + b.h / 2 };
      case 'tm': return { x: b.x + b.w / 2, y: b.y };
      case 'bm': return { x: b.x + b.w / 2, y: b.y + b.h };
      default: return { x: b.x, y: b.y };
    }
  }

  function transientResizeEdge(handle: HandleId, x: number, y: number) {
    const startAnn = dragStartAnnRef.current;
    const ob = dragObRef.current;
    if (!startAnn || !ob || ob.w === 0 || ob.h === 0) return;
    const nb = getAnnotationBBox(applyResize(startAnn, handle, x, y));
    if (nb.w === 0 || nb.h === 0) return;
    const sx = nb.w / ob.w, sy = nb.h / ob.h;
    const F = cornerOf(ob, OPP_CORNER[handle] ?? 'tl');
    const t = `translate(${F.x} ${F.y}) scale(${sx} ${sy}) translate(${-F.x} ${-F.y})`;
    for (const { node, base } of dragSvgNodesRef.current) {
      node.setAttribute('transform', base ? `${t} ${base}` : t);
    }
    // Overlay divs: translate+scale deltas about the top-left corner.
    // (Never left/top/width/height — those are React-managed and any
    // mid-drag re-render would snap the box back, detaching it from the shape.)
    const html = dragHtmlNodeRef.current;
    const rect = dragRectRef.current;
    if (html && rect && rect.width > 0 && rect.height > 0) {
      const obPxX = (ob.x / 1000) * rect.width, obPxY = (ob.y / 1000) * rect.height;
      const nbPxX = (nb.x / 1000) * rect.width, nbPxY = (nb.y / 1000) * rect.height;
      html.style.transformOrigin = '0 0';
      html.style.translate = `${nbPxX - obPxX}px ${nbPxY - obPxY}px`;
      html.style.scale = `${sx} ${sy}`;
      // ponytail: chrome (brackets, pills, action bar) counter-scales so only
      // the box follows the shape — handles keep constant screen size
      const inv = `${1 / sx} ${1 / sy}`;
      for (const child of Array.from(html.children)) {
        (child as HTMLElement).style.scale = inv;
      }
    }
    // Endpoint dots keep constant radius under the box scale
    const avg = Math.max(sx, sy);
    for (const { node } of dragSvgNodesRef.current) {
      if (node.classList.contains('selection-handles')) {
        node.querySelectorAll('circle').forEach(c => {
          if (!c.hasAttribute('data-orig-r')) c.setAttribute('data-orig-r', c.getAttribute('r') ?? '');
          c.setAttribute('r', `${(parseFloat(c.getAttribute('data-orig-r') || '8')) / avg}`);
        });
      }
    }
  }

  function commitResizeEdge(handle: HandleId, x: number, y: number) {
    const startAnn = dragStartAnnRef.current;
    const annId = dragAnnIdRef.current;
    if (!startAnn || !annId) return;
    const next = applyResize(startAnn, handle, x, y);
    clearTransientMove();
    const anns = propsRef.current.annotations;
    propsRef.current.onChange(anns.map(a => a.id === annId ? next : a));
  }

  // ─── Transient endpoint drag: line/polygon coords written directly ──

  function arrowHeadPoints(tipX: number, tipY: number, angle: number, headLength: number, flip: boolean) {
    const s = flip ? 1 : -1;
    return `${tipX},${tipY} ${tipX + s * headLength * Math.cos(angle - Math.PI / 6)},${tipY + s * headLength * Math.sin(angle - Math.PI / 6)} ${tipX + s * headLength * Math.cos(angle + Math.PI / 6)},${tipY + s * headLength * Math.sin(angle + Math.PI / 6)}`;
  }

  function transientResizeEndpoint(handle: HandleId, x: number, y: number) {
    const startAnn = dragStartAnnRef.current;
    if (!startAnn?.points || startAnn.points.length < 2) return;
    const pts = [...startAnn.points];
    const ptIndex = handle.startsWith('ep') ? parseInt(handle.replace('ep', ''), 10) : 0;
    if (isNaN(ptIndex) || ptIndex < 0 || ptIndex >= pts.length) return;
    pts[ptIndex] = { x, y };

    const p0 = pts[0], p1 = pts[pts.length - 1];
    const wrap = dragSvgNodesRef.current.find(({ node }) => !node.classList.contains('selection-handles'))?.node
      ?? dragSvgNodesRef.current[0]?.node;
    const handles = dragSvgNodesRef.current.find(({ node }) => node.classList.contains('selection-handles'))?.node;
    const sw = (startAnn.strokeWidth || 3) * 1.5;

    if (wrap) {
      if (pts.length > 2 || (startAnn.lineTaper && startAnn.lineTaper !== 'none') || startAnn.doodleLineStyle) {
        let spine: { x: number; y: number }[];
        if (pts.length > 2) {
          spine = generateSmoothSpline(pts, 24);
        } else if (startAnn.doodleLineStyle) {
          spine = smoothPath(doodleLinePoints(pts[0], pts[1], startAnn.doodleLineStyle));
        } else {
          spine = generateSmoothSpline(pts, 24);
        }

        const path = wrap.querySelector('path');
        if (path) {
          if (startAnn.lineTaper && startAnn.lineTaper !== 'none') {
            const ribbonD = constructVariableWidthRibbon(spine, sw, startAnn.lineTaper, startAnn.doodleLineStyle);
            path.setAttribute('d', ribbonD);
          } else {
            const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            path.setAttribute('d', d);
          }
        }

        if (startAnn.type === 'arrow' || startAnn.type === 'doubleArrow') {
          const polys = wrap.querySelectorAll('polygon');
          const headLength = Math.max(20, (startAnn.strokeWidth || 3) * 4);
          const tip = spine[spine.length - 1];
          const prev = spine[Math.max(0, spine.length - 3)];
          const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
          const xLeft = tip.x - headLength * Math.cos(ang - Math.PI / 6);
          const yLeft = tip.y - headLength * Math.sin(ang - Math.PI / 6);
          const xRight = tip.x - headLength * Math.cos(ang + Math.PI / 6);
          const yRight = tip.y - headLength * Math.sin(ang + Math.PI / 6);
          polys[0]?.setAttribute('points', `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${xLeft.toFixed(1)},${yLeft.toFixed(1)} ${xRight.toFixed(1)},${yRight.toFixed(1)}`);

          if (startAnn.type === 'doubleArrow' && polys[1]) {
            const tip0 = spine[0];
            const next0 = spine[Math.min(spine.length - 1, 2)];
            const a0 = Math.atan2(tip0.y - next0.y, tip0.x - next0.x);
            const xLeft0 = tip0.x - headLength * Math.cos(a0 - Math.PI / 6);
            const yLeft0 = tip0.y - headLength * Math.sin(a0 - Math.PI / 6);
            const xRight0 = tip0.x - headLength * Math.cos(a0 + Math.PI / 6);
            const yRight0 = tip0.y - headLength * Math.sin(a0 + Math.PI / 6);
            polys[1].setAttribute('points', `${tip0.x.toFixed(1)},${tip0.y.toFixed(1)} ${xLeft0.toFixed(1)},${yLeft0.toFixed(1)} ${xRight0.toFixed(1)},${yRight0.toFixed(1)}`);
          }
        }
      } else {
        const line = wrap.querySelector('line');
        const polys = wrap.querySelectorAll('polygon');
        if (startAnn.type === 'line') {
          line?.setAttribute('x1', `${p0.x}`); line?.setAttribute('y1', `${p0.y}`);
          line?.setAttribute('x2', `${p1.x}`); line?.setAttribute('y2', `${p1.y}`);
        } else {
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const headLength = Math.max(20, (startAnn.strokeWidth || 3) * 4);
          const xBase = p1.x - headLength * Math.cos(angle) * 0.8;
          const yBase = p1.y - headLength * Math.sin(angle) * 0.8;
          line?.setAttribute('x1', `${p0.x}`); line?.setAttribute('y1', `${p0.y}`);
          if (startAnn.type === 'doubleArrow') {
            const xBase0 = p0.x + headLength * Math.cos(angle) * 0.8;
            const yBase0 = p0.y + headLength * Math.sin(angle) * 0.8;
            const xBase1 = p1.x - headLength * Math.cos(angle) * 0.8;
            const yBase1 = p1.y - headLength * Math.sin(angle) * 0.8;
            line?.setAttribute('x1', `${xBase0}`); line?.setAttribute('y1', `${yBase0}`);
            line?.setAttribute('x2', `${xBase1}`); line?.setAttribute('y2', `${yBase1}`);
            polys[0] && polys[0].setAttribute('points', arrowHeadPoints(p1.x, p1.y, angle, headLength, false));
            polys[1] && polys[1].setAttribute('points', arrowHeadPoints(p0.x, p0.y, angle, headLength, true));
          } else {
            line?.setAttribute('x2', `${xBase}`); line?.setAttribute('y2', `${yBase}`);
            polys[0] && polys[0].setAttribute('points', arrowHeadPoints(p1.x, p1.y, angle, headLength, false));
          }
        }
      }
    }
    if (handles) {
      const circles = handles.querySelectorAll('circle');
      // ponytail: strokes render first/last dots only — clamp multi-point indices
      const ci = ptIndex >= circles.length ? circles.length - 1 : ptIndex;
      circles[ci]?.setAttribute('cx', `${x}`);
      circles[ci]?.setAttribute('cy', `${y}`);
    }
  }

  function commitResizeEndpoint(handle: HandleId, x: number, y: number) {
    const startAnn = dragStartAnnRef.current;
    const annId = dragAnnIdRef.current;
    if (!startAnn?.points || startAnn.points.length < 2 || !annId) return;
    const pts = [...startAnn.points];
    const ptIndex = handle.startsWith('ep') ? parseInt(handle.replace('ep', ''), 10) : 0;
    if (isNaN(ptIndex) || ptIndex < 0 || ptIndex >= pts.length) return;
    pts[ptIndex] = { x, y };
    const next = { ...startAnn, points: pts };
    clearTransientMove();
    const anns = propsRef.current.annotations;
    propsRef.current.onChange(anns.map(a => a.id === annId ? next : a));
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
    } else if (startAnn.points || startAnn.sprayDots) {
      next = {
        ...startAnn,
        points: startAnn.points?.map(p => ({ x: p.x + dx, y: p.y + dy })),
        sprayDots: startAnn.sprayDots?.map(d => ({ ...d, x: d.x + dx, y: d.y + dy })),
      };
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
    lastPosRef.current = pendingMoveRef.current;
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
    hasMovedRef.current = true;

    const rotating = rotatingAnnIdRef.current;
    const mode     = dragModeRef.current;
    const handle   = activeHandleRef.current;

    // ── Rotate (transient — zero setState until pointerup) ──
    if (rotating && rotateStartRef.current) {
      const rot = totalRotation(clientX, clientY);
      if (rot !== null) applyTransientRotate(rot);
      return;
    }

    const annId = dragAnnIdRef.current;
    if (!annId) return;
    const { x, y } = clientToSvg(svgRef.current, clientX, clientY);

    if (mode === 'move') {
      // Transient: write straight to the DOM — zero setState until pointerup
      const startMouse = dragStartMouseRef.current;
      const startAnn   = dragStartAnnRef.current;
      if (!startAnn) return;
      applyTransientMove(x - startMouse.x, y - startMouse.y);
      return;
    } else if (mode === 'resize-edge' && handle) {
      transientResizeEdge(handle, x, y);
      return;
    } else if (mode === 'resize-endpoint' && handle) {
      transientResizeEndpoint(handle, x, y);
      return;
    }
  }

  function onNativeUp(e: PointerEvent) {
    // Flush the last coalesced position so the drop point is exact.
    // Move/rotate commit once (transient DOM transform → single state update).
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    // Commit from the last live position, not just the unflushed one —
    // a pause before release leaves pending empty but the drag is still real
    const pos = pending ?? lastPosRef.current;
    lastPosRef.current = null;
    if (rotatingAnnIdRef.current) {
      if (pos) commitRotate(pos.clientX, pos.clientY);
      else clearTransientMove();
    } else if (dragModeRef.current === 'move' && dragAnnIdRef.current) {
      if (pos) commitMove(pos.clientX, pos.clientY);
      else clearTransientMove();
    } else if (dragModeRef.current === 'resize-edge' && activeHandleRef.current && dragAnnIdRef.current) {
      if (pos && svgRef.current) {
        const { x, y } = clientToSvg(svgRef.current, pos.clientX, pos.clientY);
        commitResizeEdge(activeHandleRef.current, x, y);
      } else clearTransientMove();
    } else if (dragModeRef.current === 'resize-endpoint' && activeHandleRef.current && dragAnnIdRef.current) {
      if (pos && svgRef.current) {
        const { x, y } = clientToSvg(svgRef.current, pos.clientX, pos.clientY);
        commitResizeEndpoint(activeHandleRef.current, x, y);
      } else clearTransientMove();
    } else if (pending) {
      flushMove(pending.clientX, pending.clientY);
    }
    if (!hasMovedRef.current && !e.shiftKey && dragAnnIdRef.current) {
      const curIds = (propsRef.current.selectedAnnIds && propsRef.current.selectedAnnIds.length > 0)
        ? propsRef.current.selectedAnnIds
        : (propsRef.current.selectedAnnId ? [propsRef.current.selectedAnnId] : []);
      if (curIds.length > 1 && curIds.includes(dragAnnIdRef.current)) {
        propsRef.current.setSelectedAnnIds?.([dragAnnIdRef.current]);
        propsRef.current.setSelectedAnnId?.(dragAnnIdRef.current);
      }
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
      const curSelIds = (propsRef.current.selectedAnnIds && propsRef.current.selectedAnnIds.length > 0)
        ? propsRef.current.selectedAnnIds
        : (propsRef.current.selectedAnnId ? [propsRef.current.selectedAnnId] : []);

      // 1. Hit-test handle on any currently selected annotation (only when not shift-clicking)
      if (!e.shiftKey) {
        for (const selId of curSelIds) {
          const selAnn = annotations.find(a => a.id === selId);
          if (selAnn) {
            const handleId = detectHandleClick(x, y, selAnn);
            if (handleId) {
              const nextMode = handleId.startsWith('ep') ? 'resize-endpoint' : 'resize-edge';
              dragModeRef.current     = nextMode; setDragMode(nextMode);
              activeHandleRef.current = handleId; setActiveHandle(handleId);
              dragAnnIdRef.current    = selAnn.id;
              dragStartAnnRef.current = selAnn;
              isDrawing.current       = true;
              beginTransientDrag(selAnn.id);
              e.currentTarget.setPointerCapture(e.pointerId);
              window.addEventListener('pointermove', onNativeMove);
              window.addEventListener('pointerup',   onNativeUp);
              return;
            }

            // If the selected annotation is a line or arrow, and user clicks on its body:
            // Insert a new control point at (x, y) and start dragging it!
            if ((selAnn.type === 'line' || selAnn.type === 'arrow' || selAnn.type === 'doubleArrow') && selAnn.points && selAnn.points.length >= 2) {
              const dist = getAnnotationDistance({ x, y }, selAnn);
              if (dist < 28) {
                const segIdx = findClosestSegmentIndex({ x, y }, selAnn.points);
                const insertIdx = segIdx + 1;
                const newPts = [...selAnn.points];
                newPts.splice(insertIdx, 0, { x, y });
                const updatedAnn = { ...selAnn, points: newPts };

                propsRef.current.onChange(annotations.map(a => a.id === selAnn.id ? updatedAnn : a));

                const newHandleId = `ep${insertIdx}` as HandleId;
                dragModeRef.current     = 'resize-endpoint'; setDragMode('resize-endpoint');
                activeHandleRef.current = newHandleId;       setActiveHandle(newHandleId);
                dragAnnIdRef.current    = selAnn.id;
                dragStartAnnRef.current = updatedAnn;
                isDrawing.current       = true;
                beginTransientDrag(selAnn.id);
                e.currentTarget.setPointerCapture(e.pointerId);
                window.addEventListener('pointermove', onNativeMove);
                window.addEventListener('pointerup',   onNativeUp);
                return;
              }
            }
          }
        }
      }

      // 2. Hit-test any annotation on canvas
      const clicked = [...annotations].reverse().find(ann => getAnnotationDistance({ x, y }, ann) < 40);
      if (clicked) {
        if (e.shiftKey) {
          // Toggle clicked annotation in multi-selection (pure selection toggle, no dragging)
          const alreadySelected = curSelIds.includes(clicked.id);
          const nextSelected = alreadySelected
            ? curSelIds.filter(id => id !== clicked.id)
            : [...curSelIds, clicked.id];

          propsRef.current.setSelectedAnnIds?.(nextSelected);
          propsRef.current.setSelectedAnnId?.(nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] : null);
          return;
        }

        // Without shift:
        // If clicking an item that's already part of the current multi-selection, keep selection and allow moving
        if (curSelIds.includes(clicked.id)) {
          propsRef.current.setSelectedAnnId?.(clicked.id);
          dragModeRef.current       = 'move'; setDragMode('move');
          activeHandleRef.current   = null;   setActiveHandle(null);
          dragAnnIdRef.current      = clicked.id;
          dragStartAnnRef.current   = clicked;
          dragStartMouseRef.current = { x, y };
          isDrawing.current         = true;
          beginTransientDrag(clicked.id);
          e.currentTarget.setPointerCapture(e.pointerId);
          window.addEventListener('pointermove', onNativeMove);
          window.addEventListener('pointerup',   onNativeUp);
          return;
        }

        // Not already in selection: select only this item
        propsRef.current.setSelectedAnnIds?.([clicked.id]);
        propsRef.current.setSelectedAnnId?.(clicked.id);
        dragModeRef.current       = 'move'; setDragMode('move');
        activeHandleRef.current   = null;   setActiveHandle(null);
        dragAnnIdRef.current      = clicked.id;
        dragStartAnnRef.current   = clicked;
        dragStartMouseRef.current = { x, y };
        isDrawing.current         = true;
        beginTransientDrag(clicked.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onNativeMove);
        window.addEventListener('pointerup',   onNativeUp);
        return;
      }

      // 3. Clicked empty canvas
      if (!e.shiftKey) {
        propsRef.current.setSelectedAnnIds?.([]);
        propsRef.current.setSelectedAnnId?.(null);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeDrawTool === 'eraser') {
      isDrawing.current = true;
      const r = svgRef.current?.getBoundingClientRect();
      const currentAspect = r && r.width > 0 && r.height > 0 ? r.width / r.height : 1;
      const eraseRadius = (propsRef.current.eraserSize ?? 35) / 2;
      doErase({ x, y }, annotations, onChange, eraseRadius, currentAspect);
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

    if (sprayIntervalRef.current) {
      clearInterval(sprayIntervalRef.current);
      sprayIntervalRef.current = null;
    }

    isDrawing.current = true;
    startPos.current  = { x, y };

    const penSet = propsRef.current.penSettings;
    const activeBrush = penSet?.brushType ?? 'brush';
    const isSpray = activeDrawTool === 'freehand' && activeBrush === 'spray';
    const sprayRadius = penSet?.sprayRadius ?? Math.max(15, strokeWidth * 2.5);
    const sprayDensity = penSet?.sprayDensity ?? 12;

    const initialSprayDots = isSpray ? generateSprayDots(x, y, sprayRadius, sprayDensity) : undefined;
    if (isSpray) {
      sprayLastPosRef.current = { x, y };
    }

    const isPointShape = ['freehand','arrow','doubleArrow','line','highlighter','textPath'].includes(activeDrawTool);
    const newAnn: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: activeDrawTool,
      color: activeColor,
      opacity: activeDrawTool === 'highlighter' ? 0.4 : (isSpray ? (activeOpacity ?? 0.85) : activeOpacity),
      strokeWidth: activeDrawTool === 'highlighter' ? strokeWidth * 2.5 : strokeWidth,
      ...(isPointShape ? { points: [{ x, y }] } : { bounds: { x, y, w: 0, h: 0 } }),
      ...(activeDrawTool === 'textPath' ? { doodleText: doodleText||'peace in the air', fontSize: doodleFontSize||18, fontFamily: doodleFontFamily||'Space Grotesk', showGuidePath: showDoodleGuide !== false } : {}),
      ...(activeDrawTool === 'freehand' ? {
        penStyle: penSet?.style ?? 'solid',
        lineTaper: penSet?.taper ?? 'none',
        lineTexture: penSet?.texture ?? 'none',
        doodleLineStyle: penSet?.doodleStyle,
        arrowEnd: penSet?.arrowEnd ?? false,
        closePath: penSet?.closeFill ?? false,
        fillOpacity: penSet?.fillOpacity ?? 0.5,
        brushType: activeBrush,
        sprayDots: initialSprayDots,
        sprayRadius,
        sprayDensity,
        chalkPressure: penSet?.chalkPressure ?? 60,
        chalkGrain: penSet?.chalkGrain ?? 50,
        chalkRoughness: penSet?.chalkRoughness ?? 50,
        crayonDensity: penSet?.crayonDensity ?? 50,
        crayonGrain: penSet?.crayonGrain ?? 50,
        crayonRoughness: penSet?.crayonRoughness ?? 50,
        drybrushDensity: penSet?.drybrushDensity ?? 50,
        drybrushStreaks: penSet?.drybrushStreaks ?? 50,
        drybrushRoughness: penSet?.drybrushRoughness ?? 50,
        watercolorBleed: penSet?.watercolorBleed ?? 50,
        watercolorSpread: penSet?.watercolorSpread ?? 50,
        watercolorWetness: penSet?.watercolorWetness ?? 50,
        nibAngle: penSet?.nibAngle ?? (activeBrush === 'calligraphy2' ? -45 : 45),
        nibWeight: penSet?.nibWeight ?? 50,
        dashLength: penSet?.dashLength ?? 5,
        dashGap: penSet?.dashGap ?? 4,
        taperIntensity: penSet?.taperIntensity ?? 50,
        brushFeather: penSet?.brushFeather ?? 0,
      } : {}),
    };
    currentAnnRef.current = newAnn;
    setCurrentAnn(newAnn);

    if (isSpray) {
      sprayIntervalRef.current = setInterval(() => {
        const cur = currentAnnRef.current;
        if (!cur || !isDrawing.current || cur.brushType !== 'spray') return;
        const curPos = sprayLastPosRef.current;
        const moreDots = generateSprayDots(curPos.x, curPos.y, cur.sprayRadius || sprayRadius, Math.max(4, Math.round(sprayDensity * 0.7)));
        const updated: Annotation = {
          ...cur,
          sprayDots: [...(cur.sprayDots || []), ...moreDots],
        };
        currentAnnRef.current = updated;
        setCurrentAnn(updated);
      }, 40);
    }
  };

  // ─── Drawing stroke handlers (SVG synthetic — fine for drawing) ───────────

  // ponytail: hover cursor is written straight to the DOM — a state per mousemove would re-render every frame
  const HANDLE_CURSORS: Record<string, string> = {
    tl: 'nwse-resize', br: 'nwse-resize',
    tr: 'nesw-resize', bl: 'nesw-resize',
    tm: 'ns-resize', bm: 'ns-resize',
    lm: 'ew-resize', rm: 'ew-resize',
    ep0: 'crosshair', ep1: 'crosshair',
  };

  const updateHoverCursor = (e: React.PointerEvent<SVGSVGElement>) => {
    if (propsRef.current.activeDrawTool !== 'select') return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 1000;
    const anns = propsRef.current.annotations;
    const selId = selectedAnnIdRef.current;
    let cursor = 'default';
    if (selId) {
      const sel = anns.find(a => a.id === selId);
      if (sel) {
        const h = detectHandleClick(x, y, sel);
        if (h) {
          cursor = h.startsWith('ep') ? 'crosshair' : (HANDLE_CURSORS[h] ?? 'default');
        } else if ((sel.type === 'line' || sel.type === 'arrow' || sel.type === 'doubleArrow') && getAnnotationDistance({ x, y }, sel) < 28) {
          cursor = 'copy';
        } else if (getAnnotationDistance({ x, y }, sel) === 0) {
          cursor = 'move';
        }
      }
    }
    if (cursor === 'default' && anns.some(ann => getAnnotationDistance({ x, y }, ann) < 40)) {
      cursor = 'move';
    }
    e.currentTarget.style.cursor = cursor;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) { updateHoverCursor(e); return; }
    if (dragModeRef.current !== 'none' || rotatingAnnIdRef.current) return; // handled natively
    if (propsRef.current.activeDrawTool === 'eraser') return; // handled natively
    if (propsRef.current.activeDrawTool !== 'select') {
      const r = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 1000;
      const y = ((e.clientY - r.top)  / r.height) * 1000;
      const cur = currentAnnRef.current;
      if (!cur) return;
      let next: Annotation | null = null;
      if (cur.brushType === 'spray' && cur.sprayDots) {
        sprayLastPosRef.current = { x, y };
        const lastPt = cur.points && cur.points.length > 0 ? cur.points[cur.points.length - 1] : { x: 0, y: 0 };
        const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
        if (dist >= 3) {
          const newDots = generateSprayDots(x, y, cur.sprayRadius || 25, cur.sprayDensity || 12);
          next = {
            ...cur,
            points: [...(cur.points || []), { x, y }],
            sprayDots: [...cur.sprayDots, ...newDots],
          };
        }
      } else if ((cur.type==='freehand'||cur.type==='highlighter'||cur.type==='textPath') && cur.points) {
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
    if (sprayIntervalRef.current) {
      clearInterval(sprayIntervalRef.current);
      sprayIntervalRef.current = null;
    }

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
      if (finalAnn.brushType === 'spray' && finalAnn.sprayDots && finalAnn.sprayDots.length > 0) {
        valid = true;
      } else if (['freehand','highlighter','arrow','doubleArrow','line','textPath'].includes(finalAnn.type) && finalAnn.points && finalAnn.points.length < 2) {
        valid = false;
      }
      if (finalAnn.bounds && Math.abs(finalAnn.bounds.w) < 3 && Math.abs(finalAnn.bounds.h) < 3) valid = false;
      if (valid) onChange([...annotations, finalAnn]);
    }
    currentAnnRef.current = null;
    setCurrentAnn(null);
  };

  // ─── Native eraser handlers ───────────────────────────────────────────────

  const onNativeEraseMove = (e: PointerEvent) => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const currentAspect = r.width > 0 && r.height > 0 ? r.width / r.height : 1;
    const { x, y } = clientToSvg(svgRef.current, e.clientX, e.clientY);
    const eraseRadius = (propsRef.current.eraserSize ?? 35) / 2;
    doErase({ x, y }, propsRef.current.annotations, propsRef.current.onChange, eraseRadius, currentAspect);
  };

  const onNativeEraseUp = () => {
    window.removeEventListener('pointermove', onNativeEraseMove);
    window.removeEventListener('pointerup',   onNativeEraseUp);
    isDrawing.current = false;
    propsRef.current.onEndGesture?.();
  };

  // ─── Transform handle starters ────────────────────────────────────────────

  const handleTextRotateStart = (e: React.PointerEvent, annId: string) => {
    if (e.shiftKey) return;
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

    rotateStartRef.current     = { centerX: cX, centerY: cY, startRotation: ann.rotation||0, startAngleRad: Math.atan2(e.clientY-cY, e.clientX-cX), cx: 0, cy: 0, aspect: 1, ax: 0, ay: 0 };
    // Cache bbox center (SVG units) + aspect for the exact transient rotation matrix
    if (svgRef.current) {
      const r = svgRef.current.getBoundingClientRect();
      const bbox = getAnnotationBBox(ann);
      rotateStartRef.current.cx = bbox.x + bbox.w / 2;
      rotateStartRef.current.cy = bbox.y + bbox.h / 2;
      rotateStartRef.current.aspect = r.width > 0 && r.height > 0 ? r.width / r.height : 1;
      // ponytail: bare stroke-bar anchor (bbox bottom-center) for rotate tracking
      rotateStartRef.current.ax = bbox.x + bbox.w / 2;
      rotateStartRef.current.ay = bbox.y + bbox.h;
    }
    const curSelIds = (propsRef.current.selectedAnnIds && propsRef.current.selectedAnnIds.length > 0)
      ? propsRef.current.selectedAnnIds
      : (propsRef.current.selectedAnnId ? [propsRef.current.selectedAnnId] : []);
    if (!curSelIds.includes(annId)) {
      propsRef.current.setSelectedAnnIds?.([annId]);
    }
    selectedAnnIdRef.current = annId; propsRef.current.setSelectedAnnId?.(annId);
    rotatingAnnIdRef.current   = annId; setRotatingAnnId(annId);
    dragAnnIdRef.current       = annId;
    dragStartAnnRef.current    = ann ?? null;
    isDrawing.current          = true;
    beginTransientDrag(annId);
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    try {
      if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    } catch {}
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  const handleTextResizeStart = (e: React.PointerEvent, handleId: HandleId, annId: string) => {
    if (e.shiftKey) return;
    propsRef.current.onStartGesture?.();
    e.stopPropagation(); e.preventDefault();
    const ann = propsRef.current.annotations.find(a => a.id === annId);

    const curSelIds = (propsRef.current.selectedAnnIds && propsRef.current.selectedAnnIds.length > 0)
      ? propsRef.current.selectedAnnIds
      : (propsRef.current.selectedAnnId ? [propsRef.current.selectedAnnId] : []);
    if (!curSelIds.includes(annId)) {
      propsRef.current.setSelectedAnnIds?.([annId]);
    }
    selectedAnnIdRef.current = annId; propsRef.current.setSelectedAnnId?.(annId);

    dragModeRef.current      = 'resize-edge'; setDragMode('resize-edge');
    activeHandleRef.current  = handleId;      setActiveHandle(handleId);
    dragAnnIdRef.current     = annId;
    dragStartAnnRef.current  = ann ?? null;
    isDrawing.current        = true;
    beginTransientDrag(annId);

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    try {
      if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    } catch {}
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  const handleTextMoveStart = (e: React.PointerEvent, annId: string) => {
    if (e.shiftKey) return;
    propsRef.current.onStartGesture?.();
    e.stopPropagation(); e.preventDefault();
    if (!svgRef.current) return;
    const ann = propsRef.current.annotations.find(a => a.id === annId);
    const r   = svgRef.current.getBoundingClientRect();
    const sx  = ((e.clientX - r.left) / r.width)  * 1000;
    const sy  = ((e.clientY - r.top)  / r.height) * 1000;

    const curSelIds = (propsRef.current.selectedAnnIds && propsRef.current.selectedAnnIds.length > 0)
      ? propsRef.current.selectedAnnIds
      : (propsRef.current.selectedAnnId ? [propsRef.current.selectedAnnId] : []);
    if (!curSelIds.includes(annId)) {
      propsRef.current.setSelectedAnnIds?.([annId]);
    }
    selectedAnnIdRef.current = annId; propsRef.current.setSelectedAnnId?.(annId);

    dragModeRef.current      = 'move'; setDragMode('move');
    activeHandleRef.current  = null;   setActiveHandle(null);
    dragAnnIdRef.current     = annId;
    dragStartAnnRef.current  = ann ?? null;
    dragStartMouseRef.current = { x: sx, y: sy };
    isDrawing.current        = true;
    beginTransientDrag(annId);

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    try {
      if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    } catch {}
    window.addEventListener('pointermove', onNativeMove);
    window.addEventListener('pointerup',   onNativeUp);
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (propsRef.current.activeDrawTool !== 'select') return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 1000;

    const curSelId = selectedAnnIdRef.current || propsRef.current.selectedAnnId;
    if (!curSelId) return;
    const selAnn = propsRef.current.annotations.find(a => a.id === curSelId);
    if (!selAnn || !selAnn.points || selAnn.points.length <= 2) return;
    if (selAnn.type !== 'line' && selAnn.type !== 'arrow' && selAnn.type !== 'doubleArrow') return;

    // Check interior points only (1 to points.length - 2)
    for (let i = 1; i < selAnn.points.length - 1; i++) {
      if (pointDistance({ x, y }, selAnn.points[i]) < 35) {
        const newPts = selAnn.points.filter((_, idx) => idx !== i);
        const updatedAnn = { ...selAnn, points: newPts };
        propsRef.current.onChange(propsRef.current.annotations.map(a => a.id === selAnn.id ? updatedAnn : a));
        return;
      }
    }
  };

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

function doErase(
  pos: { x: number; y: number },
  anns: Annotation[],
  emit: (n: Annotation[]) => void,
  radius: number,
  aspectRatio: number = 1
) {
  const STROKE_TYPES = ['freehand', 'highlighter', 'textPath'];
  const next: Annotation[] = [];
  let changed = false;
  const ar = aspectRatio > 0 ? aspectRatio : 1;

  for (const ann of anns) {
    const result = partialEraseAnnotation(ann, pos, radius, ar);
    if (result.length !== 1 || result[0] !== ann) {
      changed = true;
    } else if (!STROKE_TYPES.includes(ann.type)) {
      const isUnfilledShape = ann.bounds && (!ann.fillShape || (ann.fillOpacity ?? 0) <= 0.05) && ann.type !== 'text';
      const dist = getAnnotationDistance(pos, ann, { strokeOnly: isUnfilledShape });
      if (dist < radius) {
        changed = true;
        continue;
      }
    }
    next.push(...result);
  }
  if (changed) emit(next);
}
