import React from 'react';
import { 
  Maximize2, 
  SlidersHorizontal, 
  Sparkles, 
  Wand2, 
  User, 
  Layers, 
  Paintbrush, 
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
  const tabDefinitions: Record<ToolId, { icon: React.ReactNode; label: string; description: string }> = {
    inpaint:      { icon: <Paintbrush size={20} strokeWidth={1.5} />,   label: 'AI Tools',             description: 'AI-powered object removal and mask-based image inpainting' },
    presets:      { icon: <BookMarked size={20} strokeWidth={1.5} />,   label: 'Presets',              description: 'Apply curated cinematic, vintage, and creative look presets' },
    adjust:       { icon: <SlidersHorizontal size={20} strokeWidth={1.5} />, label: 'Light',                description: 'Adjust exposure, brightness, contrast, highlights, and shadows' },
    hsl:          { icon: <Palette size={20} strokeWidth={1.5} />,       label: 'Color',                description: 'Finely tune hue, saturation, and luminance of specific color bands' },
    splitToning:  { icon: <SunMoon size={20} strokeWidth={1.5} />,       label: 'Split Tone',           description: 'Apply customized color tints separately to highlights and shadows' },
    detail:       { icon: <Sparkles size={20} strokeWidth={1.5} />,      label: 'Detail',               description: 'Enhance details with sharpness, clarity, and noise reduction' },
    portrait:     { icon: <User size={20} strokeWidth={1.5} />,          label: 'Portrait',             description: 'Enhance skin texture, brightness, and apply face-centric retouches' },
    selective:    { icon: <Layers size={20} strokeWidth={1.5} />,        label: 'Regions',              description: 'Create local adjustment layers using custom drawn masks' },
    texture:      { icon: <Film size={20} strokeWidth={1.5} />,          label: 'Grain & Leak',         description: 'Add vintage analog film grain, vignettes, and light leaks' },
    frame:        { icon: <Grid size={20} strokeWidth={1.5} />,          label: 'Frames & Atmosphere',  description: 'Apply polaroid borders, matte borders, and filmstrip frame overlays' },
    blend:        { icon: <ImagePlus size={20} strokeWidth={1.5} />,     label: 'Blend',                description: 'Double-expose your image by blending external overlay textures' },
    tiltShift:    { icon: <Aperture size={20} strokeWidth={1.5} />,      label: 'Tilt-Shift',           description: 'Apply depth blur to simulate miniature models or lens blur' },
    palette:      { icon: <Pipette size={20} strokeWidth={1.5} />,       label: 'Palette',              description: 'Extract, analyze, and visualize the color palette of your photo' },
    annotations:  { icon: <PenTool size={20} strokeWidth={1.5} />,       label: 'Markup & Vector',      description: 'Draw shapes, arrows, custom vector outlines, and text layers' },
    effects:      { icon: <Wand2 size={20} strokeWidth={1.5} />,         label: 'Effects',              description: 'Apply creative color lookup tables, blur effects, and filters' },
    transform:    { icon: <Maximize2 size={20} strokeWidth={1.5} />,     label: 'Crop',                 description: 'Crop, straighten, rotate, or flip the canvas boundaries' },
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
    <div className="flex h-full shrink-0 overflow-hidden relative z-30 bg-[var(--bg-primary)]">
      {/* Narrow vertical tab column on the left - scrollable for fit */}
      <div className="w-[56px] shrink-0 bg-[var(--bg-secondary)] border-r border-white/5 flex flex-col items-center py-6 space-y-4 overflow-y-auto custom-scrollbar h-full">
        
        {/* Customize order toggle */}
        <button
          onClick={() => {
            setIsCustomizing(!isCustomizing);
            if (activeTool) setActiveTool(null);
          }}
          className={`group w-[40px] h-[40px] shrink-0 flex flex-col items-center justify-center transition-all duration-200 rounded-xl border relative ${
            isCustomizing
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'text-white/20 hover:text-white/50 bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
          }`}
        >
          <SlidersHorizontal size={14} className={isCustomizing ? "animate-pulse" : ""} />
          <div className="absolute left-[64px] bg-[#1e232b] text-white p-3 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-2xl z-50 border border-white/10 w-52 flex flex-col gap-0.5 text-left">
            <span className="text-[11px] font-bold text-white tracking-wide">
              {isCustomizing ? "Save Layout" : "Rearrange Sidebar"}
            </span>
            <span className="text-[9px] text-white/50 font-normal leading-normal whitespace-normal">
              {isCustomizing ? "Commit and save the new sidebar tools order" : "Click drag to change the vertical layout of your editor sidebar"}
            </span>
          </div>
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
                setActiveTool(id);
              }}
              className={`group w-[40px] h-[40px] shrink-0 flex flex-col items-center justify-center transition-all duration-300 rounded-xl relative ${
                isCustomizing
                  ? 'border border-dashed border-amber-500/30 bg-amber-500/5 cursor-grab active:cursor-grabbing text-amber-500/60 hover:text-amber-500'
                  : isActive
                  ? 'sidebar-item-active text-primary'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              style={{
                opacity: draggedToolId === id ? 0.3 : 1,
              }}
            >
              {/* Active left indicator line - pill style */}
              {!isCustomizing && isActive && (
                <div className="absolute -left-[8px] top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary),0.5)]" />
              )}
              
              {/* Pink notification dot for AI Tools */}
              {!isCustomizing && id === 'inpaint' && (
                <div className="absolute right-1 top-1 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_6px_rgba(236,72,153,0.6)]" />
              )}
              
              <div className={`transition-transform duration-300 ${isActive || isCustomizing ? 'scale-110' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              
              {/* Hover Tooltip */}
              <div className="absolute left-[64px] bg-[#1e232b] text-white p-3 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-2xl z-50 border border-white/10 w-52 flex flex-col gap-0.5 text-left">
                <span className="text-[11px] font-bold text-white tracking-wide">
                  {tab.label}
                </span>
                <span className="text-[9px] text-white/50 font-normal leading-normal whitespace-normal">
                  {tab.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Panel Content on the right with dark secondary background */}
      {activeTool && (
        <div className="w-[260px] shrink-0 bg-[var(--bg-secondary)] border-r border-white/5 flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
          <div className="px-5 py-4 shrink-0 flex items-center border-b border-white/5 bg-[var(--bg-secondary)]">
            <h2 className="text-xs font-bold tracking-wider uppercase text-white/80">
              {tabDefinitions[activeTool]?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-secondary)]">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
