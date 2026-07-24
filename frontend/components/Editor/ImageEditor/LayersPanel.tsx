import React from 'react';
import { Layer, LayerType, createDefaultBaseLayer } from './layersEngine';
import { Layers, Eye, EyeOff, Plus, Trash2, Copy, Sliders, PaintBucket, ArrowUp, ArrowDown } from 'lucide-react';

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
  layers = [createDefaultBaseLayer()],
  onChange,
  activeLayerId,
  setActiveLayerId,
}) => {
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
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Layers & Blend Modes</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleAddLayer('adjustment')}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Add Adjustment Layer"
          >
            <Sliders size={12} />
          </button>
          <button
            onClick={() => handleAddLayer('fill')}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Add Fill Layer"
          >
            <PaintBucket size={12} />
          </button>
        </div>
      </div>

      {/* Active Layer Controls */}
      {activeLayer && (
        <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 space-y-3">
          <div className="flex justify-between items-center text-[10px] font-semibold uppercase text-white/50">
            <span>{activeLayer.name} Settings</span>
            <span className="font-mono text-primary">{activeLayer.blendMode}</span>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-white/60">Blend Mode</label>
            <select
              value={activeLayer.blendMode}
              onChange={e => updateActiveLayer({ blendMode: e.target.value as GlobalCompositeOperation })}
              className="w-full bg-black/40 border border-white/10 text-[11px] text-white rounded p-1.5 outline-none cursor-pointer"
            >
              {BLEND_MODES.map(b => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/60">
              <span>Layer Opacity</span>
              <span className="font-mono">{activeLayer.opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={activeLayer.opacity}
              onChange={e => updateActiveLayer({ opacity: Number(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {activeLayer.type === 'fill' && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-white/60">Fill Color</span>
              <input
                type="color"
                value={activeLayer.fillColor || '#ef4444'}
                onChange={e => updateActiveLayer({ fillColor: e.target.value })}
                className="w-5 h-5 rounded border-none cursor-pointer bg-transparent"
              />
            </div>
          )}
        </div>
      )}

      {/* Layer Stack List */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Layer Hierarchy</p>
        {layers.map((l, idx) => {
          const isActive = l.id === (activeLayerId || layers[0]?.id);
          return (
            <div
              key={l.id}
              onClick={() => setActiveLayerId(l.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-white/10 border-primary/40 shadow-sm'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleVisible(l.id);
                  }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  {l.visible ? <Eye size={13} className="text-primary" /> : <EyeOff size={13} />}
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium text-white/90 truncate">{l.name}</span>
                  <span className="text-[9px] text-white/40 uppercase tracking-wider">{l.type} layer</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleMoveLayer(l.id, 'up');
                  }}
                  disabled={idx === 0}
                  className="p-1 text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleMoveLayer(l.id, 'down');
                  }}
                  disabled={idx === layers.length - 1}
                  className="p-1 text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteLayer(l.id);
                  }}
                  disabled={layers.length <= 1}
                  className="p-1 text-white/30 hover:text-red-400 disabled:opacity-20 cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
