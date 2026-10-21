/**
 * ToolsSidebar.tsx
 * Sidebar shell that mounts every panel and toggles visibility per active tool.
 */
import React from 'react';
import { Sidebar, ToolId } from '../../Sidebar';
import { PANELS, PanelCtx } from '../panelRegistry';

export interface ToolsSidebarProps {
  activeTool: ToolId | null;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolId | null>>;
  ctx: PanelCtx;
}

export const ToolsSidebar: React.FC<ToolsSidebarProps> = ({ activeTool, setActiveTool, ctx }) => (
  <Sidebar activeTool={activeTool} setActiveTool={setActiveTool}>
    {PANELS.map(([toolId, render]) => (
      <div
        key={toolId}
        style={activeTool === toolId ? undefined : { visibility: 'hidden', position: 'absolute', pointerEvents: 'none' }}
        className="flex-1 min-h-0 w-full flex flex-col"
      >
        <React.Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 text-white/40">
              <div className="w-5 h-5 border-2 border-[#FCBC00] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading tool module...</span>
            </div>
          }
        >
          {render(ctx)}
        </React.Suspense>
      </div>
    ))}
  </Sidebar>
);
