/**
 * SaveTemplateSection.tsx
 * UI for saving current adjustments as a new user template.
 */

import React from 'react';
import { Plus, Check, X } from 'lucide-react';

interface SaveTemplateSectionProps {
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  saveName: string;
  setSaveName: (name: string) => void;
  onSave: () => void;
}

export const SaveTemplateSection: React.FC<SaveTemplateSectionProps> = ({
  isSaving,
  setIsSaving,
  saveName,
  setSaveName,
  onSave,
}) => {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-white/5">
      {isSaving ? (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <label htmlFor="template-name-input" className="sr-only">Template Name</label>
          <input
            id="template-name-input"
            name="templateName"
            aria-label="Template Name"
            type="text"
            autoFocus
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') { setIsSaving(false); setSaveName(''); }
            }}
            placeholder="Template name…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 outline-none focus:border-primary/40 transition-colors"
          />
          <button
            onClick={onSave}
            disabled={!saveName.trim()}
            className="p-2 rounded-xl bg-primary text-[#050505] hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            onClick={() => { setIsSaving(false); setSaveName(''); }}
            className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white/70 transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsSaving(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/25 hover:bg-white/5 transition-all text-xs font-bold cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.5} />
          Save Current as Template
        </button>
      )}
    </div>
  );
};

