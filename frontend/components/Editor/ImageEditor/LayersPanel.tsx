/**
 * LayersPanel.tsx
 * Sidebar control panel for Non-destructive Layer Stack, Fill Layers, and 27 Blend Modes.
 * Styled to match the unified Image Editor Studio design system.
 */

import React, { useState } from 'react';
import { Layer, LayerType, createDefaultBaseLayer } from './layersEngine';
import {
  Layers,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Sliders,
  PaintBucket,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { EditorSlider } from './ui/EditorSlider';
import { Dropdown } from '@/components/ui/Dropdown';

interface LayersPanelProps {
  layers: Layer[];
  onChange: (layers: Layer[]) => void;
  activeLayerId: string | null;
  setActiveLayerId: (id: string | null) => void;
}

const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

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
        <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
          <div
            onClick={() => toggleSection('controls')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
              <Sliders size={11} className="text-primary" />
              <span>{activeLayer.name}</span>
            </div>
            <ChevronDown
              size={12}
              className={`text-white/30 transition-transform duration-150 ${
                openSections.controls ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </div>

          {openSections.controls && (
            <div className="space-y-3 pt-1">
              {/* Blend Mode Selector */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-white/60 block">Blend Mode</span>
                <Dropdown
                  value={activeLayer.blendMode}
                  onChange={v => updateActiveLayer({ blendMode: v })}
                  options={BLEND_MODES}
                  className="w-full"
                />
              </div>

              {/* Layer Opacity */}
              <EditorSlider
                label="Layer Opacity"
                value={activeLayer.opacity}
                onChange={val => updateActiveLayer({ opacity: val })}
                min={0}
                max={100}
                defaultValue={100}
                unit="%"
              />

              {/* Fill Color */}
              {activeLayer.type === 'fill' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-medium text-white/60">Fill Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeLayer.fillColor || '#ef4444'}
                      onChange={e => updateActiveLayer({ fillColor: e.target.value })}
                      className="w-6 h-6 rounded-md border border-white/20 cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-[10px] text-white/70">
                      {activeLayer.fillColor || '#ef4444'}
                    </span>
                  </div>
                </div>
              )}

              {/* Adjustment Layer quick parameters */}
              {activeLayer.type === 'adjustment' && (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[10px] font-medium text-white/60">Adjustment Values</span>
                  <EditorSlider
                    label="Exposure"
                    value={activeLayer.adjustmentData?.exposure ?? 0}
                    onChange={val => updateActiveLayer({ adjustmentData: { ...activeLayer.adjustmentData, exposure: val } })}
                    min={-100}
                    max={100}
                    defaultValue={0}
                  />
                  <EditorSlider
                    label="Contrast"
                    value={activeLayer.adjustmentData?.contrast ?? 0}
                    onChange={val => updateActiveLayer({ adjustmentData: { ...activeLayer.adjustmentData, contrast: val } })}
                    min={-100}
                    max={100}
                    defaultValue={0}
                  />
                  <EditorSlider
                    label="Saturation"
                    value={activeLayer.adjustmentData?.saturation ?? 0}
                    onChange={val => updateActiveLayer({ adjustmentData: { ...activeLayer.adjustmentData, saturation: val } })}
                    min={-100}
                    max={100}
                    defaultValue={0}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. Layer Hierarchy List Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('stack')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Layers size={11} className="text-primary" />
            <span>Layer Hierarchy</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.stack ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.stack && (
          <div className="space-y-1.5 pt-1">
            {layers.map((l, idx) => {
              const isActive = l.id === (activeLayerId || layers[0]?.id);
              return (
                <div
                  key={l.id}
                  onClick={() => setActiveLayerId(l.id)}
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
                        handleToggleVisible(l.id);
                      }}
                      className={`${isActive ? 'text-black/60 hover:text-black' : 'text-white/40 hover:text-white'} transition-colors`}
                      title={l.visible ? 'Hide Layer' : 'Show Layer'}
                    >
                      {l.visible ? <Eye size={13} className={isActive ? 'text-black' : 'text-primary'} /> : <EyeOff size={13} />}
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[11px] font-medium truncate ${isActive ? 'text-black font-bold' : 'text-white/90'}`}>{l.name}</span>
                      <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-black/60 font-semibold' : 'text-white/40'}`}>{l.type} layer</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleMoveLayer(l.id, 'up');
                      }}
                      disabled={idx === 0}
                      className={`p-1 ${isActive ? 'text-black/50 hover:text-black' : 'text-white/30 hover:text-white'} disabled:opacity-20 cursor-pointer`}
                      title="Move Up"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleMoveLayer(l.id, 'down');
                      }}
                      disabled={idx === layers.length - 1}
                      className={`p-1 ${isActive ? 'text-black/50 hover:text-black' : 'text-white/30 hover:text-white'} disabled:opacity-20 cursor-pointer`}
                      title="Move Down"
                    >
                      <ArrowDown size={11} />
                    </button>
                    {layers.length > 1 && l.type !== 'pixel' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteLayer(l.id);
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
