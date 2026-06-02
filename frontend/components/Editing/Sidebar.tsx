import React from 'react';
import { Maximize2, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react';

export type ToolId = 'transform' | 'adjust' | 'detail' | 'effects';

interface SidebarProps {
  activeTool: ToolId;
  setActiveTool: (tool: ToolId) => void;
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const tabs: { id: ToolId; icon: React.ReactNode; label: string }[] = [
    { id: 'transform', icon: <Maximize2 size={16} />,          label: 'Transform' },
    { id: 'adjust',    icon: <SlidersHorizontal size={16} />,  label: 'Adjust'    },
    { id: 'detail',    icon: <Sparkles size={16} />,           label: 'Detail'    },
    { id: 'effects',   icon: <Wand2 size={16} />,              label: 'Effects'   },
  ];

  return (
    <div className="w-[300px] shrink-0 bg-[#040404] border-r border-white/5 flex flex-col overflow-hidden">
      {/* Tool tabs */}
      <div className="flex shrink-0 border-b border-white/5 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTool(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center min-w-[56px] gap-1.5 py-3.5 text-[9px] font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTool === tab.id
                ? 'text-primary border-primary'
                : 'text-white/30 border-transparent hover:text-white/60'
            }`}
          >
            {tab.icon}
            <span className="truncate w-full text-center px-1">{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Active Panel Content */}
      {children}
    </div>
  );
};
