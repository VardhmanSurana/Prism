import React from 'react';
import { Maximize2, SlidersHorizontal, Sparkles, Wand2, User, Layers, Paintbrush, X } from 'lucide-react';

export type ToolId = 'transform' | 'adjust' | 'detail' | 'portrait' | 'selective' | 'effects' | 'inpaint';

interface SidebarProps {
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const tabs: { id: ToolId; icon: React.ReactNode; label: string }[] = [
    { id: 'inpaint',   icon: <Paintbrush size={20} strokeWidth={1.5} />,   label: 'AI Tools'   },
    { id: 'adjust',    icon: <SlidersHorizontal size={20} strokeWidth={1.5} />, label: 'Light'     },
    { id: 'detail',    icon: <Sparkles size={20} strokeWidth={1.5} />,      label: 'Detail'    },
    { id: 'portrait',  icon: <User size={20} strokeWidth={1.5} />,          label: 'Portrait'  },
    { id: 'selective', icon: <Layers size={20} strokeWidth={1.5} />,        label: 'Regions'   },
    { id: 'effects',   icon: <Wand2 size={20} strokeWidth={1.5} />,         label: 'Effects'   },
    { id: 'transform', icon: <Maximize2 size={20} strokeWidth={1.5} />,     label: 'Crop'      },
  ];

  return (
    <div className="flex h-full shrink-0 overflow-hidden relative z-30">
      {/* Narrow vertical tab column on the left */}
      <div className="w-[84px] shrink-0 bg-[#050505] border-r border-white/5 flex flex-col items-center py-6 space-y-4">
        {tabs.map(tab => {
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(isActive ? null : tab.id)}
              className={`group w-[56px] h-[56px] flex flex-col items-center justify-center transition-all duration-300 rounded-2xl relative ${
                isActive
                  ? 'sidebar-item-active text-primary'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              title={tab.label}
            >
              {/* Active left indicator line - pill style */}
              {isActive && (
                <div className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary),0.5)]" />
              )}
              
              {/* Pink notification dot for AI Tools */}
              {tab.id === 'inpaint' && (
                <div className="absolute right-3 top-3 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_6px_rgba(236,72,153,0.6)]" />
              )}
              
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              
              <span className={`text-[8px] font-bold uppercase tracking-[0.1em] mt-1 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Panel Content on the right with glass effect */}
      {activeTool && (
        <div className="w-[280px] shrink-0 glass-panel flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
          <div className="px-5 py-6 shrink-0 flex items-center justify-between border-b border-white/5">
            <h2 className="text-sm font-bold tracking-tight text-white/90">
              {tabs.find(t => t.id === activeTool)?.label}
            </h2>
            <button 
              onClick={() => setActiveTool(null)}
              className="p-1 hover:bg-white/5 rounded-full text-white/20 hover:text-white/40 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
