import React, { useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  ChevronDown, ChevronRight, Plus,
} from 'lucide-react';
import { TextPanelProps } from '../types';
import { useVideoEditorStore } from '@/store/videoEditorStore';

const FONTS = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Verdana', 'Times New Roman'];

export const TextPanel: React.FC<TextPanelProps> = ({ selectedClip, onUpdate }) => {
  const [borderOpen, setBorderOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(true);

  if (!selectedClip || (selectedClip.type !== 'text' && selectedClip.type !== 'subtitle')) {
    return (
      <div className="p-5">
        <div className="space-y-4">
          <button
            onClick={() => {
              const state = useVideoEditorStore.getState();
              let textTrack = state.project?.tracks.find(t => t.type === 'text');
              if (!textTrack) {
                state.addTrack('text', 'Text');
                const newState = useVideoEditorStore.getState();
                textTrack = newState.project?.tracks.find(t => t.type === 'text');
              }
              if (textTrack) {
                const clip = {
                  id: 'clip_' + Date.now(),
                  type: 'text' as const,
                  startTime: state.project?.currentTime ?? 0,
                  duration: 3,
                  trimStart: 0,
                  trimEnd: 0,
                  speed: 1,
                  text: 'New Text',
                  fontFamily: 'Inter',
                  fontSize: 32,
                  fontColor: '#ffffff',
                  fontWeight: 'normal',
                  textAlign: 'center' as const,
                  x: 50,
                  y: 50,
                };
                state.addClip(textTrack.id, clip);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:border-white/10 transition-all text-xs font-medium"
          >
            <Plus size={14} />
            Add Text Layer
          </button>
          <p className="text-[11px] text-white/20 text-center">Select a text clip on the timeline to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      {/* Align */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Align</label>
        <div className="flex gap-1">
          {[
            { icon: AlignLeft, value: 'left' as const },
            { icon: AlignCenter, value: 'center' as const },
            { icon: AlignRight, value: 'right' as const },
          ].map(({ icon: Icon, value }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textAlign: value })}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                selectedClip.textAlign === value
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50 hover:border-white/10'
              }`}
            >
              <Icon size={13} />
            </button>
          ))}
          <div className="w-px bg-white/5 mx-1" />
          {[
            { icon: '⫶', value: 'istribute' },
            { icon: '≡', value: 'distribute-h' },
          ].map(({ icon, value }) => (
            <button
              key={value}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] text-white/20 border border-white/5 hover:text-white/40 hover:border-white/10 transition-all text-[11px]"
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Position</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">X</span>
            <input
              type="number"
              value={selectedClip.x ?? 50}
              onChange={(e) => onUpdate({ x: Number(e.target.value) })}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">Y</span>
            <input
              type="number"
              value={selectedClip.y ?? 50}
              onChange={(e) => onUpdate({ y: Number(e.target.value) })}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">R</span>
            <input
              type="number"
              defaultValue={0}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">W</span>
            <input
              type="number"
              defaultValue={135}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">H</span>
            <input
              type="number"
              defaultValue={20}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Radius */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Radius</label>
        <div className="grid grid-cols-4 gap-2">
          {[0, 0, 0, 0].map((_, i) => (
            <input
              key={i}
              type="number"
              defaultValue={0}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none focus:border-white/20 transition-colors font-mono"
            />
          ))}
        </div>
      </div>

      {/* Text Content */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Text</label>
        <textarea
          value={selectedClip.text ?? ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-[12px] text-white/80 outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
          placeholder="Enter text..."
        />
      </div>

      {/* Font Family + Size */}
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={selectedClip.fontFamily ?? 'Inter'}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
          >
            {FONTS.map(f => (
              <option key={f} value={f} className="bg-[#161A20] text-white/70">{f}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdate({ fontSize: Math.max(8, (selectedClip.fontSize ?? 24) - 1) })}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 text-white/40 hover:text-white/70 flex items-center justify-center text-sm transition-colors"
            >
              −
            </button>
            <input
              type="number"
              value={selectedClip.fontSize ?? 24}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              className="w-12 px-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/80 outline-none text-center font-mono"
            />
            <button
              onClick={() => onUpdate({ fontSize: Math.min(200, (selectedClip.fontSize ?? 24) + 1) })}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 text-white/40 hover:text-white/70 flex items-center justify-center text-sm transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Opacity + Letter Spacing */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">Opacity</span>
            <span className="text-[10px] text-white/50 font-mono">100%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={100}
            className="adjustment-slider"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">Spacing</span>
            <span className="text-[10px] text-white/50 font-mono">0</span>
          </div>
          <input
            type="range"
            min={-10}
            max={20}
            defaultValue={0}
            className="adjustment-slider"
          />
        </div>
      </div>

      {/* Style Buttons */}
      <div className="space-y-3">
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
                if (value === 'bold') onUpdate({ fontWeight: active ? 'normal' : 'bold' });
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50 hover:border-white/10'
              }`}
            >
              <Icon size={13} />
            </button>
          ))}
          <div className="w-px bg-white/5 mx-1" />
          {[
            { icon: AlignLeft, value: 'left' as const },
            { icon: AlignCenter, value: 'center' as const },
            { icon: AlignRight, value: 'right' as const },
          ].map(({ icon: Icon, value }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textAlign: value })}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                selectedClip.textAlign === value
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50 hover:border-white/10'
              }`}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>

      {/* Fill */}
      <div className="space-y-3">
        <button
          onClick={() => setFillOpen(!fillOpen)}
          className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white/50 transition-colors"
        >
          <span>Fill</span>
          <div className="flex items-center gap-1">
            <Plus size={10} />
            {fillOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </div>
        </button>
        {fillOpen && (
          <div className="space-y-3 pl-1">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white/40 w-12">Color</label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={selectedClip.fontColor ?? '#ffffff'}
                  onChange={(e) => onUpdate({ fontColor: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={selectedClip.fontColor ?? '#ffffff'}
                  onChange={(e) => onUpdate({ fontColor: e.target.value })}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[11px] text-white/70 outline-none font-mono uppercase"
                />
                <span className="text-[10px] text-white/30">100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Border */}
      <div className="space-y-3">
        <button
          onClick={() => setBorderOpen(!borderOpen)}
          className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white/50 transition-colors"
        >
          <span>Border</span>
          <div className="flex items-center gap-1">
            <Plus size={10} />
            {borderOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </div>
        </button>
        {borderOpen && (
          <div className="space-y-3 pl-1">
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
                <span className="text-[10px] text-white/40">Width</span>
                <span className="text-[10px] text-white/50 font-mono">2px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                defaultValue={2}
                className="adjustment-slider"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
