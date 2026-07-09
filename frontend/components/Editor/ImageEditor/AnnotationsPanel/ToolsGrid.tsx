/**
 * ToolsGrid.tsx
 * Renders the grid of active drawing tools (pen, shapes, text box, doodle text, eraser) for annotations.
 */

import React from 'react';
import {
  ArrowUpRight,
  Circle,
  Square,
  Edit3,
  Eraser,
  MousePointer2,
  Highlighter,
  Type,
  Sparkles,
  Smile
} from 'lucide-react';
import { DrawToolId } from './types';

interface ToolsGridProps {
  activeDrawTool: DrawToolId;
  setActiveDrawTool: (tool: DrawToolId) => void;
}

const DRAW_TOOLS: { id: DrawToolId; name: string; icon: React.ComponentType<any> }[] = [
  { id: 'select', name: 'Select', icon: MousePointer2 },
  { id: 'freehand', name: 'Pen', icon: Edit3 },
  { id: 'arrow', name: 'Arrow', icon: ArrowUpRight },
  { id: 'rect', name: 'Rect', icon: Square },
  { id: 'circle', name: 'Circle', icon: Circle },
  { id: 'highlighter', name: 'Highlight', icon: Highlighter },
  { id: 'text', name: 'Text', icon: Type },
  { id: 'emoji', name: 'Emoji', icon: Smile },
  { id: 'textPath', name: 'Text Doodle', icon: Sparkles },
  { id: 'eraser', name: 'Eraser', icon: Eraser },
];

export const ToolsGrid: React.FC<ToolsGridProps> = ({ activeDrawTool, setActiveDrawTool }) => {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-3">
        Drawing Tool
      </p>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Drawing Tools">
        {DRAW_TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeDrawTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveDrawTool(tool.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'bg-primary text-black border border-primary shadow-lg shadow-primary/10'
                  : 'bg-white/[0.02] border border-white/5 text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
              role="radio"
              aria-checked={isActive}
              aria-label={tool.name}
              title={tool.name}
            >
              <Icon size={14} />
              <span className="text-[8px] font-bold mt-1.5">{tool.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
