/**
 * LeftSidebar — Icon-only vertical navigation for the video editor,
 * matching OpenCut's left sidebar pattern.
 */
import React from 'react';
import {
  FolderOpen,
  Type,
  Smile,
  Sparkles,
  Shuffle,
  Sliders,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';

export type EditorPanel = 'assets' | 'text' | 'elements' | 'effects' | 'transitions' | 'presets' | 'adjust' | 'settings';

interface LeftSidebarProps {
  activePanel: EditorPanel;
  onPanelChange: (panel: EditorPanel) => void;
}

const SIDEBAR_ITEMS: { panel: EditorPanel; icon: React.ReactNode; label: string }[] = [
  {
    panel: 'assets',
    label: 'Assets',
    icon: <FolderOpen size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'text',
    label: 'Text',
    icon: <Type size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'elements',
    label: 'Elements',
    icon: <Smile size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'effects',
    label: 'Effects',
    icon: <Sparkles size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'transitions',
    label: 'Transitions',
    icon: <Shuffle size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'presets',
    label: 'Presets',
    icon: <Sliders size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'adjust',
    label: 'Adjust',
    icon: <SlidersHorizontal size={18} strokeWidth={1.75} />,
  },
  {
    panel: 'settings',
    label: 'Settings',
    icon: <Settings size={18} strokeWidth={1.75} />,
  },
];

/**
 * LeftSidebar - Renders left sidebar.
 */
export const LeftSidebar: React.FC<LeftSidebarProps> = ({ activePanel, onPanelChange }) => {
  return (
    <div className="w-12 bg-[#151312] border-r border-white/10 flex flex-col items-center py-2.5 gap-1 shrink-0 select-none z-20">
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activePanel === item.panel;
        return (
          <button
            key={item.panel}
            onClick={() => onPanelChange(item.panel)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 relative cursor-pointer ${
              isActive
                ? 'bg-[#e5a93c]/15 text-[#e5a93c] border border-[#e5a93c]/30 shadow-[0_0_12px_rgba(229,169,60,0.25)]'
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title={item.label}
          >
            {isActive && (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#e5a93c] rounded-r shadow-[0_0_8px_rgba(229,169,60,0.6)]" />
            )}
            {item.icon}
          </button>
        );
      })}
    </div>
  );
};

export default LeftSidebar;
