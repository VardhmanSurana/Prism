/**
 * TemplatesPanel.tsx
 * Film Looks + User Templates panel with vertical collapsible category accordions.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, Bookmark } from 'lucide-react';
import { Adjustments, DEFAULT_ADJUSTMENTS } from '../filterEngine';
import { EditorSlider } from '../ui/EditorSlider';
import {
  CURATED_TEMPLATES,
  Template,
  UserTemplate,
  applyTemplate,
  loadUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
} from '../templates';
import { TemplatesPanelProps } from './types';
import { CATEGORY_SECTIONS } from './sampleUrls';
import { SaveTemplateSection } from './SaveTemplateSection';
import { UserTemplateCard } from './UserTemplateCard';
import { CuratedTemplateCard } from './CuratedTemplateCard';

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ adjustments, onChange }) => {
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

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">
      {/* ── Save Current as Template ── */}
      <SaveTemplateSection
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        saveName={saveName}
        setSaveName={setSaveName}
        onSave={handleSave}
      />

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
              {userTemplates.map(template => (
                <UserTemplateCard
                  key={template.id}
                  template={template}
                  isActive={activeTemplateId === template.id}
                  onApply={handleApplyUser}
                  onDelete={handleDelete}
                />
              ))}
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
                    {templates.map(template => (
                      <CuratedTemplateCard
                        key={template.id}
                        template={template}
                        isActive={activeTemplateId === template.id}
                        adjustments={adjustments}
                        onApply={handleApplyCurated}
                      />
                    ))}
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

