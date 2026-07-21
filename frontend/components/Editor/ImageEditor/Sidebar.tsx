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
  Film,
  Grid,
  Pipette,
  PenTool
} from 'lucide-react';

export type ToolId =
  | 'transform'
  | 'adjust'
  | 'detail'
  | 'portrait'
  | 'selective'
  | 'inpaint'
  | 'hsl'
  | 'presets'
  | 'texture'
  | 'frame'
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
  'detail',
  'portrait',
  'selective',
  'texture',
  'frame',
  'palette',
  'annotations',
  'transform',
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const tabDefinitions: Record<ToolId, { icon: React.ReactNode; label: string; description: string }> = {
    inpaint:      { icon: <Paintbrush size={20} strokeWidth={1.5} />,   label: 'AI Tools',             description: 'AI-powered object removal and mask-based image inpainting' },
    presets:      { icon: <BookMarked size={20} strokeWidth={1.5} />,   label: 'Presets',              description: 'Apply curated cinematic, vintage, and creative look presets' },
    adjust:       { icon: <SlidersHorizontal size={20} strokeWidth={1.5} />, label: 'Light',                description: 'Adjust exposure, brightness, contrast, highlights, and shadows' },
    hsl:          { icon: <Palette size={20} strokeWidth={1.5} />,       label: 'Color',                description: 'Finely tune hue, saturation, and luminance of specific color bands' },
    detail:       { icon: <Sparkles size={20} strokeWidth={1.5} />,      label: 'Detail',               description: 'Enhance details with sharpness, clarity, and noise reduction' },
    portrait:     { icon: <User size={20} strokeWidth={1.5} />,          label: 'Portrait',             description: 'Enhance skin texture, brightness, and apply face-centric retouches' },
    selective:    { icon: <Layers size={20} strokeWidth={1.5} />,        label: 'Regions',              description: 'Create local adjustment layers using custom drawn masks' },
    texture:      { icon: <Film size={20} strokeWidth={1.5} />,          label: 'Grain & Leak',         description: 'Add vintage analog film grain, vignettes, and light leaks' },
    frame:        { icon: <Grid size={20} strokeWidth={1.5} />,          label: 'Frames & Atmosphere',  description: 'Apply polaroid borders, matte borders, and filmstrip frame overlays' },
    palette:      { icon: <Pipette size={20} strokeWidth={1.5} />,       label: 'Palette',              description: 'Extract, analyze, and visualize the color palette of your photo' },
    annotations:  { icon: <PenTool size={20} strokeWidth={1.5} />,       label: 'Markup & Vector',      description: 'Draw shapes, arrows, custom vector outlines, and text layers' },
    transform:    { icon: <Maximize2 size={20} strokeWidth={1.5} />,     label: 'Crop',                 description: 'Crop, straighten, rotate, or flip the canvas boundaries' },
  };

  const shortcutHints: Partial<Record<ToolId, string>> = {
    transform: 'Ctrl+Z/Y undo/redo',
    annotations: 'Ctrl+Z/Y undo/redo, [ ] brush size',
    inpaint: '[ ] brush size',
    texture: '\\ hold to compare',
  };

  return (
    <div className="flex h-full shrink-0 relative z-30 bg-[var(--bg-primary)]">
      {/* Narrow vertical tab column on the left - scrollable for fit */}
      <div className="w-[56px] shrink-0 bg-[var(--bg-secondary)] border-r border-white/5 flex flex-col items-center py-6 space-y-4 h-full">
        {DEFAULT_TABS_ORDER.map(id => {
          const tab = tabDefinitions[id];
          const isActive = activeTool === id;

          return (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              className={`group w-[38px] h-[38px] shrink-0 flex flex-col items-center justify-center transition-all duration-150 rounded border relative ${
                isActive
                  ? 'bg-white/10 border-white/10 text-white'
                  : 'bg-[#12141a]/40 border-transparent text-white/30 hover:text-white/60 hover:bg-white/5 hover:border-white/5'
              }`}
            >
              {/* Active left indicator line - sharp vertical bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-[2px]" />
              )}
              
              {/* Pink notification dot for AI Tools */}
              {id === 'inpaint' && (
                <div className="absolute right-1 top-1 w-1.5 h-1.5 bg-pink-500 rounded-full" />
              )}
              
              <div className={`transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-105'}`}>
                {tab.icon}
              </div>
              
              {/* Hover Tooltip */}
              <div className="absolute left-[56px] bg-[#14171d] text-white p-3 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-2xl z-50 border border-white/10 w-52 flex flex-col gap-0.5 text-left">
                <span className="text-[11px] font-bold text-white tracking-wide">
                  {tab.label}
                </span>
                <span className="text-[9px] text-white/50 font-normal leading-normal whitespace-normal">
                  {tab.description}
                </span>
                {shortcutHints[id] && (
                  <span className="text-[8px] text-primary/60 font-mono mt-1">
                    {shortcutHints[id]}
                  </span>
                )}
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
