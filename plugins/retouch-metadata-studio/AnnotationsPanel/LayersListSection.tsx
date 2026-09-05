/**
 * LayersListSection.tsx
 * Renders the list of active annotations (pen strokes, shapes, text layers), supporting deletion, visibility toggles, and ordering.
 */

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Eraser, CheckSquare } from 'lucide-react';
import { Annotation, DrawToolId } from './types';

export interface LayersListSectionProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  selectedAnnIds?: string[];
  setSelectedAnnIds?: (ids: string[]) => void;
  setActiveDrawTool?: (tool: DrawToolId) => void;
}

const TOOL_LABELS: Record<string, string> = {
  select: 'Select',
  freehand: 'Pen',
  arrow: 'Arrow',
  doubleArrow: 'Double Arrow',
  line: 'Line',
  rect: 'Rectangle',
  roundedRect: 'Rounded Rect',
  circle: 'Circle / Oval',
  triangle: 'Triangle',
  rightTriangle: 'Right Triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: '5-Point Star',
  fourPointStar: '4-Point Star',
  heart: 'Heart',
  lightning: 'Lightning',
  speechBubble: 'Speech Bubble',
  cloud: 'Cloud',
  highlighter: 'Highlight',
  text: 'Text',
  textPath: 'Text Doodle',
  eraser: 'Eraser',
};

const getToolLabel = (type: string) => TOOL_LABELS[type] || type;

export const LayersListSection: React.FC<LayersListSectionProps> = ({
  annotations,
  onChange,
  selectedAnnId,
  setSelectedAnnId,
  selectedAnnIds = [],
  setSelectedAnnIds,
  setActiveDrawTool,
}) => {
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false);

  const effectiveSelectedIds = selectedAnnIds.length > 0
    ? selectedAnnIds
    : (selectedAnnId ? [selectedAnnId] : []);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(annotations.filter(a => a.id !== id));
    if (effectiveSelectedIds.includes(id)) {
      const next = effectiveSelectedIds.filter(i => i !== id);
      setSelectedAnnIds?.(next);
      setSelectedAnnId?.(next[0] ?? null);
    }
  };

  const handleToggleVisibility = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(
      annotations.map((a) => {
        if (a.id !== id) return a;
        return { ...a, visible: a.visible === false ? true : false };
      })
    );
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    setActiveDrawTool?.('select');
    if (e.shiftKey) {
      const next = effectiveSelectedIds.includes(id)
        ? effectiveSelectedIds.filter(i => i !== id)
        : [...effectiveSelectedIds, id];
      setSelectedAnnIds?.(next);
      setSelectedAnnId?.(next[0] ?? null);
    } else {
      setSelectedAnnIds?.([id]);
      setSelectedAnnId?.(id);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden transition-all duration-200 ${isLayersCollapsed ? 'h-auto min-h-0' : 'flex-1 min-h-[160px]'}`}>
      <div className="flex items-center justify-between w-full mb-3 shrink-0">
        <button
          onClick={() => setIsLayersCollapsed(prev => !prev)}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 hover:text-white transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1"
        >
          <span>Layers ({annotations.length})</span>
          {isLayersCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        {annotations.length > 0 && (
          <div className="flex items-center gap-1.5 text-[9px]">
            {effectiveSelectedIds.length > 0 ? (
              <button
                onClick={() => {
                  setSelectedAnnIds?.([]);
                  setSelectedAnnId?.(null);
                }}
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                Clear ({effectiveSelectedIds.length})
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedAnnIds?.(annotations.map(a => a.id));
                  setSelectedAnnId?.(annotations[0]?.id ?? null);
                  setActiveDrawTool?.('select');
                }}
                className="text-zinc-400 hover:text-white cursor-pointer font-medium"
              >
                Select All
              </button>
            )}
          </div>
        )}
      </div>

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
                const isSelected = effectiveSelectedIds.includes(ann.id);
                return (
                  <div
                    key={ann.id}
                    onClick={(e) => handleRowClick(ann.id, e)}
                    className={`flex items-center justify-between p-2.5 px-3 transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-primary/20 border-l-2 border-primary text-white font-medium'
                        : 'hover:bg-white/[0.04] border-l-2 border-transparent text-white/70'
                    } ${!isVisible ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                        style={{ backgroundColor: ann.color }}
                      />
                      <span className="text-xs uppercase tracking-wider text-[10px] truncate">
                        {index + 1}. {getToolLabel(ann.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 transition-all">
                      <button
                        onClick={(e) => handleToggleVisibility(ann.id, e)}
                        className={`p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                          isVisible ? 'text-zinc-400 hover:text-white' : 'text-white/60 hover:text-white'
                        }`}
                        title={isVisible ? "Hide layer" : "Show layer"}
                        aria-label={isVisible ? "Hide layer" : "Show layer"}
                      >
                        {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        onClick={(e) => handleDelete(ann.id, e)}
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
