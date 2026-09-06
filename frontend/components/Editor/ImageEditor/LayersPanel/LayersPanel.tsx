/**
 * LayersPanel.tsx
 * Sidebar control panel for Non-destructive Layer Stack, Fill Layers, and 27 Blend Modes.
 * Styled to match the unified Image Editor Studio design system.
 */

import React, { useState } from 'react';
import { Layer, LayerType, createDefaultBaseLayer } from '../layersEngine';
import { Plus } from 'lucide-react';
import { LayersPanelProps } from './types';
import { LayerControls } from './LayerControls';
import { LayerHierarchySection } from './LayerHierarchySection';

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers: layersProp = [],
  onChange,
  activeLayerId,
  setActiveLayerId,
}) => {
  // The implicit base layer always exists even before the stack is persisted.
  const layers = layersProp.length > 0 ? layersProp : [createDefaultBaseLayer()];

  const [openSections, setOpenSections] = useState({
    controls: true,
    stack: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  const handleAddLayer = (type: LayerType) => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: type === 'adjustment' ? 'Adjustment Layer' : type === 'fill' ? 'Fill Layer' : 'New Layer',
      type,
      visible: true,
      opacity: 100,
      blendMode: 'source-over',
      fillColor: type === 'fill' ? '#ef4444' : undefined,
    };
    onChange([newLayer, ...layers]);
    setActiveLayerId(newId);
  };

  const handleToggleVisible = (id: string) => {
    onChange(layers.map(l => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const filtered = layers.filter(l => l.id !== id);
    onChange(filtered);
    if (activeLayerId === id) setActiveLayerId(filtered[0]?.id || null);
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;

    const copy = [...layers];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onChange(copy);
  };

  const updateActiveLayer = (patch: Partial<Layer>) => {
    if (!activeLayer) return;
    onChange(layers.map(l => (l.id === activeLayer.id ? { ...l, ...patch } : l)));
  };

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white p-4 space-y-4 select-none">
      {/* ── Sub-header ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Non-Destructive Stack
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAddLayer('adjustment')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Add Adjustment Layer"
          >
            <Plus size={10} />
            Adjustment
          </button>
          <button
            onClick={() => handleAddLayer('fill')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
            title="Add Fill Layer"
          >
            <Plus size={10} />
            Fill
          </button>
        </div>
      </div>

      {/* ── 1. Active Layer Settings Card ── */}
      {activeLayer && (
        <LayerControls
          activeLayer={activeLayer}
          isOpen={openSections.controls}
          onToggle={() => toggleSection('controls')}
          onUpdateLayer={updateActiveLayer}
        />
      )}

      {/* ── 2. Layer Hierarchy List Card ── */}
      <LayerHierarchySection
        layers={layers}
        activeLayerId={activeLayerId}
        isOpen={openSections.stack}
        onToggle={() => toggleSection('stack')}
        onSelectLayer={setActiveLayerId}
        onToggleVisible={handleToggleVisible}
        onMoveLayer={handleMoveLayer}
        onDeleteLayer={handleDeleteLayer}
      />
    </div>
  );
};

