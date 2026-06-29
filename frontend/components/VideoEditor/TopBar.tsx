import React from 'react';
import { X, Undo2, Redo2, Download } from 'lucide-react';
import { TopBarProps } from './types';
import { useVideoEditorStore } from '@/store/videoEditorStore';

export const TopBar: React.FC<TopBarProps> = ({ onClose }) => {
  const project = useVideoEditorStore((s) => s.project);

  return (
    <div className="h-14 flex items-center justify-between px-6 bg-[var(--bg-primary)] border-b border-white/5 shrink-0 z-50">
      <div className="flex items-center gap-4">
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

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        <button
          disabled
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-xl border border-white/5 bg-[var(--bg-secondary)] text-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <Undo2 size={13} strokeWidth={2.5} />
        </button>
        <button
          disabled
          title="Redo (Ctrl+Y)"
          className="p-2 rounded-xl border border-white/5 bg-[var(--bg-secondary)] text-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <Redo2 size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center gap-3">
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
