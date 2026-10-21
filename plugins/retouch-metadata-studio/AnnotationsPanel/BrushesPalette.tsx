/**
 * BrushesPalette.tsx
 * Renders MS Paint-inspired Brushes selector menu and metadata for:
 * Paint Brush, Spray Paint, Calligraphy 1 & 2, Oil Brush, Crayon, Watercolor, and Fine Pen.
 */

import React from 'react';
import {
  Paintbrush,
  SprayCan,
  Feather,
  PenTool,
  Palette,
  Pencil,
  Droplets,
  Edit3,
  Sparkles,
  Wind,
  X,
  LucideIcon,
} from 'lucide-react';
import { BrushType } from './types';

export interface BrushItem {
  id: BrushType;
  name: string;
  shortName: string;
  category: 'paint' | 'calligraphy' | 'media';
  description: string;
  icon: LucideIcon;
  defaultSize: number;
}

export const ALL_BRUSHES: BrushItem[] = [
  {
    id: 'brush',
    name: 'Paint Brush',
    shortName: 'Brush',
    category: 'paint',
    description: 'Classic smooth round brush',
    icon: Paintbrush,
    defaultSize: 8,
  },
  {
    id: 'spray',
    name: 'Spray Paint',
    shortName: 'Spray',
    category: 'paint',
    description: 'Airbrush droplet mist',
    icon: SprayCan,
    defaultSize: 24,
  },
  {
    id: 'calligraphy1',
    name: 'Calligraphy 1',
    shortName: 'Callig 1',
    category: 'calligraphy',
    description: '45° chisel nib ribbon',
    icon: Feather,
    defaultSize: 10,
  },
  {
    id: 'calligraphy2',
    name: 'Calligraphy 2',
    shortName: 'Callig 2',
    category: 'calligraphy',
    description: '-45° chisel nib ribbon',
    icon: PenTool,
    defaultSize: 10,
  },
  {
    id: 'chalk',
    name: 'Chalk',
    shortName: 'Chalk',
    category: 'media',
    description: 'Porous paper chalk grain',
    icon: Sparkles,
    defaultSize: 10,
  },
  {
    id: 'crayon',
    name: 'Crayon',
    shortName: 'Crayon',
    category: 'media',
    description: 'Textured wax crayon laydown',
    icon: Pencil,
    defaultSize: 8,
  },
  {
    id: 'oil',
    name: 'Oil Brush',
    shortName: 'Oil',
    category: 'media',
    description: 'Textured impasto bristle',
    icon: Palette,
    defaultSize: 12,
  },
  {
    id: 'drybrush',
    name: 'Dry Brush',
    shortName: 'Drybrush',
    category: 'media',
    description: 'Directional bristle drag',
    icon: Wind,
    defaultSize: 10,
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    shortName: 'Water',
    category: 'media',
    description: 'Soft bleeding wash',
    icon: Droplets,
    defaultSize: 16,
  },
  {
    id: 'pen',
    name: 'Fine Pen',
    shortName: 'Pen',
    category: 'paint',
    description: 'Crisp vector ink line',
    icon: Edit3,
    defaultSize: 3,
  },
];

interface BrushesPaletteProps {
  activeBrush: BrushType;
  onSelectBrush: (brush: BrushItem) => void;
  onClose?: () => void;
  className?: string;
}

export const BrushesPalette: React.FC<BrushesPaletteProps> = ({
  activeBrush,
  onSelectBrush,
  onClose,
  className,
}) => {
  return (
    <div
      className={
        className ||
        'absolute left-0 right-0 top-full mt-2 z-50 p-3 bg-[#16181f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150 select-none'
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <Paintbrush size={13} className="text-white" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white">
            MS Paint Brushes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8.5px] text-zinc-400 font-medium">{ALL_BRUSHES.length} Brush Types</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Close Palette"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5 custom-scrollbar">
        {ALL_BRUSHES.map((b) => {
          const Icon = b.icon;
          const isSelected = activeBrush === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelectBrush(b);
                onClose?.();
              }}
              title={`${b.name} — ${b.description}`}
              className={`flex items-center gap-2 p-1.5 px-2 rounded-xl text-left transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-white/15 border-white/40 text-white shadow-sm ring-1 ring-white/20'
                  : 'bg-white/[0.03] border-white/5 text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/15'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'bg-white/5 text-zinc-400'
                }`}
              >
                <Icon size={14} className={isSelected ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div
                  className={`text-[10px] font-bold leading-tight ${
                    isSelected ? 'text-white' : 'text-zinc-200'
                  }`}
                >
                  {b.name}
                </div>
                <div className="text-[7.5px] text-zinc-400 truncate leading-tight mt-0.5">
                  {b.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-white/40 font-medium">
        <span>Click to select brush</span>
        <span>MS Paint Engine</span>
      </div>
    </div>
  );
};
