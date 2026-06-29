import React, { useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronRight } from 'lucide-react';
import { TextPanelProps } from '../types';

const FONTS = ['Inter', 'Arial', 'Georgia', 'Courier New'];

export const TextPanel: React.FC<TextPanelProps> = ({ selectedClip, onUpdate }) => {
  const [borderOpen, setBorderOpen] = useState(false);

  if (!selectedClip || (selectedClip.type !== 'text' && selectedClip.type !== 'subtitle')) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-[11px] text-white/20">Select a text clip to edit</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Font</label>
        <select
          value={selectedClip.fontFamily ?? 'Arial'}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/15 transition-colors appearance-none cursor-pointer"
        >
          {FONTS.map(f => (
            <option key={f} value={f} className="bg-[#161A20] text-white/70">{f}</option>
          ))}
        </select>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">Size</span>
            <span className="text-[10px] text-white/40 font-mono">{selectedClip.fontSize ?? 24}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={200}
            value={selectedClip.fontSize ?? 24}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Style</label>
        <div className="flex gap-1.5">
          {[
            { icon: Bold, value: 'bold', active: selectedClip.fontWeight === 'bold' },
            { icon: Italic, value: 'italic', active: false },
            { icon: Underline, value: 'underline', active: false },
            { icon: Strikethrough, value: 'strikethrough', active: false },
          ].map(({ icon: Icon, value, active }) => (
            <button
              key={value}
              onClick={() => {
                if (value === 'bold') {
                  onUpdate({ fontWeight: active ? 'normal' : 'bold' });
                }
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50 hover:border-white/10'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Alignment</label>
        <div className="flex gap-1.5">
          {[
            { icon: AlignLeft, value: 'left' as const },
            { icon: AlignCenter, value: 'center' as const },
            { icon: AlignRight, value: 'right' as const },
          ].map(({ icon: Icon, value }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textAlign: value })}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                selectedClip.textAlign === value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50 hover:border-white/10'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={selectedClip.fontColor ?? '#ffffff'}
            onChange={(e) => onUpdate({ fontColor: e.target.value })}
            className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
          />
          <span className="text-[10px] text-white/40 font-mono">{selectedClip.fontColor ?? '#ffffff'}</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-white/30">X</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={selectedClip.x ?? 50}
                onChange={(e) => onUpdate({ x: Number(e.target.value) })}
                className="w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/15 transition-colors font-mono"
              />
              <span className="text-[10px] text-white/20 shrink-0">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/30">Y</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={selectedClip.y ?? 50}
                onChange={(e) => onUpdate({ y: Number(e.target.value) })}
                className="w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/15 transition-colors font-mono"
              />
              <span className="text-[10px] text-white/20 shrink-0">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setBorderOpen(!borderOpen)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 hover:text-white/40 transition-colors"
        >
          {borderOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Border
        </button>
        {borderOpen && (
          <div className="space-y-3 pl-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value="#ffffff"
                className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
              />
              <span className="text-[10px] text-white/40">Border Color</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Width</span>
                <span className="text-[10px] text-white/40 font-mono">2px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                defaultValue={2}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/40 [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
