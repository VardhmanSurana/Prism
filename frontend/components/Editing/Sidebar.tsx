import React from 'react';
import { Maximize2, SlidersHorizontal, Sparkles, Wand2, User, Layers, Paintbrush } from 'lucide-react';

export type ToolId = 'transform' | 'adjust' | 'detail' | 'portrait' | 'selective' | 'effects' | 'inpaint';

interface SidebarProps {
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const tabs: { id: ToolId; icon: React.ReactNode; label: string }[] = [
    { id: 'inpaint',   icon: <Paintbrush size={18} />,         label: 'AI Tools'   },
    { id: 'adjust',    icon: <SlidersHorizontal size={18} />,  label: 'Adjust'     },
    { id: 'detail',    icon: <Sparkles size={18} />,           label: 'Detail'     },
    { id: 'portrait',  icon: <User size={18} />,               label: 'Portrait'   },
    { id: 'selective', icon: <Layers size={18} />,             label: 'Selective'  },
    { id: 'effects',   icon: <Wand2 size={18} />,              label: 'Effects'    },
    { id: 'transform', icon: <Maximize2 size={18} />,          label: 'Transform'  },
  ];

  return (
    <div className="flex h-full shrink-0 overflow-hidden">
      {/* Narrow vertical tab column on the left */}
      <div className="w-[76px] shrink-0 bg-[#080808] border-r border-white/5 flex flex-col items-center py-4 space-y-5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTool(activeTool === tab.id ? null : tab.id)}
            className={`w-full flex flex-col items-center justify-center gap-1.5 py-3 transition-all relative ${
              activeTool === tab.id
                ? 'text-primary'
                : 'text-white/35 hover:text-white/70'
            }`}
          >
            {/* Active left indicator line */}
            {activeTool === tab.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r" />
            )}
            
            {/* Pink notification dot for AI Tools */}
            {tab.id === 'inpaint' && (
              <div className="absolute right-4 top-2.5 w-1.5 h-1.5 bg-pink-500 rounded-full" />
            )}
            
            {tab.icon}
            <span className="text-[9px] font-semibold tracking-tight text-center px-1 max-w-[68px] truncate mt-0.5">
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Active Panel Content on the right */}
      {activeTool && (
        <div className="w-[248px] shrink-0 bg-[#040404] border-r border-white/5 flex flex-col overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
};
