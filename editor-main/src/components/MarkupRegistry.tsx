import React, { CanvasHTMLAttributes } from 'react';

/**
 * ============================================================================
 *               SYSTEM MARKUP LAYER REGISTRY & VECTOR MATH SYSTEM
 * ============================================================================
 * This file encapsulates the core code schemas, type contracts, mathematical
 * algorithms, and reference components for everything under the "MARKUP" scope.
 * 
 * Features Registry:
 * 1. Unified Types System (DrawingLine, VectorShape, TextLayer, Points, Tools)
 * 2. Curved Canvas Mathematics (Spline-like text-to-path interpolation)
 * 3. Case Transforms Processor (None, UPPERCASE, lowercase, Capitalize)
 * 4. Interactive Reference Schema Panel for the editor workspace.
 */

// ==========================================
// 1. TYPINGS & DATA CONTRACTS
// ==========================================

export type MarkupTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'text'
  | 'eraser'
  | 'textPath';

export interface MarkupPoint {
  x: number; // Normalized (0 - 100) percent of container width
  y: number; // Normalized (0 - 100) percent of container height
}

export interface MarkupDrawingLine {
  id: string;
  type: 'pen' | 'highlighter' | 'textPath';
  color: string;
  strokeWidth: number;
  points: MarkupPoint[];
  doodleText?: string;
  fontSize?: number;
  fontFamily?: string;
  showGuidePath?: boolean;
}

export interface MarkupVectorShape {
  id: string;
  type: 'rect' | 'circle' | 'arrow';
  x: number; // Percentage coordinate start
  y: number; // Percentage coordinate start
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  opacity?: number; // 0 to 100
}

export interface MarkupTextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  textAlign: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  opacity?: number;
  rotation?: number;
  lineHeight?: number;
  letterSpacing?: number;
  bgColor?: string;
  textStroke?: string;
  textShadow?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

// ==========================================
// 2. VECTOR PATH & RENDERING ALGORITHMS
// ==========================================

/**
 * Dynamically draws string text character-by-character along an arbitrary curving bezier/line path of points.
 * Handles automatic scaling, orientation rotation alignment, and character width pacing.
 */
export function drawTextAlongPathHelper(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[], // Normalized coordinates (0-100)
  text: string,
  fontFamily: string,
  fontSize: number,
  color: string,
  canvasWidth: number,
  canvasHeight: number,
  showGuidePath: boolean
) {
  if (points.length < 2) return;
  const word = text || 'peace in the air';

  // Map 0-100 percentage coordinates to standard physical pixels on canvas
  const pixelPoints = points.map((pt) => ({
    x: (pt.x / 100) * canvasWidth,
    y: (pt.y / 100) * canvasHeight,
  }));

  ctx.save();

  // Draw 1.2px subtle guide wire curve if enabled by the user
  if (showGuidePath) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.25;
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) {
      ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0; // restore alpha
  }

  // Set typography styles on canvas context
  ctx.font = `500 ${fontSize}px "${fontFamily || 'Space Grotesk'}", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Pre-calculate segments and cumulative distances
  const lengths: number[] = [0];
  let accumulatedDist = 0;
  for (let i = 1; i < pixelPoints.length; i++) {
    const dx = pixelPoints[i].x - pixelPoints[i - 1].x;
    const dy = pixelPoints[i].y - pixelPoints[i - 1].y;
    accumulatedDist += Math.sqrt(dx * dx + dy * dy);
    lengths.push(accumulatedDist);
  }

  // Linear Interpolator for points and tangency angle along the custom drawn curve
  const interpolateAlongPath = (d: number): { x: number; y: number; angle: number } | null => {
    if (d < 0 || d > accumulatedDist) return null;
    let idx = 0;
    while (idx < lengths.length - 1 && lengths[idx + 1] < d) {
      idx++;
    }
    const startL = lengths[idx];
    const endL = lengths[idx + 1];
    if (startL === endL) return null;

    const t = (d - startL) / (endL - startL);
    const p1 = pixelPoints[idx];
    const p2 = pixelPoints[idx + 1];

    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
      angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
    };
  };

  let currentDistOnPath = 4; // Start micro-offset padding
  let letterIndex = 0;

  while (currentDistOnPath < accumulatedDist) {
    const char = word[letterIndex % word.length];
    // Measure dynamic width of characters safely
    const charWidth = ctx.measureText(char).width || fontSize * 0.55;

    const targetPositionOnPath = currentDistOnPath + charWidth / 2;
    const interp = interpolateAlongPath(targetPositionOnPath);
    if (!interp) break;

    ctx.save();
    ctx.translate(interp.x, interp.y);
    ctx.rotate(interp.angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();

    currentDistOnPath += charWidth + 2.5; // pacer letter-spacing padding
    letterIndex++;
  }

  ctx.restore();
}

// ==========================================
// 3. TEXT LAYER CASING STYLING APPLIER
// ==========================================

/**
 * String transformer helper matching the four modes of our TEXT CASE TRANSFORM selector:
 * none, uppercase, lowercase, capitalize
 */
export function applyTextCaseTransform(
  text: string,
  transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize' = 'none'
): string {
  if (!text) return '';
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    case 'none':
    default:
      return text;
  }
}

// ==========================================
// 4. MARKUP REGISTRY VISUAL COMPONENT
// ==========================================

interface MarkupRegistryProps {
  className?: string;
  activeLinesCount?: number;
  activeShapesCount?: number;
  activeTextsCount?: number;
}

/**
 * Visual reference card summarizing all active markup engines configured on the workspace.
 * Uses luxurious styling matched with the Dark Slate/Midnight theme.
 */
export default function MarkupRegistry({
  className = '',
  activeLinesCount = 0,
  activeShapesCount = 0,
  activeTextsCount = 0,
}: MarkupRegistryProps) {
  return (
    <div className={`p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4 shadow-xl ${className}`}>
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            ALL-IN-ONE MARKUP CODE REGISTRY
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">
          SYSTEM ACTIVE
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed">
        This registry encapsulates the math formulas and data structures driving the markup workspace.
        This provides a centralized code storage of vector drawings, typography transformations, shapes, and double-click doodle listeners.
      </p>

      {/* Grid count cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#111115] border border-zinc-900 p-2.5 rounded-lg text-center">
          <span className="text-[9px] text-[#8e8e9a] block font-bold uppercase tracking-wider">
            DRAWINGS
          </span>
          <span className="font-mono text-lg font-bold text-white mt-1 block">
            {activeLinesCount}
          </span>
        </div>
        <div className="bg-[#111115] border border-zinc-900 p-2.5 rounded-lg text-center">
          <span className="text-[9px] text-[#8e8e9a] block font-bold uppercase tracking-wider">
            SHAPES
          </span>
          <span className="font-mono text-lg font-bold text-white mt-1 block">
            {activeShapesCount}
          </span>
        </div>
        <div className="bg-[#111115] border border-zinc-900 p-2.5 rounded-lg text-center">
          <span className="text-[9px] text-[#8e8e9a] block font-bold uppercase tracking-wider">
            TEXT LAYERS
          </span>
          <span className="font-mono text-lg font-bold text-white mt-1 block">
            {activeTextsCount}
          </span>
        </div>
      </div>

      {/* Code specs summary section */}
      <div className="space-y-2.5 pt-1">
        <span className="text-[9px] text-[#8e8e9a] block font-bold uppercase tracking-widest">
          CORE MARKUP IMPLEMENTATIONS:
        </span>

        {/* List of features */}
        <div className="space-y-2 text-[11px] text-zinc-400">
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-bold">✓</span>
            <div>
              <strong className="text-zinc-200">Text Casing Switcher:</strong> Configured for high-fidelity interactive toggling between <span className="text-zinc-300 font-mono">none</span>, <span className="text-zinc-300 font-mono">uppercase</span>, <span className="text-zinc-300 font-mono">lowercase</span>, and <span className="text-zinc-300 font-mono">capitalize</span>.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-bold">✓</span>
            <div>
              <strong className="text-zinc-200">Double-Click Text Doodle Activation:</strong> Allows immediate cursor transformation and drawing curve text when clicking anywhere on the viewport.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-bold">✓</span>
            <div>
              <strong className="text-zinc-200">Curving path interpolation:</strong> Measures vector geometry length in pixels and places letters perpendicular to the tangent of local segment limits.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
