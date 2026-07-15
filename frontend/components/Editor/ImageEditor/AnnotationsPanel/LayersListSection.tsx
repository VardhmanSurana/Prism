/**
 * LayersListSection.tsx
 * Renders the list of active annotations (pen strokes, shapes, text layers), supporting deletion, visibility toggles, and ordering.
 */

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Eraser } from 'lucide-react';
import { Annotation } from './types';

interface LayersListSectionProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
}

const TOOL_LABELS: Record<string, string> = {
  select: 'Select',
  freehand: 'Pen',
  arrow: 'Arrow',
  rect: 'Rect',
  circle: 'Circle',
  highlighter: 'Highlight',
  text: 'Text',
  textPath: 'Text Doodle',
  eraser: 'Eraser',
};

const getToolLabel = (type: string) => TOOL_LABELS[type] || type;

export const LayersListSection: React.FC<LayersListSectionProps> = ({
  annotations,
  onChange,
}) => {
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false);

  const handleDelete = (id: string) => {
    onChange(annotations.filter(a => a.id !== id));
  };

  const handleToggleVisibility = (id: string) => {
    onChange(
      annotations.map((a) => {
        if (a.id !== id) return a;
        return { ...a, visible: a.visible === false ? true : false };
      })
    );
  };

  return (
    <div className={`flex flex-col overflow-hidden transition-all duration-200 ${isLayersCollapsed ? 'h-auto min-h-0' : 'flex-1 min-h-[160px]'}`}>
      <button
        onClick={() => setIsLayersCollapsed(prev => !prev)}
        className="flex items-center justify-between w-full text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-3 shrink-0 hover:text-white transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1"
      >
        <span>Layers ({annotations.length})</span>
        {isLayersCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>

      {!isLayersCollapsed && (
        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 bg-black/25 rounded-2xl max-h-[220px]">
          {annotations.length === 0 ? (
            <div className="w-full h-full min-h-[120px] flex items-center justify-center text-zinc-500 text-[10px] font-mono select-none">
              No markup layers yet
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {annotations.map((ann, index) => {
                const isVisible = ann.visible !== false;
                return (
                  <div
                    key={ann.id}
                    className={`flex items-center justify-between p-2.5 px-3 hover:bg-white/[0.01] transition-all group ${
                      !isVisible ? 'bg-black/10' : ''
                    }`}
                  >
                    <div className={`flex items-center gap-2.5 min-w-0 transition-opacity ${!isVisible ? 'opacity-40' : ''}`}>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                        style={{ backgroundColor: ann.color }}
                      />
                      <span className="text-xs text-white/70 font-semibold uppercase tracking-wider text-[10px]">
                        {index + 1}. {getToolLabel(ann.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 transition-all">
                      <button
                        onClick={() => handleToggleVisibility(ann.id)}
                        className={`p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                          isVisible ? 'text-zinc-400 hover:text-white' : 'text-white/60 hover:text-white'
                        }`}
                        title={isVisible ? "Hide layer" : "Show layer"}
                        aria-label={isVisible ? "Hide layer" : "Show layer"}
                      >
                        {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="p-1 rounded-lg text-white/80 transition-colors hover:bg-red-500/10 hover:text-red-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-300"
                        title="Delete layer"
                        aria-label="Delete layer"
                      >
                        <Eraser size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
