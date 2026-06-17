import React from 'react';
import { 
  Maximize2, 
  SlidersHorizontal, 
  Sparkles, 
  Wand2, 
  User, 
  Layers, 
  Paintbrush, 
  X, 
  Palette, 
  BookMarked,
  SunMoon,
  Film,
  Grid,
  ImagePlus,
  Aperture,
  Pipette,
  PenTool
} from 'lucide-react';

export type ToolId = 
  | 'transform' 
  | 'adjust' 
  | 'detail' 
  | 'portrait' 
  | 'selective' 
  | 'effects' 
  | 'inpaint' 
  | 'hsl' 
  | 'presets'
  | 'splitToning'
  | 'texture'
  | 'frame'
  | 'blend'
  | 'tiltShift'
  | 'palette'
  | 'annotations';

interface SidebarProps {
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  children: React.ReactNode;
}

const DEFAULT_TABS_ORDER: ToolId[] = [
  'inpaint',
  'presets',
  'adjust',
  'hsl',
  'splitToning',
  'detail',
  'portrait',
  'selective',
  'texture',
  'frame',
  'blend',
  'tiltShift',
  'palette',
  'annotations',
  'effects',
  'transform',
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const tabDefinitions: Record<ToolId, { icon: React.ReactNode; label: string }> = {
    inpaint:      { icon: <Paintbrush size={20} strokeWidth={1.5} />,   label: 'AI Tools'      },
    presets:      { icon: <BookMarked size={20} strokeWidth={1.5} />,   label: 'Presets'       },
    adjust:       { icon: <SlidersHorizontal size={20} strokeWidth={1.5} />, label: 'Light'      },
    hsl:          { icon: <Palette size={20} strokeWidth={1.5} />,       label: 'Color'         },
    splitToning:  { icon: <SunMoon size={20} strokeWidth={1.5} />,       label: 'Split Tone'    },
    detail:       { icon: <Sparkles size={20} strokeWidth={1.5} />,      label: 'Detail'        },
    portrait:     { icon: <User size={20} strokeWidth={1.5} />,          label: 'Portrait'      },
    selective:    { icon: <Layers size={20} strokeWidth={1.5} />,        label: 'Regions'       },
    texture:      { icon: <Film size={20} strokeWidth={1.5} />,          label: 'Grain/Leak'    },
    frame:        { icon: <Grid size={20} strokeWidth={1.5} />,          label: 'Frames'        },
    blend:        { icon: <ImagePlus size={20} strokeWidth={1.5} />,     label: 'Blend'         },
    tiltShift:    { icon: <Aperture size={20} strokeWidth={1.5} />,      label: 'Tilt-Shift'    },
    palette:      { icon: <Pipette size={20} strokeWidth={1.5} />,       label: 'Palette'       },
    annotations:  { icon: <PenTool size={20} strokeWidth={1.5} />,       label: 'Markup'        },
    effects:      { icon: <Wand2 size={20} strokeWidth={1.5} />,         label: 'Effects'       },
    transform:    { icon: <Maximize2 size={20} strokeWidth={1.5} />,     label: 'Crop'          },
  };

  const [tabsOrder, setTabsOrder] = React.useState<ToolId[]>(() => {
    try {
      const saved = localStorage.getItem('prism_sidebar_tabs_order');
      if (saved) {
        const parsed = JSON.parse(saved) as ToolId[];
        const validParsed = parsed.filter(id => id in tabDefinitions);
        if (validParsed.length === DEFAULT_TABS_ORDER.length) {
          return validParsed;
        }
      }
    } catch (e) {
      console.error('Failed to load tabs order:', e);
    }
    return DEFAULT_TABS_ORDER;
  });

  const [isCustomizing, setIsCustomizing] = React.useState(false);
  const [draggedToolId, setDraggedToolId] = React.useState<ToolId | null>(null);

  return (
    <div className="flex h-full shrink-0 overflow-hidden relative z-30">
      {/* Narrow vertical tab column on the left - scrollable for fit */}
      <div className="w-[84px] shrink-0 bg-[#050505] border-r border-white/5 flex flex-col items-center py-6 space-y-4 overflow-y-auto custom-scrollbar h-full">
        
        {/* Customize order toggle */}
        <button
          onClick={() => {
            setIsCustomizing(!isCustomizing);
            if (activeTool) setActiveTool(null);
          }}
          className={`group w-[56px] h-[36px] shrink-0 flex flex-col items-center justify-center transition-all duration-200 rounded-xl border ${
            isCustomizing
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'text-white/20 hover:text-white/50 bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
          }`}
          title={isCustomizing ? "Save Layout" : "Rearrange Sidebar"}
        >
          <SlidersHorizontal size={14} className={isCustomizing ? "animate-pulse" : ""} />
          <span className="text-[7.5px] font-bold uppercase tracking-[0.05em] mt-1">
            {isCustomizing ? "Done" : "Sort"}
          </span>
        </button>

        {tabsOrder.map(id => {
          const tab = tabDefinitions[id];
          const isActive = activeTool === id;

          const handleDragStart = (e: React.DragEvent) => {
            if (!isCustomizing) return;
            setDraggedToolId(id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
          };

          const handleDragOver = (e: React.DragEvent) => {
            if (!isCustomizing || draggedToolId === null || draggedToolId === id) return;
            e.preventDefault();
          };

          const handleDrop = (e: React.DragEvent) => {
            if (!isCustomizing || draggedToolId === null || draggedToolId === id) return;
            e.preventDefault();
            
            const newOrder = [...tabsOrder];
            const dragIdx = newOrder.indexOf(draggedToolId);
            const dropIdx = newOrder.indexOf(id);
            
            if (dragIdx > -1 && dropIdx > -1) {
              newOrder.splice(dragIdx, 1);
              newOrder.splice(dropIdx, 0, draggedToolId);
              setTabsOrder(newOrder);
              localStorage.setItem('prism_sidebar_tabs_order', JSON.stringify(newOrder));
            }
          };

          const handleDragEnd = () => {
            setDraggedToolId(null);
          };

          return (
            <button
              key={id}
              draggable={isCustomizing}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (isCustomizing) return;
                setActiveTool(isActive ? null : id);
              }}
              className={`group w-[56px] h-[56px] shrink-0 flex flex-col items-center justify-center transition-all duration-300 rounded-2xl relative ${
                isCustomizing
                  ? 'border border-dashed border-amber-500/30 bg-amber-500/5 cursor-grab active:cursor-grabbing text-amber-500/60 hover:text-amber-500'
                  : isActive
                  ? 'sidebar-item-active text-primary'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              style={{
                opacity: draggedToolId === id ? 0.3 : 1,
              }}
              title={isCustomizing ? `Drag to reposition ${tab.label}` : tab.label}
            >
              {/* Active left indicator line - pill style */}
              {!isCustomizing && isActive && (
                <div className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary),0.5)]" />
              )}
              
              {/* Pink notification dot for AI Tools */}
              {!isCustomizing && id === 'inpaint' && (
                <div className="absolute right-3 top-3 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_6px_rgba(236,72,153,0.6)]" />
              )}
              
              <div className={`transition-transform duration-300 ${isActive || isCustomizing ? 'scale-110' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              
              <span className="text-[8px] font-bold uppercase tracking-[0.05em] mt-1 text-center w-full px-0.5 truncate">
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
              {tabDefinitions[activeTool]?.label}
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
