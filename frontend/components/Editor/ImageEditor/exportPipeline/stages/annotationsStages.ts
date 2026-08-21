/**
 * annotationsStages.ts
 * Annotation rendering stage: converts vector annotations to SVG and composites onto canvas.
 */

import { Annotation } from '../../AnnotationsPanel';
import { smoothPath } from '../../AnnotationCanvas/utils';

export const applyAnnotations = (canvas: HTMLCanvasElement, annotations?: Annotation[]): Promise<HTMLCanvasElement> => {
  if (!annotations || annotations.length === 0) return Promise.resolve(canvas);

  return new Promise((resolve) => {
    const w = canvas.width;
    const h = canvas.height;

    let svgContent = '';

    annotations.forEach(ann => {
      if (ann.visible === false) return;
      const opacityAttr = ann.opacity != null && ann.opacity < 1 ? ` opacity="${ann.opacity}"` : '';
      if (ann.type === 'freehand' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svgContent += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" stroke-linejoin="round"${opacityAttr} />`;
      } else if (ann.type === 'highlighter' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const hOpacity = ann.opacity ?? 0.4;
        svgContent += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${hOpacity}" style="mix-blend-mode: multiply" />`;
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

        svgContent += `<g${opacityAttr}><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" /><polygon points="${xTip},${yTip} ${xLeft},${yLeft} ${xRight},${yRight}" fill="${ann.color}" /></g>`;
      } else if (ann.type === 'rect' && ann.bounds) {
        const b = ann.bounds;
        const x = b.w < 0 ? b.x + b.w : b.x;
        const y = b.h < 0 ? b.y + b.h : b.y;
        const wVal = Math.abs(b.w);
        const hVal = Math.abs(b.h);
        const fillAttr = ann.fillShape ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"` : ' fill="none"';
        svgContent += `<rect x="${x}" y="${y}" width="${wVal}" height="${hVal}"${fillAttr} stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}"${opacityAttr} />`;
      } else if (ann.type === 'circle' && ann.bounds) {
        const b = ann.bounds;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const rx = Math.abs(b.w) / 2;
        const ry = Math.abs(b.h) / 2;
        const fillAttr = ann.fillShape ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"` : ' fill="none"';
        svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${fillAttr} stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}"${opacityAttr} />`;
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
        svgContent += `<g${opacityAttr}>${subSvg}</g>`;
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

        const rotVal = ann.rotation || 0;
        const cx = x + b.w / 2;
        const cy = y + b.h / 2;
        const aspect = w / h;

        const textTransform = `rotate(${rotVal}, ${cx}, ${cy}) translate(${textX}, ${textY}) scale(${1 / aspect}, 1)`;
        const transformAttr = ` transform="${textTransform}"`;

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
          const bgTransform = rotVal ? ` transform="rotate(${rotVal}, ${cx}, ${cy})"` : '';
          const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
          const fillOpacity = baseBgColor ? bgOpacity : 0.08 * bgOpacity;
          const fillColor = baseBgColor || '#ffffff';
          subSvg += `<rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" fill="${fillColor}" fill-opacity="${fillOpacity}"${bgTransform} />`;
        }

        subSvg += `<text x="0" y="0" text-anchor="${textAnchor}" font-size="${fontSize}" fill="${ann.color}"${transformAttr} style="${textStyle}">`;
        lines.forEach((line, idx) => {
          const dyAttr = idx === 0 ? '' : ` dy="${ann.lineHeight || 1.2}em"`;
          const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          subSvg += `<tspan x="0"${dyAttr}>${escapedLine}</tspan>`;
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
