/**
 * LassoToolSelection.tsx
 * Tool selection grid (Freehand, Polygonal, Magnetic) and Boolean combination mode buttons.
 */

import React from 'react';
import {
  MousePointer,
  Magnet,
  Pentagon,
  Minimize2,
  Plus,
  Minus,
  BoxSelect,
  Sparkles,
} from 'lucide-react';
import { LassoState, LassoType, LassoOperation, MagneticSettings } from '../lassoEngine';
import { EditorSlider } from '../ui/EditorSlider';

interface LassoToolSelectionProps {
  state: LassoState;
  update: (patch: Partial<LassoState>) => void;
  updateMagnetic: (patch: Partial<MagneticSettings>) => void;
}

export const LassoToolSelection: React.FC<LassoToolSelectionProps> = ({
  state,
  update,
  updateMagnetic,
}) => {
  return (
    <div className="space-y-3 pt-1">
      {/* Tool Type Selector Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { id: 'freehand', label: 'Freehand', icon: <MousePointer size={11} /> },
            { id: 'polygonal', label: 'Polygonal', icon: <Pentagon size={11} /> },
            { id: 'magnetic', label: 'Snapping', icon: <Magnet size={11} /> },
          ] as const
        ).map(tool => {
          const isSelected = state.type === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() =>
                update({ type: tool.id as LassoType, points: [], liveWirePath: [], isClosed: false })
              }
              className={`editor-btn editor-chip-btn ${
                isSelected ? 'active' : ''
              } py-2 px-1 text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1`}
            >
              {tool.icon}
              <span className="truncate">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Magnetic Intelligent Scissors Fine-Tuning */}
      {state.type === 'magnetic' && (
        <div className="bg-black/30 p-2.5 rounded-lg border border-primary/20 space-y-3">
          <div className="flex items-center gap-1 text-[9px] font-bold text-primary uppercase tracking-wider">
            <Sparkles size={10} /> Edge Snapping Settings
          </div>

          <EditorSlider
            label="Edge Sensitivity"
            value={state.magnetic.sensitivity}
            onChange={val => updateMagnetic({ sensitivity: val })}
            min={10}
            max={100}
            defaultValue={50}
            unit="%"
          />

          <EditorSlider
            label="Snap Radius"
            value={state.magnetic.snapRadius}
            onChange={val => updateMagnetic({ snapRadius: val })}
            min={5}
            max={40}
            defaultValue={15}
            unit=" px"
          />
        </div>
      )}

      {/* Boolean Combination Modes */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block">
          Combine Mode
        </span>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { id: 'new', label: 'New', icon: <Minimize2 size={9} /> },
              { id: 'add', label: 'Add', icon: <Plus size={9} /> },
              { id: 'subtract', label: 'Sub', icon: <Minus size={9} /> },
              { id: 'intersect', label: 'Intersect', icon: <BoxSelect size={9} /> },
            ] as const
          ).map(mode => {
            const isSelected = state.operation === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => update({ operation: mode.id as LassoOperation })}
                className={`editor-btn editor-chip-btn ${
                  isSelected ? 'active' : ''
                } py-1.5 px-1 font-bold text-[9px] uppercase flex items-center justify-center gap-1`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

