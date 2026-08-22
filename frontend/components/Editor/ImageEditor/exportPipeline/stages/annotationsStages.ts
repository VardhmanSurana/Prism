/**
 * annotationsStages.ts
 * Annotation rendering stage: converts vector annotations to SVG and composites onto canvas.
 */

import { Annotation } from '../../AnnotationsPanel';
import { smoothPath, getRotationAttr } from '../../AnnotationCanvas/utils';
import {
  getPolygonPoints,
  getShapePathString,
  normalizeBounds,
  VectorShapeType,
} from '../../AnnotationCanvas/shapeUtils';

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

      if (ann.type === 'freehand' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svgContent += `<g${rotAttr}${opacityAttr}><path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" stroke-linejoin="round" /></g>`;
      } else if (ann.type === 'highlighter' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const hOpacity = ann.opacity ?? 0.4;
        svgContent += `<g${rotAttr} opacity="${hOpacity}"><path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="mix-blend-mode: multiply" /></g>`;
      } else if (ann.type === 'line' && ann.points && ann.points.length >= 2) {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        svgContent += `<g${rotAttr}${opacityAttr}><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" /></g>`;
      } else if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = Math.max(20, ann.strokeWidth * 3.5);
        const xTip = end.x;
        const yTip = end.y;
        const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
        const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
        const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
        const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);
        const xBase = end.x - headLength * Math.cos(angle) * 0.8;
        const yBase = end.y - headLength * Math.sin(angle) * 0.8;

        svgContent += `<g${rotAttr}${opacityAttr}><line x1="${start.x}" y1="${start.y}" x2="${xBase}" y2="${yBase}" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" /><polygon points="${xTip},${yTip} ${xLeft},${yLeft} ${xRight},${yRight}" fill="${ann.color}" /></g>`;
      } else if (ann.type === 'doubleArrow' && ann.points && ann.points.length >= 2) {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = Math.max(20, ann.strokeWidth * 3.5);

        const xTip1 = end.x;
        const yTip1 = end.y;
        const xLeft1 = end.x - headLength * Math.cos(angle - Math.PI / 6);
        const yLeft1 = end.y - headLength * Math.sin(angle - Math.PI / 6);
        const xRight1 = end.x - headLength * Math.cos(angle + Math.PI / 6);
        const yRight1 = end.y - headLength * Math.sin(angle + Math.PI / 6);
        const xBase1 = end.x - headLength * Math.cos(angle) * 0.8;
        const yBase1 = end.y - headLength * Math.sin(angle) * 0.8;

        const xTip0 = start.x;
        const yTip0 = start.y;
        const xLeft0 = start.x + headLength * Math.cos(angle - Math.PI / 6);
        const yLeft0 = start.y + headLength * Math.sin(angle - Math.PI / 6);
        const xRight0 = start.x + headLength * Math.cos(angle + Math.PI / 6);
        const yRight0 = start.y + headLength * Math.sin(angle + Math.PI / 6);
        const xBase0 = start.x + headLength * Math.cos(angle) * 0.8;
        const yBase0 = start.y + headLength * Math.sin(angle) * 0.8;

        svgContent += `<g${rotAttr}${opacityAttr}><line x1="${xBase0}" y1="${yBase0}" x2="${xBase1}" y2="${yBase1}" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" /><polygon points="${xTip1},${yTip1} ${xLeft1},${yLeft1} ${xRight1},${yRight1}" fill="${ann.color}" /><polygon points="${xTip0},${yTip0} ${xLeft0},${yLeft0} ${xRight0},${yRight0}" fill="${ann.color}" /></g>`;
      } else if (ann.bounds && ann.type !== 'text') {
        const { x, y, w, h } = normalizeBounds(ann.bounds);
        const fillAttr = ann.fillShape ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"` : ' fill="none"';
        const strokeAttr = ` stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}"`;

        let shapeSvg = '';
        if (ann.type === 'rect') {
          shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}"${fillAttr}${strokeAttr} />`;
        } else if (ann.type === 'roundedRect') {
          const r = Math.min(w, h) * 0.15;
          shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"${fillAttr}${strokeAttr} />`;
        } else if (ann.type === 'circle') {
          const rx = w / 2;
          const ry = h / 2;
          shapeSvg = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${rx}" ry="${ry}"${fillAttr}${strokeAttr} />`;
        } else {
          const polyPts = getPolygonPoints(ann.type as VectorShapeType, ann.bounds);
          if (polyPts) {
            shapeSvg = `<polygon points="${polyPts}"${fillAttr}${strokeAttr} stroke-linejoin="round" />`;
          } else {
            const pathD = getShapePathString(ann.type as VectorShapeType, ann.bounds);
            if (pathD) {
              shapeSvg = `<path d="${pathD}"${fillAttr}${strokeAttr} stroke-linejoin="round" stroke-linecap="round" />`;
            }
          }
        }
        svgContent += `<g${rotAttr}${opacityAttr}>${shapeSvg}</g>`;
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

        let textStyle = `font-family: ${fontFamily}; font-weight: ${ann.fontWeight || 'normal'}; font-style: ${ann.fontStyle || 'normal'}; text-decoration: ${ann.textDecoration || 'none'};`;
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
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${w}" height="${h}" preserveAspectRatio="none">${svgContent}</svg>`;
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
