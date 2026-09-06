import React from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { Layer } from '../layersEngine';
import { LayerItem } from './LayerItem';

interface LayerHierarchySectionProps {
  layers: Layer[];
  activeLayerId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectLayer: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
}

export const LayerHierarchySection: React.FC<LayerHierarchySectionProps> = ({
  layers,
  activeLayerId,
  isOpen,
  onToggle,
  onSelectLayer,
  onToggleVisible,
  onMoveLayer,
  onDeleteLayer,
}) => {
  return (
    <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
          <Layers size={11} className="text-primary" />
          <span>Layer Hierarchy</span>
        </div>
        <ChevronDown
          size={12}
          className={`text-white/30 transition-transform duration-150 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </div>

      {isOpen && (
        <div className="space-y-1.5 pt-1">
          {layers.map((l, idx) => {
            const isActive = l.id === (activeLayerId || layers[0]?.id);
            return (
              <LayerItem
                key={l.id}
                layer={l}
                index={idx}
                totalLayers={layers.length}
                isActive={isActive}
                onSelect={() => onSelectLayer(l.id)}
                onToggleVisible={() => onToggleVisible(l.id)}
                onMoveUp={() => onMoveLayer(l.id, 'up')}
                onMoveDown={() => onMoveLayer(l.id, 'down')}
                onDelete={() => onDeleteLayer(l.id)}
                canDelete={layers.length > 1 && l.type !== 'pixel'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

