/**
 * LassoRefineSection.tsx
 * Refine Edge & Mask sliders: Feather, Smooth, Shift Edge, Mask Contrast.
 */

import React from 'react';
import { LassoState, RefineEdgeSettings } from '../lassoEngine';
import { EditorSlider } from '../ui/EditorSlider';

interface LassoRefineSectionProps {
  state: LassoState;
  updateRefine: (patch: Partial<RefineEdgeSettings>) => void;
}

export const LassoRefineSection: React.FC<LassoRefineSectionProps> = ({
  state,
  updateRefine,
}) => {
  return (
    <div className="space-y-3 pt-1">
      {/* Feather Slider */}
      <EditorSlider
        label="Feather Radius"
        value={state.refine.feather}
        onChange={val => updateRefine({ feather: val })}
        min={0}
        max={100}
        defaultValue={0}
        unit=" px"
      />

      {/* Smooth Slider */}
      <EditorSlider
        label="Smooth Contour"
        value={state.refine.smooth}
        onChange={val => updateRefine({ smooth: val })}
        min={0}
        max={50}
        defaultValue={0}
        unit=" px"
      />

      {/* Shift Edge (Expand / Contract) */}
      <EditorSlider
        label="Shift Edge (Expand/Contract)"
        value={state.refine.shiftEdge}
        onChange={val => updateRefine({ shiftEdge: val })}
        min={-30}
        max={30}
        defaultValue={0}
        unit=" px"
        bipolar
      />

      {/* Mask Contrast */}
      <EditorSlider
        label="Mask Contrast"
        value={state.refine.contrast}
        onChange={val => updateRefine({ contrast: val })}
        min={0}
        max={100}
        defaultValue={0}
        unit="%"
      />
    </div>
  );
};

