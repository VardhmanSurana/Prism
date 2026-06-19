import React from 'react';
import { Annotation } from '../AnnotationsPanel';
import { getAnnotationBBox } from './utils';
import { HandleId } from './types';

interface SelectionHighlightProps {
  annotation: Annotation;
  onHandleStart?: (handleId: HandleId, e: React.PointerEvent) => void;
  onRotateStart?: (e: React.PointerEvent) => void;
}

export const SelectionHighlight: React.FC<SelectionHighlightProps> = ({ annotation, onHandleStart, onRotateStart }) => {
  const bbox = getAnnotationBBox(annotation);
  const isArrow = annotation.type === 'arrow';

  const handleMouseDown = (handleId: HandleId) => (e: React.PointerEvent) => {
    e.preventDefault();
    onHandleStart?.(handleId, e);
  };

  const handleRotateMouseDown = (e: React.PointerEvent) => {
    e.preventDefault();
    onRotateStart?.(e);
  };

  const HANDLE_R = 4;

  const renderEndpointHandles = () => {
    if (!annotation.points || annotation.points.length < 2) return null;
    const p0 = annotation.points[0];
    const p1 = annotation.points[annotation.points.length - 1];

    return (
      <>
        <circle
          cx={p0.x} cy={p0.y} r={HANDLE_R}
          fill="white" stroke="#84cc16" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handleMouseDown('ep0')}
        />
        <circle
          cx={p1.x} cy={p1.y} r={HANDLE_R}
          fill="white" stroke="#84cc16" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handleMouseDown('ep1')}
        />
      </>
    );
  };

  const renderEdgeHandles = () => {
    const minDim = 20;
    const showTopBottom = bbox.h >= minDim;
    const showLeftRight = bbox.w >= minDim;

    return (
      <>
        {showTopBottom && (
          <>
            <circle
              cx={bbox.x + bbox.w / 2} cy={bbox.y} r={HANDLE_R}
              fill="white" stroke="#84cc16" strokeWidth={2}
              style={{ cursor: 'ns-resize' }}
              onPointerDown={handleMouseDown('tm')}
            />
            <circle
              cx={bbox.x + bbox.w / 2} cy={bbox.y + bbox.h} r={HANDLE_R}
              fill="white" stroke="#84cc16" strokeWidth={2}
              style={{ cursor: 'ns-resize' }}
              onPointerDown={handleMouseDown('bm')}
            />
          </>
        )}
        {showLeftRight && (
          <>
            <circle
              cx={bbox.x} cy={bbox.y + bbox.h / 2} r={HANDLE_R}
              fill="white" stroke="#84cc16" strokeWidth={2}
              style={{ cursor: 'ew-resize' }}
              onPointerDown={handleMouseDown('lm')}
            />
            <circle
              cx={bbox.x + bbox.w} cy={bbox.y + bbox.h / 2} r={HANDLE_R}
              fill="white" stroke="#84cc16" strokeWidth={2}
              style={{ cursor: 'ew-resize' }}
              onPointerDown={handleMouseDown('rm')}
            />
          </>
        )}
      </>
    );
  };

  return (
    <g>
      {/* Selection bounding box */}
      <rect
        x={bbox.x - 5}
        y={bbox.y - 5}
        width={bbox.w + 10}
        height={bbox.h + 10}
        fill="none"
        stroke="#84cc16"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        pointerEvents="none"
      />

      {/* Type-specific handles */}
      {isArrow ? renderEndpointHandles() : renderEdgeHandles()}

      {/* Rotate handle */}
      <g onPointerDown={handleRotateMouseDown}>
        <line
          x1={bbox.x + bbox.w / 2}
          y1={bbox.y - 5}
          x2={bbox.x + bbox.w / 2}
          y2={bbox.y - 22}
          stroke="#84cc16"
          strokeWidth={1.5}
          pointerEvents="none"
        />
        <circle
          cx={bbox.x + bbox.w / 2}
          cy={bbox.y - 26}
          r={HANDLE_R}
          fill="white" stroke="#84cc16" strokeWidth={2}
          style={{ cursor: 'grab' }}
        />
      </g>
    </g>
  );
};
