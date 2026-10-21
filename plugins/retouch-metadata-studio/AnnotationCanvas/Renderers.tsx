import React from 'react';
import { Annotation, DoodleLineStyle, LineTexture, LineTaper } from '../AnnotationsPanel';
import {
  getChalkFilterValues,
  getCrayonFilterValues,
  getDrybrushFilterValues,
  getWatercolorFilterValues,
  getCalligraphyNibValues,
  getDashArrayString,
} from '../AnnotationsPanel/brushUtils';
import {
  smoothPath,
  doodleLinePoints,
  generateSmoothSpline,
  constructVariableWidthRibbon,
  constructCalligraphyRibbon,
  generateSprayDots,
} from './utils';
import {
  VectorShapeType,
  getPolygonPoints,
  getShapePathString,
  normalizeBounds,
} from './shapeUtils';

export const AnnotationDefs = React.memo(() => (
  <defs>
    {/* Watercolor texture filter — soft bleeding feathered edge */}
    <filter id="watercolor-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
      <feGaussianBlur in="displaced" stdDeviation="0.8" result="blurred" />
      <feMerge>
        <feMergeNode in="blurred" />
        <feMergeNode in="displaced" />
      </feMerge>
    </filter>

    {/* Chalk texture filter — porous paper grain and rough chalk crumb edges */}
    <filter id="chalk-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="4.2" xChannelSelector="R" yChannelSelector="G" result="displaced" />
      <feColorMatrix in="noise" type="matrix" values="
        0 0 0 0 0
        0 0 0 0 0
        0 0 0 0 0
        1 0 0 0 -0.22" result="maskNoise" />
      <feComposite in="displaced" in2="maskNoise" operator="in" />
    </filter>

    {/* Crayon texture filter — rough wax tooth */}
    <filter id="crayon-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
      <feTurbulence type="turbulence" baseFrequency="0.45" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5.5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
      <feColorMatrix in="noise" type="matrix" values="
        0 0 0 0 0
        0 0 0 0 0
        0 0 0 0 0
        1 1 0 0 -0.35" result="maskNoise" />
      <feComposite in="displaced" in2="maskNoise" operator="in" />
    </filter>

    {/* Drybrush texture filter — directional bristle grain */}
    <filter id="drybrush-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.82 0.08" numOctaves="3" result="grain" />
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="3" xChannelSelector="R" yChannelSelector="G" result="displaced" />
      <feColorMatrix in="grain" type="matrix" values="
        0 0 0 0 0
        0 0 0 0 0
        0 0 0 0 0
        1.2 0 0 0 -0.28" result="grainMask" />
      <feComposite in="displaced" in2="grainMask" operator="in" />
    </filter>

    {/* Neon glow filter — luminous bloom */}
    <filter id="neon-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    {/* Gradients for shape fills */}
    <linearGradient id="grad-sunset" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f43f5e" />
      <stop offset="100%" stopColor="#f59e0b" />
    </linearGradient>
    <linearGradient id="grad-cyber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#06b6d4" />
      <stop offset="100%" stopColor="#8b5cf6" />
    </linearGradient>
    <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#10b981" />
      <stop offset="100%" stopColor="#064e3b" />
    </linearGradient>
    <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#fbbf24" />
      <stop offset="100%" stopColor="#d97706" />
    </linearGradient>
    <linearGradient id="grad-noir" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#4b5563" />
      <stop offset="100%" stopColor="#111827" />
    </linearGradient>
  </defs>
));

export const getTextureFilter = (texture?: LineTexture | 'watercolor'): string | undefined => {
  if (texture === 'chalk') return 'url(#chalk-filter)';
  if (texture === 'crayon') return 'url(#crayon-filter)';
  if (texture === 'drybrush') return 'url(#drybrush-filter)';
  if (texture === 'watercolor') return 'url(#watercolor-filter)';
  return undefined;
};

interface RendererProps {
  ann: Annotation;
  showGuide?: boolean;
  aspectRatio?: number;
}

const arePropsEqual = (prev: RendererProps, next: RendererProps) => {
  return (
    prev.ann === next.ann &&
    prev.showGuide === next.showGuide &&
    prev.aspectRatio === next.aspectRatio
  );
};

export const SprayRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.sprayDots || ann.sprayDots.length === 0) return null;
  const pathD = ann.sprayDots
    .map(d => `M ${(d.x - d.r).toFixed(1)} ${d.y.toFixed(1)} a ${d.r} ${d.r} 0 1 0 ${(d.r * 2).toFixed(1)} 0 a ${d.r} ${d.r} 0 1 0 ${(-d.r * 2).toFixed(1)} 0`)
    .join(' ');

  return (
    <g opacity={ann.opacity ?? 1}>
      <path d={pathD} fill={ann.color} />
    </g>
  );
}, arePropsEqual);

export const ArrowRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length < 2) return null;
  const filter = getTextureFilter(ann.lineTexture);
  const stroke = ann.color;
  const strokeWidth = ann.strokeWidth * 1.5;
  const headLength = Math.max(20, ann.strokeWidth * 4);

  let spine: { x: number; y: number }[];
  if (ann.points.length > 2) {
    spine = generateSmoothSpline(ann.points, 24);
  } else if (ann.doodleLineStyle) {
    spine = smoothPath(doodleLinePoints(ann.points[0], ann.points[1], ann.doodleLineStyle));
  } else {
    spine = ann.points;
  }

  const tip = spine[spine.length - 1];
  const prev = spine[Math.max(0, spine.length - 3)];
  const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);

  const xLeft = tip.x - headLength * Math.cos(ang - Math.PI / 6);
  const yLeft = tip.y - headLength * Math.sin(ang - Math.PI / 6);
  const xRight = tip.x - headLength * Math.cos(ang + Math.PI / 6);
  const yRight = tip.y - headLength * Math.sin(ang + Math.PI / 6);

  let shaft: React.ReactNode;
  if (ann.lineTaper && ann.lineTaper !== 'none') {
    const ribbonD = constructVariableWidthRibbon(spine, strokeWidth, ann.lineTaper, ann.doodleLineStyle);
    shaft = <path d={ribbonD} fill={stroke} filter={filter} />;
  } else if (spine.length > 2) {
    const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    shaft = <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" filter={filter} />;
  } else {
    const xBase = tip.x - headLength * Math.cos(ang) * 0.8;
    const yBase = tip.y - headLength * Math.sin(ang) * 0.8;
    shaft = <line x1={spine[0].x} y1={spine[0].y} x2={xBase} y2={yBase} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" filter={filter} />;
  }

  return (
    <g opacity={ann.opacity ?? 1}>
      {shaft}
      <polygon
        points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${xLeft.toFixed(1)},${yLeft.toFixed(1)} ${xRight.toFixed(1)},${yRight.toFixed(1)}`}
        fill={stroke}
        filter={filter}
      />
    </g>
  );
}, arePropsEqual);

export const FreehandRenderer = React.memo(({ ann }: RendererProps) => {
  // If this annotation is a spray stroke, delegate directly to SprayRenderer
  if (ann.brushType === 'spray' || (ann.sprayDots && ann.sprayDots.length > 0)) {
    let effectiveAnn = ann;
    if ((!ann.sprayDots || ann.sprayDots.length === 0) && ann.points && ann.points.length > 0) {
      const radius = ann.sprayRadius ?? 25;
      const density = ann.sprayDensity ?? 14;
      const dots: Array<{ x: number; y: number; r: number }> = [];
      for (const pt of ann.points) {
        dots.push(...generateSprayDots(pt.x, pt.y, radius, Math.max(2, Math.round(density / 3))));
      }
      effectiveAnn = { ...ann, sprayDots: dots };
    }
    return <SprayRenderer ann={effectiveAnn} />;
  }

  if (!ann.points || ann.points.length === 0) return null;
  const smoothed = smoothPath(ann.points);

  // Brush-specific texture/filter
  const effectiveTexture: LineTexture | 'watercolor' | undefined =
    ann.brushType === 'chalk'
      ? 'chalk'
      : ann.brushType === 'crayon'
        ? 'crayon'
        : ann.brushType === 'oil' || ann.brushType === 'drybrush'
          ? 'drybrush'
          : ann.brushType === 'watercolor'
            ? 'watercolor'
            : ann.lineTexture;

  let activeFilter = getTextureFilter(effectiveTexture);
  let dynamicFilterDefs: React.ReactNode = null;
  const safeId = (ann.id || 'brush').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (effectiveTexture === 'chalk') {
    const filterId = `chalk-filter-${safeId}`;
    const { baseFreq, scale, offset } = getChalkFilterValues(
      ann.chalkPressure,
      ann.chalkGrain,
      ann.chalkRoughness
    );
    dynamicFilterDefs = (
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves={4} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feColorMatrix in="noise" type="matrix" values={`
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            1 0 0 0 ${offset}`} result="maskNoise" />
          <feComposite in="displaced" in2="maskNoise" operator="in" />
        </filter>
      </defs>
    );
    activeFilter = `url(#${filterId})`;
  } else if (effectiveTexture === 'crayon') {
    const filterId = `crayon-filter-${safeId}`;
    const { baseFreq, scale, offset } = getCrayonFilterValues(
      ann.crayonDensity,
      ann.crayonGrain,
      ann.crayonRoughness
    );
    dynamicFilterDefs = (
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feTurbulence type="turbulence" baseFrequency={baseFreq} numOctaves={3} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feColorMatrix in="noise" type="matrix" values={`
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            1 1 0 0 ${offset}`} result="maskNoise" />
          <feComposite in="displaced" in2="maskNoise" operator="in" />
        </filter>
      </defs>
    );
    activeFilter = `url(#${filterId})`;
  } else if (effectiveTexture === 'drybrush') {
    const filterId = `drybrush-filter-${safeId}`;
    const { baseFreq, scale, offset } = getDrybrushFilterValues(
      ann.drybrushDensity,
      ann.drybrushStreaks,
      ann.drybrushRoughness
    );
    dynamicFilterDefs = (
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves={3} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feColorMatrix in="grain" type="matrix" values={`
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            1.2 0 0 0 ${offset}`} result="grainMask" />
          <feComposite in="displaced" in2="grainMask" operator="in" />
        </filter>
      </defs>
    );
    activeFilter = `url(#${filterId})`;
  } else if (effectiveTexture === 'watercolor') {
    const filterId = `watercolor-filter-${safeId}`;
    const { scale, stdDeviation } = getWatercolorFilterValues(
      ann.watercolorBleed,
      ann.watercolorSpread,
      ann.watercolorWetness
    );
    dynamicFilterDefs = (
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation={stdDeviation} result="blurred" />
          <feMerge>
            <feMergeNode in="blurred" />
            <feMergeNode in="displaced" />
          </feMerge>
        </filter>
      </defs>
    );
    activeFilter = `url(#${filterId})`;
  } else if (ann.brushType === 'brush' && (ann.brushFeather ?? 0) > 0) {
    const filterId = `feather-filter-${safeId}`;
    dynamicFilterDefs = (
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feGaussianBlur in="SourceGraphic" stdDeviation={(ann.brushFeather || 0).toFixed(1)} />
        </filter>
      </defs>
    );
    activeFilter = `url(#${filterId})`;
  }

  const sw =
    ann.brushType === 'brush'
      ? ann.strokeWidth * 1.8
      : ann.brushType === 'watercolor'
        ? ann.strokeWidth * 2.0
        : ann.brushType === 'chalk'
          ? ann.strokeWidth * 1.8
          : ann.strokeWidth * 1.5;

  const effectiveOpacity =
    ann.brushType === 'watercolor'
      ? (ann.watercolorWetness != null ? 0.25 + (ann.watercolorWetness / 100) * 0.40 : (ann.opacity ?? 0.45))
      : (ann.opacity ?? 1);

  // Calligraphy chisel ribbons (Calligraphy 1: 45°, Calligraphy 2: -45°)
  if ((ann.brushType === 'calligraphy1' || ann.brushType === 'calligraphy2') && smoothed.length >= 2) {
    const defaultAngle = ann.brushType === 'calligraphy2' ? -45 : 45;
    const angle = ann.nibAngle ?? defaultAngle;
    const { weightRatio } = getCalligraphyNibValues(angle, ann.nibWeight);
    const chiselWidth = sw * (weightRatio / 0.75);
    const ribbonD = constructCalligraphyRibbon(smoothed, chiselWidth, angle);
    return (
      <g opacity={effectiveOpacity}>
        {dynamicFilterDefs}
        <path d={ribbonD} fill={ann.color} filter={activeFilter} />
      </g>
    );
  }

  const dashArray = getDashArrayString(sw, ann.penStyle, ann.dashLength, ann.dashGap);

  // Arrowhead at end of stroke (mirrors ArrowRenderer geometry)
  const arrowHead = (() => {
    if (!ann.arrowEnd || smoothed.length < 2) return null;
    const end = smoothed[smoothed.length - 1];
    const prev = smoothed[smoothed.length - 2];
    const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
    const headLength = Math.max(20, sw * 2.5);
    const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
    const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
    const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
    const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);
    return `${end.x.toFixed(1)},${end.y.toFixed(1)} ${xLeft.toFixed(1)},${yLeft.toFixed(1)} ${xRight.toFixed(1)},${yRight.toFixed(1)}`;
  })();

  let mainStroke: React.ReactNode;
  if (ann.lineTaper && ann.lineTaper !== 'none' && smoothed.length >= 2) {
    const intensity = ann.taperIntensity != null ? (0.6 + (ann.taperIntensity / 100) * 0.8) : 1;
    const ribbonD = constructVariableWidthRibbon(smoothed, sw * intensity, ann.lineTaper, ann.doodleLineStyle);
    mainStroke = (
      <path
        d={ribbonD}
        fill={ann.color}
        fillOpacity={1}
        filter={activeFilter}
      />
    );
  } else {
    let pathData = smoothed
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    if (ann.closePath && smoothed.length > 2) pathData += ' Z';

    mainStroke = (
      <path
        d={pathData}
        fill={ann.closePath ? ann.color : 'none'}
        fillOpacity={ann.closePath ? (ann.fillOpacity ?? 0.5) : undefined}
        stroke={ann.color}
        strokeWidth={sw}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={activeFilter}
      />
    );
  }

  return (
    <g opacity={effectiveOpacity}>
      {dynamicFilterDefs}
      {mainStroke}
      {arrowHead && <polygon points={arrowHead} fill={ann.color} filter={activeFilter} />}
    </g>
  );
}, arePropsEqual);

export const HighlighterRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length === 0) return null;
  const smoothed = smoothPath(ann.points);
  const pathData = smoothed
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <g>
      <path
        d={pathData}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={ann.opacity ?? 0.4}
        style={{ mixBlendMode: 'multiply' } as any}
      />
    </g>
  );
}, arePropsEqual);

export const VectorShapeRenderer = React.memo(({ ann }: RendererProps) => {
  const fill = ann.fillShape ? (ann.fillColor ?? ann.color) : 'none';
  const fillOpacity = ann.fillShape ? (ann.fillOpacity ?? 0.5) : undefined;
  const stroke = ann.color;
  const strokeWidth = ann.strokeWidth * 1.5;
  const opacity = ann.opacity ?? 1;

  if (ann.type === 'line' && ann.points && ann.points.length >= 2) {
    const filter = getTextureFilter(ann.lineTexture);

    if (ann.points.length > 2 || (ann.lineTaper && ann.lineTaper !== 'none') || ann.doodleLineStyle) {
      let spine: { x: number; y: number }[];
      if (ann.points.length > 2) {
        spine = generateSmoothSpline(ann.points, 24);
      } else if (ann.doodleLineStyle) {
        spine = smoothPath(doodleLinePoints(ann.points[0], ann.points[1], ann.doodleLineStyle));
      } else {
        spine = generateSmoothSpline(ann.points, 24);
      }

      if (ann.lineTaper && ann.lineTaper !== 'none') {
        const ribbonD = constructVariableWidthRibbon(spine, strokeWidth, ann.lineTaper, ann.doodleLineStyle);
        return (
          <g opacity={opacity}>
            <path d={ribbonD} fill={stroke} filter={filter} />
          </g>
        );
      }

      const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return (
        <g opacity={opacity}>
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" filter={filter} />
        </g>
      );
    }

    const start = ann.points[0];
    const end = ann.points[1];
    return (
      <g opacity={opacity}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={filter}
        />
      </g>
    );
  }

  if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
    const filter = getTextureFilter(ann.lineTexture);
    const headLength = Math.max(20, ann.strokeWidth * 4);

    let spine: { x: number; y: number }[];
    if (ann.points.length > 2) {
      spine = generateSmoothSpline(ann.points, 24);
    } else if (ann.doodleLineStyle) {
      spine = smoothPath(doodleLinePoints(ann.points[0], ann.points[1], ann.doodleLineStyle));
    } else {
      spine = ann.points;
    }

    const tip = spine[spine.length - 1];
    const prev = spine[Math.max(0, spine.length - 3)];
    const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);

    const xLeft = tip.x - headLength * Math.cos(ang - Math.PI / 6);
    const yLeft = tip.y - headLength * Math.sin(ang - Math.PI / 6);
    const xRight = tip.x - headLength * Math.cos(ang + Math.PI / 6);
    const yRight = tip.y - headLength * Math.sin(ang + Math.PI / 6);

    let shaft: React.ReactNode;
    if (ann.lineTaper && ann.lineTaper !== 'none') {
      const ribbonD = constructVariableWidthRibbon(spine, strokeWidth, ann.lineTaper, ann.doodleLineStyle);
      shaft = <path d={ribbonD} fill={stroke} filter={filter} />;
    } else if (spine.length > 2) {
      const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      shaft = <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" filter={filter} />;
    } else {
      const xBase = tip.x - headLength * Math.cos(ang) * 0.8;
      const yBase = tip.y - headLength * Math.sin(ang) * 0.8;
      shaft = <line x1={spine[0].x} y1={spine[0].y} x2={xBase} y2={yBase} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" filter={filter} />;
    }

    return (
      <g opacity={opacity}>
        {shaft}
        <polygon
          points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${xLeft.toFixed(1)},${yLeft.toFixed(1)} ${xRight.toFixed(1)},${yRight.toFixed(1)}`}
          fill={stroke}
          filter={filter}
        />
      </g>
    );
  }

  if (ann.type === 'doubleArrow' && ann.points && ann.points.length >= 2) {
    const filter = getTextureFilter(ann.lineTexture);
    const headLength = Math.max(20, ann.strokeWidth * 4);

    let spine: { x: number; y: number }[];
    if (ann.points.length > 2) {
      spine = generateSmoothSpline(ann.points, 24);
    } else if (ann.doodleLineStyle) {
      spine = smoothPath(doodleLinePoints(ann.points[0], ann.points[1], ann.doodleLineStyle));
    } else {
      spine = ann.points;
    }

    // End arrowhead
    const tip1 = spine[spine.length - 1];
    const prev1 = spine[Math.max(0, spine.length - 3)];
    const a1 = Math.atan2(tip1.y - prev1.y, tip1.x - prev1.x);
    const xLeft1 = tip1.x - headLength * Math.cos(a1 - Math.PI / 6);
    const yLeft1 = tip1.y - headLength * Math.sin(a1 - Math.PI / 6);
    const xRight1 = tip1.x - headLength * Math.cos(a1 + Math.PI / 6);
    const yRight1 = tip1.y - headLength * Math.sin(a1 + Math.PI / 6);

    // Start arrowhead
    const tip0 = spine[0];
    const next0 = spine[Math.min(spine.length - 1, 2)];
    const a0 = Math.atan2(tip0.y - next0.y, tip0.x - next0.x);
    const xLeft0 = tip0.x - headLength * Math.cos(a0 - Math.PI / 6);
    const yLeft0 = tip0.y - headLength * Math.sin(a0 - Math.PI / 6);
    const xRight0 = tip0.x - headLength * Math.cos(a0 + Math.PI / 6);
    const yRight0 = tip0.y - headLength * Math.sin(a0 + Math.PI / 6);

    let shaftDA: React.ReactNode;
    if (ann.lineTaper && ann.lineTaper !== 'none') {
      const ribbonD = constructVariableWidthRibbon(spine, strokeWidth, ann.lineTaper, ann.doodleLineStyle);
      shaftDA = <path d={ribbonD} fill={stroke} filter={filter} />;
    } else if (spine.length > 2) {
      const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      shaftDA = <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" filter={filter} />;
    } else {
      const xBase1 = tip1.x - headLength * Math.cos(a1) * 0.8;
      const yBase1 = tip1.y - headLength * Math.sin(a1) * 0.8;
      const xBase0 = tip0.x + headLength * Math.cos(a0) * 0.8;
      const yBase0 = tip0.y + headLength * Math.sin(a0) * 0.8;
      shaftDA = <line x1={xBase0} y1={yBase0} x2={xBase1} y2={yBase1} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" filter={filter} />;
    }

    return (
      <g opacity={opacity}>
        {shaftDA}
        <polygon
          points={`${tip1.x.toFixed(1)},${tip1.y.toFixed(1)} ${xLeft1.toFixed(1)},${yLeft1.toFixed(1)} ${xRight1.toFixed(1)},${yRight1.toFixed(1)}`}
          fill={stroke}
          filter={filter}
        />
        <polygon
          points={`${tip0.x.toFixed(1)},${tip0.y.toFixed(1)} ${xLeft0.toFixed(1)},${yLeft0.toFixed(1)} ${xRight0.toFixed(1)},${yRight0.toFixed(1)}`}
          fill={stroke}
          filter={filter}
        />
      </g>
    );
  }

  if (!ann.bounds) return null;
  const { x, y, w, h } = normalizeBounds(ann.bounds);

  const isGradient = ann.gradientFill && ann.gradientFill !== 'none';
  const shapeFill = isGradient
    ? `url(#grad-${ann.gradientFill})`
    : ann.fillShape
      ? (ann.fillColor ?? ann.color)
      : 'none';
  const shapeFillOpacity = isGradient ? 1 : ann.fillShape ? (ann.fillOpacity ?? 0.5) : undefined;
  const shapeFilter = ann.shapeEffect === 'glow' ? 'url(#neon-glow-filter)' : getTextureFilter(ann.lineTexture);
  const shapeDash =
    ann.shapeStrokeStyle === 'dashed'
      ? `${strokeWidth * 3} ${strokeWidth * 2}`
      : ann.shapeStrokeStyle === 'dotted'
        ? `0.1 ${strokeWidth * 2}`
        : undefined;

  let shapeElement: React.ReactNode = null;

  if (ann.type === 'rect' || ann.type === 'roundedRect') {
    const defaultR = ann.type === 'roundedRect' ? Math.min(w, h) * 0.15 : 0;
    const r = ann.cornerRadius ?? defaultR;
    shapeElement = (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill={shapeFill}
        fillOpacity={shapeFillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={shapeDash}
        filter={shapeFilter}
        opacity={opacity}
      />
    );
  } else if (ann.type === 'circle') {
    shapeElement = (
      <ellipse
        cx={x + w / 2}
        cy={y + h / 2}
        rx={w / 2}
        ry={h / 2}
        fill={shapeFill}
        fillOpacity={shapeFillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={shapeDash}
        filter={shapeFilter}
        opacity={opacity}
      />
    );
  } else {
    // Geometric regular polygon shapes (triangle, rightTriangle, diamond, pentagon, hexagon, star, fourPointStar, lightning)
    const polyPoints = getPolygonPoints(ann.type as VectorShapeType, ann.bounds, {
      polygonSides: ann.polygonSides,
      starPoints: ann.starPoints,
      starSpikiness: ann.starSpikiness,
    });
    if (polyPoints) {
      shapeElement = (
        <polygon
          points={polyPoints}
          fill={shapeFill}
          fillOpacity={shapeFillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={shapeDash}
          strokeLinejoin="round"
          filter={shapeFilter}
          opacity={opacity}
        />
      );
    } else {
      // Path-based shapes (heart, speechBubble, cloud)
      const pathD = getShapePathString(ann.type as VectorShapeType, ann.bounds, {
        tailPos: ann.tailPos,
        cornerRadius: ann.cornerRadius,
      });
      if (pathD) {
        shapeElement = (
          <path
            d={pathD}
            fill={shapeFill}
            fillOpacity={shapeFillOpacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={shapeDash}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={shapeFilter}
            opacity={opacity}
          />
        );
      }
    }
  }

  // Embedded Badge Text
  const badge = ann.badgeText ? (
    <text
      x={x + w / 2}
      y={y + h / 2}
      dominantBaseline="middle"
      textAnchor="middle"
      fill={ann.color}
      fontSize={Math.min(28, Math.max(10, Math.min(w, h) * 0.22))}
      fontWeight="600"
      fontFamily="Space Grotesk, system-ui, sans-serif"
      pointerEvents="none"
    >
      {ann.badgeText}
    </text>
  ) : null;

  return (
    <g>
      {shapeElement}
      {badge}
    </g>
  );
}, arePropsEqual);

export const RectRenderer = VectorShapeRenderer;
export const CircleRenderer = VectorShapeRenderer;

const calculatePathLength = (points: { x: number; y: number }[]) => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

export const TextPathRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length < 2) return null;
  const pathId = `path-${ann.id}`;
  const smoothed = smoothPath(ann.points);
  const d = smoothed
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const showGuide = ann.showGuidePath !== false;
  
  // Repeat text to fill path length
  const text = ann.doodleText || 'peace in the air';
  const pathLen = calculatePathLength(smoothed);
  const fontSize = ann.fontSize || 18;
  const charWidth = fontSize * 0.35;
  const wordLen = text.length * charWidth + 10;
  const repeats = Math.max(2, Math.ceil(pathLen / wordLen) + 3);
  const repeatedText = Array(repeats).fill(text).join('   ');

  return (
    <g opacity={ann.opacity ?? 1}>
      <defs>
        <path id={pathId} d={d} />
      </defs>
      {showGuide && (
        <path
          d={d}
          fill="none"
          stroke={ann.color}
          strokeWidth={1.2}
          opacity={0.25}
        />
      )}
      <text
        fill={ann.color}
        fontSize={fontSize}
        fontFamily={ann.fontFamily || 'Space Grotesk'}
      >
        <textPath href={`#${pathId}`} startOffset="4">
          {repeatedText}
        </textPath>
      </text>
    </g>
  );
}, arePropsEqual);

export const TextRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.bounds) return null;
  const b = ann.bounds;
  const x = b.x;
  const y = b.y;
  const fontSize = ann.fontSize || 36;
  const fontFamily = ann.fontFamily || 'Inter';
  const text = ann.text || '';
  const lines = text.split('\n');

  const alignment = ann.textAlign || 'center';
  const textAnchor = alignment === 'center' ? 'middle' : alignment === 'right' ? 'end' : 'start';

  const textX = alignment === 'center' ? x + b.w / 2 : alignment === 'right' ? x + b.w : x;
  const textY = y + fontSize * 0.8;

  const baseBgColor = ann.bgColor || '';
  const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
  const finalBgColor = baseBgColor ? `rgba(0,0,0,${bgOpacity})` : 'transparent';

  return (
    <g
      opacity={ann.opacity !== undefined ? ann.opacity : 1}
    >
      {/* Background card if specified */}
      {baseBgColor && (
        <rect
          x={x}
          y={y}
          width={b.w}
          height={b.h}
          rx={8}
          ry={8}
          fill={finalBgColor}
          stroke={ann.color}
          strokeWidth={1}
        />
      )}

      {/* Multiline Text */}
      {lines.map((line, idx) => (
        <text
          key={idx}
          x={textX}
          y={textY + idx * (fontSize * (ann.lineHeight || 1.2))}
          fill={ann.color || '#ffffff'}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontWeight={ann.fontWeight || 'normal'}
          fontStyle={ann.fontStyle || 'normal'}
          textDecoration={ann.textDecoration || 'none'}
          textAnchor={textAnchor}
          dominantBaseline="hanging"
          style={{
            letterSpacing: ann.letterSpacing ? `${ann.letterSpacing}px` : undefined,
            textTransform: (ann.textTransform as any) || 'none',
          }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}, arePropsEqual);
