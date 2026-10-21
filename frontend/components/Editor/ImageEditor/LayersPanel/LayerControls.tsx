import React from 'react';
import { Sliders, ChevronDown } from 'lucide-react';
import { Layer } from '../layersEngine';
import { EditorSlider } from '../ui/EditorSlider';
import { Dropdown } from '@/components/ui/Dropdown';
import { BLEND_MODES } from './types';

interface LayerControlsProps {
  activeLayer: Layer;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateLayer: (patch: Partial<Layer>) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  activeLayer,
  isOpen,
  onToggle,
  onUpdateLayer,
}) => {
  return (
    <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
          <Sliders size={11} className="text-primary" />
          <span>{activeLayer.name}</span>
        </div>
        <ChevronDown
          size={12}
          className={`text-white/30 transition-transform duration-150 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </div>

      {isOpen && (
        <div className="space-y-3 pt-1">
          {/* Blend Mode Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-white/60 block">Blend Mode</span>
            <Dropdown
              value={activeLayer.blendMode}
              onChange={v => onUpdateLayer({ blendMode: v })}
              options={BLEND_MODES}
              className="w-full"
            />
          </div>

          {/* Layer Opacity */}
          <EditorSlider
            label="Layer Opacity"
            value={activeLayer.opacity}
            onChange={val => onUpdateLayer({ opacity: val })}
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
                  onChange={e => onUpdateLayer({ fillColor: e.target.value })}
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
                onChange={val =>
                  onUpdateLayer({
                    adjustmentData: { ...activeLayer.adjustmentData, exposure: val },
                  })
                }
                min={-100}
                max={100}
                defaultValue={0}
              />
              <EditorSlider
                label="Contrast"
                value={activeLayer.adjustmentData?.contrast ?? 0}
                onChange={val =>
                  onUpdateLayer({
                    adjustmentData: { ...activeLayer.adjustmentData, contrast: val },
                  })
                }
                min={-100}
                max={100}
                defaultValue={0}
              />
              <EditorSlider
                label="Saturation"
                value={activeLayer.adjustmentData?.saturation ?? 0}
                onChange={val =>
                  onUpdateLayer({
                    adjustmentData: { ...activeLayer.adjustmentData, saturation: val },
                  })
                }
                min={-100}
                max={100}
                defaultValue={0}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

