import React, { useState } from 'react';
import { X, Undo2, Redo2, Download, MousePointer, Hand } from 'lucide-react';
import { TopBarProps } from './types';
import { useVideoEditorStore } from '@/store/videoEditorStore';

export const TopBar: React.FC<TopBarProps> = ({ onClose }) => {
  const project = useVideoEditorStore((s) => s.project);
  const [activeCursor, setActiveCursor] = useState<'select' | 'hand'>('select');

  return (
    <div className="h-14 flex items-center justify-between px-6 bg-[var(--bg-primary)] border-b border-white/5 shrink-0 z-50 relative">
      <div className="flex items-center gap-4">
        {/* macOS-style window control dots */}
        <div className="flex items-center gap-1.5 mr-1 select-none">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>

        <button
          onClick={onClose}
          className="group flex items-center gap-2 text-white/45 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
        >
          <div className="p-2 rounded-full border border-white/5 group-hover:border-white/20 transition-colors bg-[var(--bg-secondary)]">
            <X size={14} />
          </div>
          Close
        </button>
        <div className="h-5 w-px bg-white/10" />
        <span className="text-sm text-white/60 font-medium truncate max-w-[300px]">
          {project?.name || 'Untitled Project'}
        </span>
      </div>

      {/* Center Tool Toggles */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[var(--bg-secondary)] border border-white/5 rounded-full px-2.5 py-1 shadow-inner shadow-black/10">
        {/* Cursor Toggles */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2.5">
          <button
            onClick={() => setActiveCursor('select')}
            title="Select Tool (V)"
            className={`p-1.5 rounded-lg transition-all ${
              activeCursor === 'select'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
            }`}
          >
            <MousePointer size={14} strokeWidth={2} />
          </button>
          <button
            onClick={() => setActiveCursor('hand')}
            title="Hand Tool (H)"
            className={`p-1.5 rounded-lg transition-all ${
              activeCursor === 'hand'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
            }`}
          >
            <Hand size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Undo/Redo Toggles */}
        <div className="flex items-center gap-1">
          <button
            disabled
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-lg text-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all hover:bg-white/[0.02] hover:text-white cursor-pointer"
          >
            <Undo2 size={14} strokeWidth={2} />
          </button>
          <button
            disabled
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-lg text-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all hover:bg-white/[0.02] hover:text-white cursor-pointer"
          >
            <Redo2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Collaborative Avatars */}
        <div className="flex items-center -space-x-1.5 mr-2">
          <div 
            className="w-6 h-6 rounded-full border border-[var(--bg-primary)] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/5 select-none"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #fb923c)' }}
          >
            A
          </div>
          <div 
            className="w-6 h-6 rounded-full border border-[var(--bg-primary)] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/5 select-none"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
          >
            M
          </div>
          <div 
            className="w-6 h-6 rounded-full border border-[var(--bg-primary)] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/5 select-none"
            style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}
          >
            K
          </div>
          <div className="w-6 h-6 rounded-full border border-[var(--bg-primary)] bg-zinc-800 flex items-center justify-center text-[8px] font-medium text-white/60 shadow-sm ring-1 ring-white/5 select-none">
            +3
          </div>
        </div>

        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/20 bg-primary text-[#050505] text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </div>
  );
};
