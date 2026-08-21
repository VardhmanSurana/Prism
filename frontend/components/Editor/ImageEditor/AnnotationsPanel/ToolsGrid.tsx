/**
 * ToolsGrid.tsx
 * Renders the grid of active drawing tools for annotations, including a unified Shapes button
 * with dynamic MS Paint-style shape picker menu on right-click or dropdown toggle.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  Eraser,
  MousePointer2,
  Highlighter,
  Type,
  Sparkles,
  Smile,
  ChevronDown,
  X,
} from 'lucide-react';
import { DrawToolId, VectorShapeType } from './types';
import { ALL_SHAPES, isPointBasedShape, isBoundedShape, ShapeItem } from '../AnnotationCanvas/shapeUtils';

interface ToolsGridProps {
  activeDrawTool: DrawToolId;
  setActiveDrawTool: (tool: DrawToolId) => void;
}

export const ToolsGrid: React.FC<ToolsGridProps> = ({ activeDrawTool, setActiveDrawTool }) => {
  const [lastSelectedShape, setLastSelectedShape] = useState<VectorShapeType>('rect');
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // If active tool changes to a specific shape, keep lastSelectedShape in sync
  useEffect(() => {
    if (isPointBasedShape(activeDrawTool) || isBoundedShape(activeDrawTool)) {
      setLastSelectedShape(activeDrawTool as VectorShapeType);
    }
  }, [activeDrawTool]);

  // Close menu on outside click or Escape key
  useEffect(() => {
    if (!isShapesMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsShapesMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsShapesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShapesMenuOpen]);

  const activeShapeMeta = ALL_SHAPES.find(s => s.id === lastSelectedShape) || ALL_SHAPES[0];
  const ActiveShapeIcon = activeShapeMeta.icon;
  const isAnyShapeActive = isPointBasedShape(activeDrawTool) || isBoundedShape(activeDrawTool);

  const handleShapeButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveDrawTool(lastSelectedShape);
  };

  const handleShapeButtonContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsShapesMenuOpen(prev => !prev);
  };

  const handleSelectShape = (shape: ShapeItem) => {
    setLastSelectedShape(shape.id);
    setActiveDrawTool(shape.id);
    setIsShapesMenuOpen(false);
  };

  // Grouped shapes for the MS Paint-like menu
  const shapeCategories = [
    { title: 'Lines & Arrows', items: ALL_SHAPES.filter(s => s.category === 'lines') },
    { title: 'Basic Shapes', items: ALL_SHAPES.filter(s => s.category === 'basic') },
    { title: 'Polygons & Stars', items: ALL_SHAPES.filter(s => s.category === 'polygons') },
    { title: 'Symbols & Callouts', items: ALL_SHAPES.filter(s => s.category === 'symbols' || s.category === 'callouts') },
  ];

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Drawing Tool
        </p>
        <span className="text-[8.5px] text-zinc-500 font-medium">
          Right-click shape for menu
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Drawing Tools">
        {/* 1. Select Tool */}
        <button
          onClick={() => setActiveDrawTool('select')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'select' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'select'}
          aria-label="Select"
          title="Select & Transform Annotations (V)"
        >
          <MousePointer2 size={14} />
          <span className="text-[8px] font-bold mt-1.5">Select</span>
        </button>

        {/* 2. Freehand Pen Tool */}
        <button
          onClick={() => setActiveDrawTool('freehand')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'freehand' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'freehand'}
          aria-label="Pen"
          title="Freehand Vector Pen (P)"
        >
          <Edit3 size={14} />
          <span className="text-[8px] font-bold mt-1.5">Pen</span>
        </button>

        {/* 3. Unified Vector Shapes Tool (Combines Arrow, Rectangle, Circle and 14+ MS Paint Shapes) */}
        <div className="relative">
          <button
            onClick={handleShapeButtonClick}
            onContextMenu={handleShapeButtonContextMenu}
            className={`editor-btn editor-card-btn w-full ${
              isAnyShapeActive ? 'active' : ''
            } flex flex-col items-center justify-center p-2 relative group`}
            role="radio"
            aria-checked={isAnyShapeActive}
            aria-label={`Shape (${activeShapeMeta.name})`}
            title={`${activeShapeMeta.name} (Left-click to draw, Right-click to choose shape)`}
          >
            <ActiveShapeIcon size={14} />
            <span className="text-[8px] font-bold mt-1.5 truncate max-w-full px-0.5">
              {activeShapeMeta.name.split(' ')[0]}
            </span>

            {/* Dropdown chevron trigger */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsShapesMenuOpen(prev => !prev);
              }}
              className="absolute top-1 right-1 p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Open Shape Palette"
            >
              <ChevronDown size={9} />
            </span>
          </button>
        </div>

        {/* 4. Highlighter Tool */}
        <button
          onClick={() => setActiveDrawTool('highlighter')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'highlighter' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'highlighter'}
          aria-label="Highlight"
          title="Highlighter Marker (H)"
        >
          <Highlighter size={14} />
          <span className="text-[8px] font-bold mt-1.5">Highlight</span>
        </button>

        {/* 5. Text Box Tool */}
        <button
          onClick={() => setActiveDrawTool('text')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'text' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'text'}
          aria-label="Text"
          title="Text Box Layer (T)"
        >
          <Type size={14} />
          <span className="text-[8px] font-bold mt-1.5">Text</span>
        </button>

        {/* 6. Emoji Stamp Tool */}
        <button
          onClick={() => setActiveDrawTool('emoji')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'emoji' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'emoji'}
          aria-label="Emoji"
          title="Emoji Stamp Picker"
        >
          <Smile size={14} />
          <span className="text-[8px] font-bold mt-1.5">Emoji</span>
        </button>

        {/* 7. Text Doodle Path Tool */}
        <button
          onClick={() => setActiveDrawTool('textPath')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'textPath' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'textPath'}
          aria-label="Text Doodle"
          title="Text Along Path Doodle (D)"
        >
          <Sparkles size={14} />
          <span className="text-[8px] font-bold mt-1.5">Doodle</span>
        </button>

        {/* 8. Eraser Tool */}
        <button
          onClick={() => setActiveDrawTool('eraser')}
          className={`editor-btn editor-card-btn ${
            activeDrawTool === 'eraser' ? 'active' : ''
          } flex flex-col items-center justify-center p-2`}
          role="radio"
          aria-checked={activeDrawTool === 'eraser'}
          aria-label="Eraser"
          title="Brush Eraser (E)"
        >
          <Eraser size={14} />
          <span className="text-[8px] font-bold mt-1.5">Eraser</span>
        </button>
      </div>

      {/* ── MS Paint-Style Shapes Palette Popover ── */}
      {isShapesMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 right-0 top-full mt-2 z-50 p-3 bg-[#16181f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                Vector Shapes Palette
              </span>
            </div>
            <button
              onClick={() => setIsShapesMenuOpen(false)}
              className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close Palette"
            >
              <X size={12} />
            </button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {shapeCategories.map(cat => (
              <div key={cat.title}>
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                  {cat.title}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {cat.items.map(shape => {
                    const ShapeIcon = shape.icon;
                    const isSelected = lastSelectedShape === shape.id;
                    return (
                      <button
                        key={shape.id}
                        onClick={() => handleSelectShape(shape)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-left ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                            : 'bg-white/[0.03] border-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20'
                        }`}
                        title={shape.name}
                      >
                        <ShapeIcon size={15} strokeWidth={isSelected ? 2 : 1.5} />
                        <span className="text-[7.5px] font-medium mt-1 truncate max-w-full text-center">
                          {shape.name.replace(' / Oval', '').replace('5-Point ', '').replace('4-Point ', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-white/40 font-medium">
            <span>{ALL_SHAPES.length} MS Paint Vector Shapes</span>
            <span>Click to select</span>
          </div>
        </div>
      )}
    </div>
  );
};
