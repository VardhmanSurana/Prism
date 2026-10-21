/**
 * annotationsStages.ts
 * Annotation rendering stage: converts vector annotations to SVG and composites onto canvas.
 */

import type { Annotation, LineTexture, LineTaper, DoodleLineStyle } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import {
  getChalkFilterValues,
  getCrayonFilterValues,
  getDrybrushFilterValues,
  getWatercolorFilterValues,
  getCalligraphyNibValues,
  getDashArrayString,
} from '@plugins/retouch-metadata-studio/AnnotationsPanel/brushUtils';
import {
  smoothPath,
  getRotationAttr,
  doodleLinePoints,
  generateSmoothSpline,
  constructVariableWidthRibbon,
  constructCalligraphyRibbon,
  generateSprayDots,
} from '@plugins/retouch-metadata-studio/AnnotationCanvas/utils';
import {
  getPolygonPoints,
  getShapePathString,
  normalizeBounds,
  VectorShapeType,
} from '@plugins/retouch-metadata-studio/AnnotationCanvas/shapeUtils';

const getTextureFilterAttr = (texture?: LineTexture | 'watercolor'): string => {
  if (texture === 'chalk') return ' filter="url(#chalk-filter)"';
  if (texture === 'crayon') return ' filter="url(#crayon-filter)"';
  if (texture === 'drybrush') return ' filter="url(#drybrush-filter)"';
  if (texture === 'watercolor') return ' filter="url(#watercolor-filter)"';
  return '';
};

export const applyAnnotations = (canvas: HTMLCanvasElement, annotations?: Annotation[]): Promise<HTMLCanvasElement> => {
  if (!annotations || annotations.length === 0) return Promise.resolve(canvas);

  return new Promise((resolve) => {
    const w = canvas.width;
    const h = canvas.height;
    const aspectRatio = h > 0 ? w / h : 1;

    let svgContent = '';

    annotations.forEach(ann => {
      if (ann.visible === false) return;
      const opacityAttr = ann.opacity != null && ann.opacity < 1 ? ` opacity="${ann.opacity}"` : '';
      const rotAttr = getRotationAttr(ann, aspectRatio);

      if (ann.brushType === 'spray' || (ann.sprayDots && ann.sprayDots.length > 0)) {
        let dots = ann.sprayDots;
        if ((!dots || dots.length === 0) && ann.points && ann.points.length > 0) {
          const radius = ann.sprayRadius ?? 25;
          const density = ann.sprayDensity ?? 14;
          dots = [];
          for (const pt of ann.points) {
            dots.push(...generateSprayDots(pt.x, pt.y, radius, Math.max(2, Math.round(density / 3))));
          }
        }
        if (dots && dots.length > 0) {
          const pathD = dots
            .map(d => `M ${(d.x - d.r).toFixed(1)} ${d.y.toFixed(1)} a ${d.r} ${d.r} 0 1 0 ${(d.r * 2).toFixed(1)} 0 a ${d.r} ${d.r} 0 1 0 ${(-d.r * 2).toFixed(1)} 0`)
            .join(' ');
          svgContent += `<g${rotAttr}${opacityAttr}><path d="${pathD}" fill="${ann.color}" /></g>`;
        }
      } else if (ann.type === 'freehand' && ann.points) {
        const smoothed = smoothPath(ann.points);

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

        let filterAttr = getTextureFilterAttr(effectiveTexture);
        let customDefs = '';
        const safeId = (ann.id || 'brush').replace(/[^a-zA-Z0-9_-]/g, '_');

        if (effectiveTexture === 'chalk') {
          const filterId = `chalk-filter-${safeId}`;
          const { baseFreq, scale, offset } = getChalkFilterValues(
            ann.chalkPressure,
            ann.chalkGrain,
            ann.chalkRoughness
          );
          customDefs = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="${baseFreq}" numOctaves="4" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="displaced" /><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 ${offset}" result="maskNoise" /><feComposite in="displaced" in2="maskNoise" operator="in" /></filter></defs>`;
          filterAttr = ` filter="url(#${filterId})"`;
        } else if (effectiveTexture === 'crayon') {
          const filterId = `crayon-filter-${safeId}`;
          const { baseFreq, scale, offset } = getCrayonFilterValues(
            ann.crayonDensity,
            ann.crayonGrain,
            ann.crayonRoughness
          );
          customDefs = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse"><feTurbulence type="turbulence" baseFrequency="${baseFreq}" numOctaves="3" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="displaced" /><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 0 0 ${offset}" result="maskNoise" /><feComposite in="displaced" in2="maskNoise" operator="in" /></filter></defs>`;
          filterAttr = ` filter="url(#${filterId})"`;
        } else if (effectiveTexture === 'drybrush') {
          const filterId = `drybrush-filter-${safeId}`;
          const { baseFreq, scale, offset } = getDrybrushFilterValues(
            ann.drybrushDensity,
            ann.drybrushStreaks,
            ann.drybrushRoughness
          );
          customDefs = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="${baseFreq}" numOctaves="3" result="grain" /><feDisplacementMap in="SourceGraphic" in2="grain" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="displaced" /><feColorMatrix in="grain" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.2 0 0 0 ${offset}" result="grainMask" /><feComposite in="displaced" in2="grainMask" operator="in" /></filter></defs>`;
          filterAttr = ` filter="url(#${filterId})"`;
        } else if (effectiveTexture === 'watercolor') {
          const filterId = `watercolor-filter-${safeId}`;
          const { scale, stdDeviation } = getWatercolorFilterValues(
            ann.watercolorBleed,
            ann.watercolorSpread,
            ann.watercolorWetness
          );
          customDefs = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="displaced" /><feGaussianBlur in="displaced" stdDeviation="${stdDeviation}" result="blurred" /><feMerge><feMergeNode in="blurred" /><feMergeNode in="displaced" /></feMerge></filter></defs>`;
          filterAttr = ` filter="url(#${filterId})"`;
        } else if (ann.brushType === 'brush' && (ann.brushFeather ?? 0) > 0) {
          const filterId = `feather-filter-${safeId}`;
          customDefs = `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse"><feGaussianBlur in="SourceGraphic" stdDeviation="${(ann.brushFeather || 0).toFixed(1)}" /></filter></defs>`;
          filterAttr = ` filter="url(#${filterId})"`;
        }

        const sw =
          ann.brushType === 'brush'
            ? ann.strokeWidth * 1.8
            : ann.brushType === 'watercolor'
              ? ann.strokeWidth * 2.0
              : ann.brushType === 'chalk'
                ? ann.strokeWidth * 1.8
                : ann.strokeWidth * 1.5;

        const brushOpacityAttr =
          ann.brushType === 'watercolor'
            ? ` opacity="${ann.watercolorWetness != null ? (0.25 + (ann.watercolorWetness / 100) * 0.40).toFixed(2) : (ann.opacity ?? 0.45)}"`
            : opacityAttr;

        let strokeSvg = '';

        if ((ann.brushType === 'calligraphy1' || ann.brushType === 'calligraphy2') && smoothed.length >= 2) {
          const defaultAngle = ann.brushType === 'calligraphy2' ? -45 : 45;
          const angle = ann.nibAngle ?? defaultAngle;
          const { weightRatio } = getCalligraphyNibValues(angle, ann.nibWeight);
          const chiselWidth = sw * (weightRatio / 0.75);
          const ribbonD = constructCalligraphyRibbon(smoothed, chiselWidth, angle);
          strokeSvg = `<path d="${ribbonD}" fill="${ann.color}"${filterAttr} />`;
        } else if (ann.lineTaper && ann.lineTaper !== 'none' && smoothed.length >= 2) {
          const intensity = ann.taperIntensity != null ? (0.6 + (ann.taperIntensity / 100) * 0.8) : 1;
          const ribbonD = constructVariableWidthRibbon(smoothed, sw * intensity, ann.lineTaper, ann.doodleLineStyle);
          strokeSvg = `<path d="${ribbonD}" fill="${ann.color}"${filterAttr} />`;
        } else {
          let d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          if (ann.closePath && smoothed.length > 2) d += ' Z';
          const dashStr = getDashArrayString(sw, ann.penStyle, ann.dashLength, ann.dashGap);
          const dash = dashStr ? ` stroke-dasharray="${dashStr}"` : '';
          const fillAttrs = ann.closePath
            ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"`
            : ' fill="none"';
          strokeSvg = `<path d="${d}"${fillAttrs} stroke="${ann.color}" stroke-width="${sw}"${dash} stroke-linecap="round" stroke-linejoin="round"${filterAttr} />`;
        }

        let arrowHeadSvg = '';
        if (ann.arrowEnd && smoothed.length >= 2) {
          const end = smoothed[smoothed.length - 1];
          const prev = smoothed[smoothed.length - 2];
          const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
          const headLength = Math.max(20, sw * 2.5);
          const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
          const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
          const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
          const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);
          arrowHeadSvg = `<polygon points="${end.x},${end.y} ${xLeft},${yLeft} ${xRight},${yRight}" fill="${ann.color}"${filterAttr} />`;
        }
        svgContent += `<g${rotAttr}${brushOpacityAttr}>${customDefs}${strokeSvg}${arrowHeadSvg}</g>`;
      } else if (ann.type === 'highlighter' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const hOpacity = ann.opacity ?? 0.4;
        svgContent += `<g${rotAttr} opacity="${hOpacity}"><path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="mix-blend-mode: multiply" /></g>`;
      } else if (ann.type === 'line' && ann.points && ann.points.length >= 2) {
        const filterAttr = getTextureFilterAttr(ann.lineTexture);
        const sw = ann.strokeWidth * 1.5;
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
            const ribbonD = constructVariableWidthRibbon(spine, sw, ann.lineTaper, ann.doodleLineStyle);
            svgContent += `<g${rotAttr}${opacityAttr}><path d="${ribbonD}" fill="${ann.color}"${filterAttr} /></g>`;
          } else {
            const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            svgContent += `<g${rotAttr}${opacityAttr}><path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${filterAttr} /></g>`;
          }
        } else {
          const start = ann.points[0];
          const end = ann.points[1];
          svgContent += `<g${rotAttr}${opacityAttr}><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round"${filterAttr} /></g>`;
        }
      } else if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
        const filterAttr = getTextureFilterAttr(ann.lineTexture);
        const sw = ann.strokeWidth * 1.5;
        const headLength = Math.max(20, ann.strokeWidth * 3.5);

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

        let shaftSvg: string;
        if (ann.lineTaper && ann.lineTaper !== 'none') {
          const ribbonD = constructVariableWidthRibbon(spine, sw, ann.lineTaper, ann.doodleLineStyle);
          shaftSvg = `<path d="${ribbonD}" fill="${ann.color}"${filterAttr} />`;
        } else if (spine.length > 2) {
          const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          shaftSvg = `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${filterAttr} />`;
        } else {
          const xBase = tip.x - headLength * Math.cos(ang) * 0.8;
          const yBase = tip.y - headLength * Math.sin(ang) * 0.8;
          shaftSvg = `<line x1="${spine[0].x}" y1="${spine[0].y}" x2="${xBase}" y2="${yBase}" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round"${filterAttr} />`;
        }

        svgContent += `<g${rotAttr}${opacityAttr}>${shaftSvg}<polygon points="${tip.x},${tip.y} ${xLeft},${yLeft} ${xRight},${yRight}" fill="${ann.color}"${filterAttr} /></g>`;
      } else if (ann.type === 'doubleArrow' && ann.points && ann.points.length >= 2) {
        const filterAttr = getTextureFilterAttr(ann.lineTexture);
        const sw = ann.strokeWidth * 1.5;
        const headLength = Math.max(20, ann.strokeWidth * 3.5);

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

        let shaftSvg: string;
        if (ann.lineTaper && ann.lineTaper !== 'none') {
          const ribbonD = constructVariableWidthRibbon(spine, sw, ann.lineTaper, ann.doodleLineStyle);
          shaftSvg = `<path d="${ribbonD}" fill="${ann.color}"${filterAttr} />`;
        } else if (spine.length > 2) {
          const d = spine.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          shaftSvg = `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${filterAttr} />`;
        } else {
          const xBase1 = tip1.x - headLength * Math.cos(a1) * 0.8;
          const yBase1 = tip1.y - headLength * Math.sin(a1) * 0.8;
          const xBase0 = tip0.x + headLength * Math.cos(a0) * 0.8;
          const yBase0 = tip0.y + headLength * Math.sin(a0) * 0.8;
          shaftSvg = `<line x1="${xBase0}" y1="${yBase0}" x2="${xBase1}" y2="${yBase1}" stroke="${ann.color}" stroke-width="${sw}" stroke-linecap="round"${filterAttr} />`;
        }

        svgContent += `<g${rotAttr}${opacityAttr}>${shaftSvg}<polygon points="${tip1.x},${tip1.y} ${xLeft1},${yLeft1} ${xRight1},${yRight1}" fill="${ann.color}"${filterAttr} /><polygon points="${tip0.x},${tip0.y} ${xLeft0},${yLeft0} ${xRight0},${yRight0}" fill="${ann.color}"${filterAttr} /></g>`;
      } else if (ann.bounds && ann.type !== 'text') {
        const { x, y, w, h } = normalizeBounds(ann.bounds);
        const isGradient = ann.gradientFill && ann.gradientFill !== 'none';
        const fillAttr = isGradient
          ? ` fill="url(#grad-${ann.gradientFill})"`
          : ann.fillShape
            ? ` fill="${ann.fillColor ?? ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"`
            : ' fill="none"';
        const strokeWidth = ann.strokeWidth * 1.5;
        const strokeDash =
          ann.shapeStrokeStyle === 'dashed'
            ? ` stroke-dasharray="${(strokeWidth * 3).toFixed(1)} ${(strokeWidth * 2).toFixed(1)}"`
            : ann.shapeStrokeStyle === 'dotted'
              ? ` stroke-dasharray="0.1 ${(strokeWidth * 2).toFixed(1)}"`
              : '';
        const filterAttr = ann.shapeEffect === 'glow' ? ' filter="url(#neon-glow-filter)"' : getTextureFilterAttr(ann.lineTexture);
        const strokeAttr = ` stroke="${ann.color}" stroke-width="${strokeWidth}"${strokeDash}${filterAttr}`;

        let shapeSvg = '';
        if (ann.type === 'rect') {
          const r = ann.cornerRadius ?? 0;
          shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"${fillAttr}${strokeAttr} />`;
        } else if (ann.type === 'roundedRect') {
          const r = ann.cornerRadius ?? (Math.min(w, h) * 0.15);
          shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"${fillAttr}${strokeAttr} />`;
        } else if (ann.type === 'circle') {
          const rx = w / 2;
          const ry = h / 2;
          shapeSvg = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${rx}" ry="${ry}"${fillAttr}${strokeAttr} />`;
        } else {
          const polyPts = getPolygonPoints(ann.type as VectorShapeType, ann.bounds, {
            polygonSides: ann.polygonSides,
            starPoints: ann.starPoints,
            starSpikiness: ann.starSpikiness,
          });
          if (polyPts) {
            shapeSvg = `<polygon points="${polyPts}"${fillAttr}${strokeAttr} stroke-linejoin="round" />`;
          } else {
            const pathD = getShapePathString(ann.type as VectorShapeType, ann.bounds, {
              tailPos: ann.tailPos,
              cornerRadius: ann.cornerRadius,
            });
            if (pathD) {
              shapeSvg = `<path d="${pathD}"${fillAttr}${strokeAttr} stroke-linejoin="round" stroke-linecap="round" />`;
            }
          }
        }

        let badgeSvg = '';
        if (ann.badgeText) {
          const fontSize = Math.min(28, Math.max(10, Math.min(w, h) * 0.22));
          const escapedBadge = ann.badgeText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          badgeSvg = `<text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle" fill="${ann.color}" font-size="${fontSize}" font-weight="600" font-family="Space Grotesk, system-ui, sans-serif">${escapedBadge}</text>`;
        }

        svgContent += `<g${rotAttr}${opacityAttr}>${shapeSvg}${badgeSvg}</g>`;
      } else if (ann.type === 'textPath' && ann.points && ann.points.length >= 2) {
        const pathId = `path-${ann.id}`;
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const showGuide = ann.showGuidePath !== false;

        const text = ann.doodleText || 'peace in the air';
        let pathLen = 0;
        for (let i = 1; i < smoothed.length; i++) {
          const dx = smoothed[i].x - smoothed[i - 1].x;
          const dy = smoothed[i].y - smoothed[i - 1].y;
          pathLen += Math.sqrt(dx * dx + dy * dy);
        }
        const fontSize = ann.fontSize || 18;
        const charWidth = fontSize * 0.35;
        const wordLen = text.length * charWidth + 10;
        const repeats = Math.max(2, Math.ceil(pathLen / wordLen) + 3);
        const repeatedText = Array(repeats).fill(text).join('   ');

        let subSvg = `<defs><path id="${pathId}" d="${d}" /></defs>`;
        if (showGuide) {
          subSvg += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="1.2" opacity="0.25" />`;
        }
        subSvg += `<text fill="${ann.color}" font-size="${fontSize}" font-family="${ann.fontFamily || 'Space Grotesk'}"><textPath href="#${pathId}" startOffset="4">${repeatedText}</textPath></text>`;
        svgContent += `<g${rotAttr}${opacityAttr}>${subSvg}</g>`;
      } else if (ann.type === 'text' && ann.bounds) {
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

        let textStyle = `font-family: ${fontFamily}; font-weight: ${ann.fontWeight || 'normal'}; font-style: ${ann.fontStyle || 'normal'}; text-decoration: ${ann.textDecoration || 'none'}; letter-spacing: ${ann.letterSpacing ?? 0}px;`;
        if (ann.textStroke && ann.textStroke !== 'none') {
          textStyle += ` -webkit-text-stroke: ${ann.textStroke};`;
        }
        if (ann.textShadow && ann.textShadow !== 'none') {
          textStyle += ` text-shadow: ${ann.textShadow};`;
        }
        if (ann.textTransform && ann.textTransform !== 'none') {
          textStyle += ` text-transform: ${ann.textTransform};`;
        }

        let subSvg = '';
        const baseBgColor = ann.bgColor || '';
        if (baseBgColor || ann.bgGlass) {
          const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
          const fillOpacity = baseBgColor ? bgOpacity : 0.08 * bgOpacity;
          const fillColor = baseBgColor || '#ffffff';
          subSvg += `<rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" fill="${fillColor}" fill-opacity="${fillOpacity}"${rotAttr} />`;
        }

        subSvg += `<text x="${textX}" y="${textY}" text-anchor="${textAnchor}" font-size="${fontSize}" fill="${ann.color}"${rotAttr} style="${textStyle}">`;
        lines.forEach((line, idx) => {
          const dyAttr = idx === 0 ? '' : ` dy="${ann.lineHeight || 1.2}em"`;
          const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          subSvg += `<tspan x="${textX}"${dyAttr}>${escapedLine}</tspan>`;
        });
        subSvg += `</text>`;
        svgContent += `<g${opacityAttr}>${subSvg}</g>`;
      }
    });

    const renderSvgAndResolve = () => {
      if (svgContent) {
        const svgFilters = `
          <defs>
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

            {/* Neon glow filter — luminous bloom */}
            <filter id="neon-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Linear Gradients for shape fills */}
            <linearGradient id="grad-sunset" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f43f5e" />
              <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
            <linearGradient id="grad-cyber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#06b6d4" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
            <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#10b981" />
              <stop offset="100%" stop-color="#064e3b" />
            </linearGradient>
            <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fbbf24" />
              <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
            <linearGradient id="grad-noir" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4b5563" />
              <stop offset="100%" stop-color="#111827" />
            </linearGradient>
          </defs>
        `;
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${w}" height="${h}" preserveAspectRatio="none">${svgFilters}${svgContent}</svg>`;
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
            }
            resolve(canvas);
          };
          img.onerror = () => {
            console.error('Failed to render SVG annotations image');
            resolve(canvas);
          };
          img.src = reader.result as string;
        };
        reader.onerror = () => resolve(canvas);
        reader.readAsDataURL(svgBlob);
      } else {
        resolve(canvas);
      }
    };

    renderSvgAndResolve();
  });
};
