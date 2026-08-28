/**
 * Sidebar.tsx
 * Tool selection panel with KokonutUI Smooth Tab animated sliding indicator,
 * strict horizontal scroll prevention, and detached floating hover tooltips.
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Aperture,
  Maximize,
  SlidersHorizontal,
  Sparkles,
  User,
  Layers,
  Palette,
  BookMarked,
  Film,
  Grid,
  Pipette,
  PenTool,
  Clapperboard,
  Eraser,
  Camera,
  Smile,
  MousePointer,
  Scissors,
  Wand2,
} from 'lucide-react';
import { usePluginStore } from '@/store/pluginStore';

export type ToolId =
  | 'transform'
  | 'adjust'
  | 'detail'
  | 'portrait'
  | 'background'
  | 'inpaint'
  | 'depth'
  | 'enhance'
  | 'healing'
  | 'hsl'
  | 'presets'
  | 'texture'
  | 'lut'
  | 'frame'
  | 'palette'
  | 'annotations'
  | 'layers'
  | 'raw'
  | 'liquify'
  | 'colormatch'
  | 'lasso';

/**
 * Map of plugin-gated tool tabs to the plugin IDs that enable them.
 * A tool tab is displayed if its plugin ID (or unified studio pack ID) is installed and active.
 */
export const TOOL_PLUGIN_REQUIREMENTS: Partial<Record<ToolId, string[]>> = {
  background: ['background-removal', 'ai-vision-studio'],
  inpaint: ['ai-vision-studio'],
  depth: ['ai-vision-studio'],
  enhance: ['ai-vision-studio'],
  lut: ['creative-color-studio'],
  texture: ['creative-color-studio'],
  frame: ['creative-color-studio'],
  portrait: ['retouch-metadata-studio'],
  colormatch: ['retouch-metadata-studio'],
  annotations: ['retouch-metadata-studio'],
};

interface SidebarProps {
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  children: React.ReactNode;
}

const DEFAULT_TABS_ORDER: ToolId[] = [
  'background',
  'inpaint',
  'depth',
  'enhance',
  'healing',
  'lasso',
  'layers',
  'raw',
  'liquify',
  'colormatch',
  'presets',
  'adjust',
  'hsl',
  'detail',
  'portrait',
  'texture',
  'lut',
  'frame',
  'palette',
  'annotations',
  'transform',
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, setActiveTool, children }) => {
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const activePluginIds = usePluginStore((s) => s.activePluginIds);
  const fetchPlugins = usePluginStore((s) => s.fetchPlugins);

  React.useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const visibleTabs = DEFAULT_TABS_ORDER.filter(id => {
    const reqs = TOOL_PLUGIN_REQUIREMENTS[id];
    if (!reqs) return true; // Core tool, always visible
    return reqs.some(pluginId => activePluginIds.has(pluginId));
  });

  const [hoveredTool, setHoveredTool] = useState<{
    id: ToolId;
    top?: number;
    bottom?: number;
    align: 'center' | 'bottom';
  } | null>(null);

  const tabDefinitions: Record<ToolId, { icon: React.ReactNode; label: string; description: string }> = {
    background: { icon: <Scissors size={20} strokeWidth={1.5} />, label: 'Cutout & BG', description: 'AI background removal, custom solid/blur/image backdrops & edge refinement' },
    inpaint: { icon: <Wand2 size={20} strokeWidth={1.5} />, label: 'Magic Eraser', description: 'AI distraction eraser, smart brush object removal & generative fill' },
    depth: { icon: <Aperture size={20} strokeWidth={1.5} />, label: 'Depth Effects', description: 'Monocular depth maps, bokeh background blur & focus falloff' },
    enhance: { icon: <Maximize size={20} strokeWidth={1.5} />, label: 'AI Enhance', description: 'Real-ESRGAN super-resolution 2x/4x & GFPGAN face restoration' },
    healing: { icon: <Eraser size={20} strokeWidth={1.5} />, label: 'Clone & Heal', description: 'Clone Stamp and Healing Brush — Alt+click to set source, then paint' },
    lasso: { icon: <MousePointer size={20} strokeWidth={1.5} />, label: 'Lasso Studio', description: 'Freehand, Polygonal, and Magnetic Edge-Snapping Lasso Selection' },
    layers: { icon: <Layers size={20} strokeWidth={1.5} />, label: 'Layer Stack', description: 'Non-destructive Layer Stack, Fill Layers, and 27 Blend Modes' },
    raw: { icon: <Camera size={20} strokeWidth={1.5} />, label: 'Camera RAW', description: 'Sensor Demosaicing (AMaZE/AHD), Kelvin 2000K-50000K WB & Highlight Recovery' },
    liquify: { icon: <Smile size={20} strokeWidth={1.5} />, label: 'Liquify & Reshape', description: 'Interactive Mesh Displacement, Forward Warp, Pucker, Bloat & Face Reshape' },
    colormatch: { icon: <Pipette size={20} strokeWidth={1.5} />, label: 'Shot Matcher', description: '3D Color Histogram Matching to sample reference photos and cinema stills' },
    presets: { icon: <BookMarked size={20} strokeWidth={1.5} />, label: 'Presets', description: 'Apply curated cinematic, vintage, and creative look presets' },
    adjust: { icon: <SlidersHorizontal size={20} strokeWidth={1.5} />, label: 'Light', description: 'Adjust exposure, brightness, contrast, highlights, and shadows' },
    hsl: { icon: <Palette size={20} strokeWidth={1.5} />, label: 'Color', description: 'Finely tune hue, saturation, and luminance of specific color bands' },
    detail: { icon: <Sparkles size={20} strokeWidth={1.5} />, label: 'Detail', description: 'Enhance details with sharpness, clarity, and noise reduction' },
    portrait: { icon: <User size={20} strokeWidth={1.5} />, label: 'Portrait', description: 'Enhance skin texture, brightness, and apply face-centric retouches' },
    texture: { icon: <Film size={20} strokeWidth={1.5} />, label: 'Grain & Leak', description: 'Add vintage analog film grain, vignettes, and light leaks' },
    lut: { icon: <Clapperboard size={20} strokeWidth={1.5} />, label: 'LUT Grade', description: 'Apply cinematic 3D color grading LUTs or import your own .cube file' },
    frame: { icon: <Grid size={20} strokeWidth={1.5} />, label: 'Frames & Atmosphere', description: 'Apply polaroid borders, matte borders, and filmstrip frame overlays' },
    palette: { icon: <Pipette size={20} strokeWidth={1.5} />, label: 'Palette', description: 'Extract, analyze, and visualize the color palette of your photo' },
    annotations: { icon: <PenTool size={20} strokeWidth={1.5} />, label: 'Markup & Vector', description: 'Draw shapes, arrows, custom vector outlines, and text layers' },
    transform: { icon: <Maximize2 size={20} strokeWidth={1.5} />, label: 'Crop', description: 'Crop, straighten, rotate, or flip the canvas boundaries' },
  };

  const shortcutHints: Partial<Record<ToolId, string>> = {
    transform: 'Ctrl+Z/Y undo/redo',
    annotations: 'Ctrl+Z/Y undo/redo, [ ] brush size',
    inpaint: '[ ] brush size',
    healing: 'Alt+Click = source, [ ] brush size',
    texture: '\\ hold to compare',
    lut: 'Import/export .cube files',
  };

  const handleMouseEnterButton = (id: ToolId, el: HTMLButtonElement) => {
    const rect = el.getBoundingClientRect();
    const sidebarRect = sidebarContainerRef.current?.getBoundingClientRect();
    if (!sidebarRect) {
      setHoveredTool({ id, top: rect.top + rect.height / 2, align: 'center' });
      return;
    }
    const buttonCenterY = rect.top - sidebarRect.top + rect.height / 2;
    const distFromBottom = sidebarRect.height - buttonCenterY;

    // If button is in the lower region of the sidebar (bottom 150px), anchor to bottom with 28px clearance
    if (distFromBottom < 150) {
      setHoveredTool({
        id,
        bottom: 28,
        align: 'bottom',
      });
    } else {
      const safeTop = Math.max(64, buttonCenterY);
      setHoveredTool({
        id,
        top: safeTop,
        align: 'center',
      });
    }
  };

  return (
    <div
      ref={sidebarContainerRef}
      className="flex h-full shrink-0 relative z-30 bg-[#0d0f14]"
    >
      {/* Narrow vertical tab column on the left - strictly locked to vertical scroll only */}
      <div
        role="tablist"
        aria-label="Image editor tools"
        onScroll={() => setHoveredTool(null)}
        className="w-[56px] shrink-0 bg-[#0b0d12] border-r border-white/5 flex flex-col items-center py-4 space-y-3 h-full overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 select-none relative"
      >
        {visibleTabs.map(id => {
          const tab = tabDefinitions[id];
          const isActive = activeTool === id;

          return (
            <motion.button
              key={id}
              role="tab"
              aria-selected={isActive}
              aria-controls={isActive ? `tool-panel-${id}` : undefined}
              onClick={() => setActiveTool(id)}
              onMouseEnter={e => handleMouseEnterButton(id, e.currentTarget)}
              onMouseLeave={() => setHoveredTool(null)}
              whileTap={{ scale: 0.93 }}
              className={`group w-[38px] h-[38px] shrink-0 flex flex-col items-center justify-center rounded-xl relative select-none cursor-pointer focus:outline-none transition-colors duration-150 ${
                isActive
                  ? 'text-black font-semibold'
                  : 'bg-[#14171f]/50 text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {/* KokonutUI Smooth Sliding Spring Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="smoothActiveToolTab"
                  className="absolute inset-0 rounded-xl bg-[#FCBC00] shadow-[0_0_14px_rgba(252,188,0,0.45)] z-0"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 32,
                  }}
                />
              )}

              {/* Violet notification dot for AI Tools */}
              {id === 'inpaint' && !isActive && (
                <div className="absolute right-1 top-1 w-1.5 h-1.5 bg-semantic-ai rounded-full shadow-[0_0_6px_rgba(139,92,246,0.5)] z-10" />
              )}

              {/* Tool Icon */}
              <div
                className={`relative z-10 transition-transform duration-150 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              >
                {tab.icon}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Detached Floating Hover Tooltip outside the scroll container */}
      <AnimatePresence>
        {hoveredTool && (
          <motion.div
            key={hoveredTool.id}
            initial={{ opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={
              hoveredTool.align === 'bottom'
                ? { bottom: hoveredTool.bottom }
                : { top: hoveredTool.top }
            }
            className={`absolute left-[62px] ${
              hoveredTool.align === 'bottom' ? '' : '-translate-y-1/2'
            } bg-[#14171d]/95 text-white p-3 rounded-xl pointer-events-none shadow-2xl z-[60] border border-white/10 w-52 flex flex-col gap-0.5 text-left backdrop-blur-xl`}
          >
            <span className="text-[11px] font-bold text-white tracking-wide">
              {tabDefinitions[hoveredTool.id]?.label}
            </span>
            <span className="text-[9px] text-white/50 font-normal leading-normal whitespace-normal">
              {tabDefinitions[hoveredTool.id]?.description}
            </span>
            {shortcutHints[hoveredTool.id] && (
              <span className="text-[8px] text-[#FCBC00] font-mono mt-1 font-semibold">
                {shortcutHints[hoveredTool.id]}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Panel Content on the right with KokonutUI smooth transitions */}
      {activeTool && (
        <div className="w-[290px] shrink-0 bg-[#0d0f14] border-r border-white/5 flex flex-col overflow-hidden h-full">
          {/* Header */}
          <div className="px-5 py-3.5 shrink-0 flex items-center border-b border-white/5 bg-[#0d0f14]">
            <h2 className="text-xs font-bold tracking-wider uppercase text-white/80">
              {tabDefinitions[activeTool]?.label}
            </h2>
          </div>

          {/* Animated Panel Body */}
          <div className="flex-1 min-h-0 relative flex flex-col bg-[#0d0f14] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTool}
                id={`tool-panel-${activeTool}`}
                initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                transition={{
                  duration: 0.2,
                  ease: [0.32, 0.72, 0, 1],
                }}
                className="flex-1 w-full h-full flex flex-col bg-[#0d0f14] min-h-0 overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
