/**
 * LassoCanvas.tsx
 * Shell component composing the lasso canvas hooks + the view renderer.
 */
import React, { useRef } from 'react';
import { LassoState } from '../lassoEngine';
import { LassoCanvasView } from './LassoCanvasView';
import { useLassoAnimation } from './useLassoAnimation';
import { useLassoImageData } from './useLassoImageData';
import { useLassoKeyboard } from './useLassoKeyboard';
import { useLassoMasks } from './useLassoMasks';
import { useLassoPointer } from './useLassoPointer';

interface LassoCanvasProps {
  width: number;
  height: number;
  imageSrc?: string;
  state: LassoState;
  onChange: (s: LassoState) => void;
  onSelectionComplete?: (maskCanvas: HTMLCanvasElement) => void;
}

export const LassoCanvas: React.FC<LassoCanvasProps> = ({
  width, height, imageSrc, state, onChange, onSelectionComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const masks = useLassoMasks({ width, height, state, onChange, onSelectionComplete });
  const dashOffset = useLassoAnimation();
  const { sourceImgData, costMap } = useLassoImageData(imageSrc, width, height);
  const { isSpacePressed } = useLassoKeyboard({ state, width, height, onChange, masks });
  const pointer = useLassoPointer({
    width, height, state, onChange, isSpacePressed,
    sourceImgData, costMap, canvasRef, commitSelection: masks.commitSelection,
  });

  return (
    <LassoCanvasView
      canvasRef={canvasRef}
      width={width}
      height={height}
      state={state}
      dashOffset={dashOffset}
      cursorPos={pointer.cursorPos}
      isNearStart={pointer.isNearStart}
      isSpacePressed={isSpacePressed}
      maskCanvasRef={masks.refinedMaskCanvasRef}
      maskBoundaryRef={masks.maskBoundaryRef}
      onPointerDown={pointer.handlePointerDown}
      onPointerMove={pointer.handlePointerMove}
      onPointerUp={pointer.handlePointerUp}
      onDoubleClick={pointer.handleDoubleClick}
      onContextMenu={pointer.handleContextMenu}
    />
  );
};
