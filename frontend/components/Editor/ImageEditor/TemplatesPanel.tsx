/**
 * TemplatesPanel.tsx
 * Film Looks + User Templates panel with vertical collapsible category accordions.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  X,
  Check,
  ChevronDown,
  Film,
  User,
  Mountain,
  History,
  Bookmark,
  Sliders,
} from 'lucide-react';
import { Adjustments, DEFAULT_ADJUSTMENTS, toFilterString } from './filterEngine';
import { resolveUrl } from '@/constants';
import { EditorSlider } from './ui/EditorSlider';
import {
  CURATED_TEMPLATES,
  Template,
  UserTemplate,
  applyTemplate,
  loadUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
} from './templates';

interface TemplatesPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
  imageSrc?: string;
}

const CATEGORY_SECTIONS = [
  { id: 'Film', label: 'Film & Analog', icon: Film },
  { id: 'Portrait', label: 'Portrait & Skin', icon: User },
  { id: 'Landscape', label: 'Landscape & Nature', icon: Mountain },
  { id: 'Vintage', label: 'Vintage & Retro', icon: History },
] as const;

const getSampleUrlForTemplate = (category?: string, templateId?: string) => {
  let filename = 'nature.png';
  if (category === 'Portrait') {
    filename = 'woman.png';
  } else if (
    category === 'Vintage' ||
    (templateId &&
      (templateId.includes('film') ||
        templateId.includes('kodachrome') ||
        templateId.includes('polaroid')))
  ) {
    filename = 'pet.png';
  } else if (category === 'Landscape') {
    filename = 'nature.png';
  } else if (category === 'Film') {
    filename = 'pet.png';
  }
  return resolveUrl(`/api/v1/sample-images/${filename}`);
};

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ adjustments, onChange, imageSrc }) => {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateIntensity, setTemplateIntensity] = useState(100);

  // Collapsible vertical category states (all open by default)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'my-templates': true,
    Film: true,
    Portrait: true,
    Landscape: true,
    Vintage: true,
  });

  useEffect(() => {
    setUserTemplates(loadUserTemplates());
  }, []);

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, Template[]> = {
      Film: [],
      Portrait: [],
      Landscape: [],
      Vintage: [],
    };
    for (const template of CURATED_TEMPLATES) {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    }
    return groups;
  }, []);

  const handleApplyCurated = useCallback((template: Template) => {
    setActiveTemplateId(template.id);
    setTemplateIntensity(100);
    onChange(applyTemplate(adjustments, template.adjustments));
  }, [adjustments, onChange]);

  const handleIntensityChange = useCallback((value: number) => {
    setTemplateIntensity(value);
    if (activeTemplateId) {
      const template = CURATED_TEMPLATES.find(p => p.id === activeTemplateId);
      if (template) {
        const blended: Partial<Adjustments> = {};
        for (const [key, templateVal] of Object.entries(template.adjustments)) {
          const defaultVal = (DEFAULT_ADJUSTMENTS as any)[key] ?? 0;
          if (typeof templateVal === 'number' && typeof defaultVal === 'number') {
            (blended as any)[key] = defaultVal + (templateVal - defaultVal) * (value / 100);
          } else {
            (blended as any)[key] = templateVal;
          }
        }
        onChange(applyTemplate(adjustments, blended));
      }
    }
  }, [activeTemplateId, adjustments, onChange]);

  const handleApplyUser = useCallback((template: UserTemplate) => {
    setActiveTemplateId(template.id);
    onChange({ ...template.adjustments });
  }, [onChange]);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const saved = saveUserTemplate(saveName, adjustments);
    setUserTemplates(prev => [saved, ...prev]);
    setSaveName('');
    setIsSaving(false);
    setActiveTemplateId(saved.id);
  }, [saveName, adjustments]);

  const handleDelete = useCallback((id: string) => {
    deleteUserTemplate(id);
    setUserTemplates(prev => prev.filter(p => p.id !== id));
    if (activeTemplateId === id) setActiveTemplateId(null);
  }, [activeTemplateId]);

  const activeTemplateObj = useMemo(() => {
    if (!activeTemplateId) return null;
    return (
      CURATED_TEMPLATES.find(p => p.id === activeTemplateId) ||
      userTemplates.find(p => p.id === activeTemplateId) ||
      null
    );
  }, [activeTemplateId, userTemplates]);

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">

      {/* ── Save Current as Template ── */}
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
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setIsSaving(false); setSaveName(''); }
              }}
              placeholder="Template name…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 outline-none focus:border-primary/40 transition-colors"
            />
            <button
              onClick={handleSave}
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

      {/* ── Active Template Intensity Slider ── */}
      {activeTemplateId && (
        <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 animate-in fade-in duration-200">
          <EditorSlider
            label="Template Intensity"
            value={templateIntensity}
            onChange={handleIntensityChange}
            min={0}
            max={100}
            defaultValue={100}
            unit="%"
          />
        </div>
      )}

      {/* ── My Templates (Vertical Collapsible Section) ── */}
      {userTemplates.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-white/5">
          <button
            type="button"
            onClick={() => toggleCategory('my-templates')}
            className="w-full flex items-center justify-between py-2 group/header text-left cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/5 text-white/40 group-hover/header:text-primary transition-colors">
                <Bookmark size={12} />
              </div>
              <span className="text-xs font-bold text-white/80 group-hover/header:text-white transition-colors">
                My Templates
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-mono">
                {userTemplates.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-white/30 group-hover/header:text-white/60 transition-transform duration-200 ${
                openCategories['my-templates'] ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          {openCategories['my-templates'] && (
            <div className="space-y-2 pt-1 pb-3 animate-in fade-in duration-150">
              {userTemplates.map(template => {
                const isActive = activeTemplateId === template.id;
                const sampleUrl = getSampleUrlForTemplate('Film', template.id);
                return (
                  <div
                    key={template.id}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'border-white bg-white text-black shadow-lg'
                        : 'bg-[var(--bg-tertiary)] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                    }`}
                    onClick={() => handleApplyUser(template)}
                  >
                    <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-white/10 bg-black/30">
                      <img
                        src={sampleUrl}
                        alt={template.name}
                        className="w-full h-full object-cover"
                        style={{ filter: toFilterString(template.adjustments) }}
                        crossOrigin="anonymous"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-black' : 'text-white/70'}`}>
                        {template.name}
                      </p>
                      <p className={`text-[9px] ${isActive ? 'text-black/60 font-medium' : 'text-white/25'} mt-0.5`}>
                        {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(template.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Film Looks (Vertical Collapsible Categories) ── */}
      <div className="px-4 pt-3 pb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
            Film Looks
          </p>
          <span className="text-[9px] font-mono text-white/20">
            {CURATED_TEMPLATES.length} Looks
          </span>
        </div>

        <div className="space-y-1">
          {CATEGORY_SECTIONS.map(cat => {
            const templates = templatesByCategory[cat.id] || [];
            const isOpen = !!openCategories[cat.id];
            const Icon = cat.icon;

            return (
              <div key={cat.id} className="border-b border-white/5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between py-2.5 px-0.5 group/header text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-white/5 text-white/40 group-hover/header:text-primary transition-colors">
                      <Icon size={12} />
                    </div>
                    <span className="text-xs font-bold text-white/75 group-hover/header:text-white transition-colors">
                      {cat.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/5 text-white/30 font-mono">
                      {templates.length}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-white/30 group-hover/header:text-white/60 transition-transform duration-200 ${
                      isOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="grid grid-cols-2 gap-2 pt-1 pb-3.5 animate-in fade-in duration-150">
                    {templates.map(template => {
                      const isActive = activeTemplateId === template.id;
                      const sampleUrl = getSampleUrlForTemplate(template.category, template.id);

                      return (
                        <button
                          key={template.id}
                          onClick={() => handleApplyCurated(template)}
                          className={`group relative flex flex-col items-start p-0 rounded-xl border overflow-hidden transition-all duration-150 text-left bg-[var(--bg-tertiary)] cursor-pointer ${
                            isActive
                              ? 'template-card-selected border-white shadow-md'
                              : 'border-white/5 hover:border-white/20 hover:scale-[1.01]'
                          }`}
                        >
                          {/* Sample image preview area with template filter applied */}
                          <div className="w-full h-[84px] shrink-0 relative overflow-hidden bg-black/30">
                            <img
                              src={sampleUrl}
                              alt={template.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              style={{ filter: toFilterString(applyTemplate(adjustments, template.adjustments)) }}
                              crossOrigin="anonymous"
                            />
                            {/* Accent gradient bar */}
                            <div
                              className="absolute bottom-0 inset-x-0 h-0.5"
                              style={{ background: template.accent }}
                            />
                          </div>

                          {/* Active check overlay */}
                          {isActive && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg z-10">
                              <Check size={10} strokeWidth={3} className="text-black" />
                            </div>
                          )}

                          {/* Label */}
                          <div className={`w-full px-2.5 py-1.5 ${isActive ? 'bg-white' : 'bg-[var(--bg-tertiary)]'}`}>
                            <p
                              className={`text-[10px] font-bold truncate transition-colors ${
                                isActive ? 'text-black font-extrabold' : 'text-white/60 group-hover:text-white/90'
                              }`}
                            >
                              {template.name}
                            </p>
                            <p className="text-[8px] text-white/25 mt-0.5 truncate leading-tight">
                              {template.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
