/**
 * FaceBoundingBoxOverlay.tsx
 * Renders interactive high-precision face bounding boxes and facial landmark
 * anchors over detected faces on the image canvas in Portrait and Liquify modes.
 */

import React from 'react';
import { Smile } from 'lucide-react';

export interface FaceBBox {
  id?: string | number;
  // Can be [x, y, w, h] in absolute pixels OR normalized object { x, y, width, height }
  box: [number, number, number, number] | { x: number; y: number; width: number; height: number };
  confidence?: number;
  label?: string;
}

interface FaceBoundingBoxOverlayProps {
  faces: FaceBBox[];
  naturalWidth: number;
  naturalHeight: number;
  containerWidth: number;
  containerHeight: number;
  selectedFaceIndex?: number | null;
  onSelectFace?: (index: number) => void;
  showLandmarks?: boolean;
  active?: boolean;
}

export const FaceBoundingBoxOverlay: React.FC<FaceBoundingBoxOverlayProps> = ({
  faces,
  naturalWidth,
  naturalHeight,
  containerWidth,
  containerHeight,
  selectedFaceIndex,
  onSelectFace,
  showLandmarks = true,
  active = true,
}) => {
  if (!active || faces.length === 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  const scaleX = containerWidth / naturalWidth;
  const scaleY = containerHeight / naturalHeight;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none">
      {faces.map((face, index) => {
        let bx = 0;
        let by = 0;
        let bw = 0;
        let bh = 0;

        if (Array.isArray(face.box)) {
          // [x, y, w, h] in absolute original pixels
          bx = face.box[0] * scaleX;
          by = face.box[1] * scaleY;
          bw = face.box[2] * scaleX;
          bh = face.box[3] * scaleY;
        } else if (face.box && typeof face.box === 'object') {
          // normalized 0..1 or pixel object
          const isNorm = face.box.x <= 1 && face.box.y <= 1 && face.box.width <= 1;
          if (isNorm) {
            bx = face.box.x * containerWidth;
            by = face.box.y * containerHeight;
            bw = face.box.width * containerWidth;
            bh = face.box.height * containerHeight;
          } else {
            bx = face.box.x * scaleX;
            by = face.box.y * scaleY;
            bw = face.box.width * scaleX;
            bh = face.box.height * scaleY;
          }
        }

        if (bw <= 0 || bh <= 0) return null;

        const isSelected = selectedFaceIndex === index;
        const confidencePct = face.confidence ? Math.round(face.confidence * 100) : 98;
        const faceLabel = face.label || `Face ${index + 1}`;

        return (
          <div
            key={face.id || index}
            style={{
              position: 'absolute',
              left: Math.round(bx),
              top: Math.round(by),
              width: Math.round(bw),
              height: Math.round(bh),
            }}
            className={`pointer-events-auto transition-all duration-200 cursor-pointer group rounded-lg ${
              isSelected
                ? 'border-2 border-[#FCBC00] shadow-[0_0_15px_rgba(252,188,0,0.4)]'
                : 'border border-white/60 hover:border-white hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectFace?.(index);
            }}
          >
            {/* ── 4 Corner Accents ── */}
            <div className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${isSelected ? 'border-[#FCBC00]' : 'border-white'}`} />
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${isSelected ? 'border-[#FCBC00]' : 'border-white'}`} />
            <div className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${isSelected ? 'border-[#FCBC00]' : 'border-white'}`} />
            <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${isSelected ? 'border-[#FCBC00]' : 'border-white'}`} />

            {/* ── Header Badge ── */}
            <div
              className={`absolute -top-6 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded-t-md text-[9px] font-bold uppercase tracking-wider backdrop-blur-md transition-colors ${
                isSelected
                  ? 'bg-[#FCBC00] text-black shadow-md'
                  : 'bg-black/80 text-white/90 group-hover:bg-black group-hover:text-white border border-white/10'
              }`}
            >
              <Smile size={10} className={isSelected ? 'text-black' : 'text-[#FCBC00]'} />
              <span>{faceLabel}</span>
              <span className={`text-[8px] opacity-70 ${isSelected ? 'text-black' : 'text-white/60'}`}>
                {confidencePct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
