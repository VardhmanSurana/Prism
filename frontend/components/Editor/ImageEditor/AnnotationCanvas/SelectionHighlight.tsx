import React from 'react';
import { Annotation } from '../AnnotationsPanel';
import { getAnnotationBBox } from './utils';
import { HandleId } from './types';

interface SelectionHighlightProps {
  annotation: Annotation;
  onHandleStart?: (handleId: HandleId, e: React.PointerEvent) => void;
}

export const SelectionHighlight: React.FC<SelectionHighlightProps> = ({ annotation, onHandleStart }) => {
  const bbox = getAnnotationBBox(annotation);
  const isArrow = annotation.type === 'arrow';

  const handleMouseDown = (handleId: HandleId) => (e: React.PointerEvent) => {
    e.preventDefault();
    onHandleStart?.(handleId, e);
  };

  const HANDLE_R = 5;

  const renderEndpointHandles = () => {
    if (!annotation.points || annotation.points.length < 2) return null;
    const p0 = annotation.points[0];
    const p1 = annotation.points[annotation.points.length - 1];

    return (
      <>
        <circle
          cx={p0.x} cy={p0.y} r={HANDLE_R}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handleMouseDown('ep0')}
        />
        <circle
          cx={p1.x} cy={p1.y} r={HANDLE_R}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handleMouseDown('ep1')}
        />
      </>
    );
  };

  const renderResizeHandles = () => {
    const cornerSize = 6;

    return (
      <>
        {/* Corner handles — circles */}
        <rect
          x={bbox.x - cornerSize / 2} y={bbox.y - cornerSize / 2}
          width={cornerSize} height={cornerSize}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={handleMouseDown('tl')}
        />
        <rect
          x={bbox.x + bbox.w - cornerSize / 2} y={bbox.y - cornerSize / 2}
          width={cornerSize} height={cornerSize}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'nesw-resize' }}
          onPointerDown={handleMouseDown('tr')}
        />
        <rect
          x={bbox.x - cornerSize / 2} y={bbox.y + bbox.h - cornerSize / 2}
          width={cornerSize} height={cornerSize}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'nesw-resize' }}
          onPointerDown={handleMouseDown('bl')}
        />
        <rect
          x={bbox.x + bbox.w - cornerSize / 2} y={bbox.y + bbox.h - cornerSize / 2}
          width={cornerSize} height={cornerSize}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={handleMouseDown('br')}
        />

        {/* Side pill handles — left-middle, right-middle */}
        <rect
          x={bbox.x - 3} y={bbox.y + bbox.h / 2 - 6}
          width={6} height={12}
          rx={3} ry={3}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={handleMouseDown('lm')}
        />
        <rect
          x={bbox.x + bbox.w - 3} y={bbox.y + bbox.h / 2 - 6}
          width={6} height={12}
          rx={3} ry={3}
          fill="white" stroke="#22c55e" strokeWidth={2}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={handleMouseDown('rm')}
        />
      </>
    );
  };

  return (
    <g>
      {/* Selection bounding box — solid border with shadow */}
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.w}
        height={bbox.h}
        fill="none"
        stroke="#22c55e"
        strokeWidth={2}
        pointerEvents="none"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
      />

      {/* Type-specific handles */}
      {isArrow ? renderEndpointHandles() : renderResizeHandles()}
    </g>
  );
};
