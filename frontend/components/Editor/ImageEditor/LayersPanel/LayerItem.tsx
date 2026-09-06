import React from 'react';
import { Eye, EyeOff, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Layer } from '../layersEngine';

interface LayerItemProps {
  layer: Layer;
  index: number;
  totalLayers: number;
  isActive: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  index,
  totalLayers,
  isActive,
  onSelect,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDelete,
  canDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-white text-black font-semibold border-white shadow-sm'
          : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={e => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className={`${
            isActive ? 'text-black/60 hover:text-black' : 'text-white/40 hover:text-white'
          } transition-colors`}
          title={layer.visible ? 'Hide Layer' : 'Show Layer'}
        >
          {layer.visible ? (
            <Eye size={13} className={isActive ? 'text-black' : 'text-primary'} />
          ) : (
            <EyeOff size={13} />
          )}
        </button>
        <div className="flex flex-col min-w-0">
          <span
            className={`text-[11px] font-medium truncate ${
              isActive ? 'text-black font-bold' : 'text-white/90'
            }`}
          >
            {layer.name}
          </span>
          <span
            className={`text-[9px] uppercase tracking-wider ${
              isActive ? 'text-black/60 font-semibold' : 'text-white/40'
            }`}
          >
            {layer.type} layer
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={e => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={index === 0}
          className={`p-1 ${
            isActive ? 'text-black/50 hover:text-black' : 'text-white/30 hover:text-white'
          } disabled:opacity-20 cursor-pointer`}
          title="Move Up"
        >
          <ArrowUp size={11} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={index === totalLayers - 1}
          className={`p-1 ${
            isActive ? 'text-black/50 hover:text-black' : 'text-white/30 hover:text-white'
          } disabled:opacity-20 cursor-pointer`}
          title="Move Down"
        >
          <ArrowDown size={11} />
        </button>
        {canDelete && (
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-red-400/60 hover:text-red-400 cursor-pointer"
            title="Delete Layer"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

