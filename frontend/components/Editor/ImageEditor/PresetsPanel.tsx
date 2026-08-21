/**
 * PresetsPanel.tsx
 * Film Looks + User Presets panel with vertical collapsible category accordions.
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
  CURATED_PRESETS,
  Preset,
  UserPreset,
  applyPreset,
  loadUserPresets,
  saveUserPreset,
  deleteUserPreset,
} from './presets';

interface PresetsPanelProps {
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

const getSampleUrlForPreset = (category?: string, presetId?: string) => {
  let filename = 'nature.png';
  if (category === 'Portrait') {
    filename = 'woman.png';
  } else if (
    category === 'Vintage' ||
    (presetId &&
      (presetId.includes('film') ||
        presetId.includes('kodachrome') ||
        presetId.includes('polaroid')))
  ) {
    filename = 'pet.png';
  } else if (category === 'Landscape') {
    filename = 'nature.png';
  } else if (category === 'Film') {
    filename = 'pet.png';
  }
  return resolveUrl(`/api/v1/sample-images/${filename}`);
};

export const PresetsPanel: React.FC<PresetsPanelProps> = ({ adjustments, onChange, imageSrc }) => {
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetIntensity, setPresetIntensity] = useState(100);

  // Collapsible vertical category states (all open by default)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'my-presets': true,
    Film: true,
    Portrait: true,
    Landscape: true,
    Vintage: true,
  });

  useEffect(() => {
    setUserPresets(loadUserPresets());
  }, []);

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const presetsByCategory = useMemo(() => {
    const groups: Record<string, Preset[]> = {
      Film: [],
      Portrait: [],
      Landscape: [],
      Vintage: [],
    };
    for (const preset of CURATED_PRESETS) {
      if (!groups[preset.category]) {
        groups[preset.category] = [];
      }
      groups[preset.category].push(preset);
    }
    return groups;
  }, []);

  const handleApplyCurated = useCallback((preset: Preset) => {
    setActivePresetId(preset.id);
    setPresetIntensity(100);
    onChange(applyPreset(adjustments, preset.adjustments));
  }, [adjustments, onChange]);

  const handleIntensityChange = useCallback((value: number) => {
    setPresetIntensity(value);
    if (activePresetId) {
      const preset = CURATED_PRESETS.find(p => p.id === activePresetId);
      if (preset) {
        const blended: Partial<Adjustments> = {};
        for (const [key, presetVal] of Object.entries(preset.adjustments)) {
          const defaultVal = (DEFAULT_ADJUSTMENTS as any)[key] ?? 0;
          if (typeof presetVal === 'number' && typeof defaultVal === 'number') {
            (blended as any)[key] = defaultVal + (presetVal - defaultVal) * (value / 100);
          } else {
            (blended as any)[key] = presetVal;
          }
        }
        onChange(applyPreset(adjustments, blended));
      }
    }
  }, [activePresetId, adjustments, onChange]);

  const handleApplyUser = useCallback((preset: UserPreset) => {
    setActivePresetId(preset.id);
    onChange({ ...preset.adjustments });
  }, [onChange]);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const saved = saveUserPreset(saveName, adjustments);
    setUserPresets(prev => [saved, ...prev]);
    setSaveName('');
    setIsSaving(false);
    setActivePresetId(saved.id);
  }, [saveName, adjustments]);

  const handleDelete = useCallback((id: string) => {
    deleteUserPreset(id);
    setUserPresets(prev => prev.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  }, [activePresetId]);

  const activePresetObj = useMemo(() => {
    if (!activePresetId) return null;
    return (
      CURATED_PRESETS.find(p => p.id === activePresetId) ||
      userPresets.find(p => p.id === activePresetId) ||
      null
    );
  }, [activePresetId, userPresets]);

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">

      {/* ── Save Current as Preset ── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        {isSaving ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <label htmlFor="preset-name-input" className="sr-only">Preset Name</label>
            <input
              id="preset-name-input"
              name="presetName"
              aria-label="Preset Name"
              type="text"
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setIsSaving(false); setSaveName(''); }
              }}
              placeholder="Preset name…"
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
            Save Current as Preset
          </button>
        )}
      </div>

      {/* ── Active Preset Intensity Slider ── */}
      {activePresetId && (
        <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 animate-in fade-in duration-200">
          <EditorSlider
            label="Preset Intensity"
            value={presetIntensity}
            onChange={handleIntensityChange}
            min={0}
            max={100}
            defaultValue={100}
            unit="%"
          />
        </div>
      )}

      {/* ── My Presets (Vertical Collapsible Section) ── */}
      {userPresets.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-white/5">
          <button
            type="button"
            onClick={() => toggleCategory('my-presets')}
            className="w-full flex items-center justify-between py-2 group/header text-left cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/5 text-white/40 group-hover/header:text-primary transition-colors">
                <Bookmark size={12} />
              </div>
              <span className="text-xs font-bold text-white/80 group-hover/header:text-white transition-colors">
                My Presets
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-mono">
                {userPresets.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-white/30 group-hover/header:text-white/60 transition-transform duration-200 ${
                openCategories['my-presets'] ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          {openCategories['my-presets'] && (
            <div className="space-y-2 pt-1 pb-3 animate-in fade-in duration-150">
              {userPresets.map(preset => {
                const isActive = activePresetId === preset.id;
                const sampleUrl = getSampleUrlForPreset('Film', preset.id);
                return (
                  <div
                    key={preset.id}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'border-white bg-white text-black shadow-lg'
                        : 'bg-[var(--bg-tertiary)] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                    }`}
                    onClick={() => handleApplyUser(preset)}
                  >
                    <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-white/10 bg-black/30">
                      <img
                        src={sampleUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                        style={{ filter: toFilterString(preset.adjustments) }}
                        crossOrigin="anonymous"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-black' : 'text-white/70'}`}>
                        {preset.name}
                      </p>
                      <p className={`text-[9px] ${isActive ? 'text-black/60 font-medium' : 'text-white/25'} mt-0.5`}>
                        {new Date(preset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(preset.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all cursor-pointer"
                      title="Delete Preset"
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
            {CURATED_PRESETS.length} Looks
          </span>
        </div>

        <div className="space-y-1">
          {CATEGORY_SECTIONS.map(cat => {
            const presets = presetsByCategory[cat.id] || [];
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
                      {presets.length}
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
                    {presets.map(preset => {
                      const isActive = activePresetId === preset.id;
                      const sampleUrl = getSampleUrlForPreset(preset.category, preset.id);

                      return (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyCurated(preset)}
                          className={`group relative flex flex-col items-start p-0 rounded-xl border overflow-hidden transition-all duration-150 text-left bg-[var(--bg-tertiary)] cursor-pointer ${
                            isActive
                              ? 'preset-card-selected border-white shadow-md'
                              : 'border-white/5 hover:border-white/20 hover:scale-[1.01]'
                          }`}
                        >
                          {/* Sample image preview area with preset filter applied */}
                          <div className="w-full h-[84px] shrink-0 relative overflow-hidden bg-black/30">
                            <img
                              src={sampleUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              style={{ filter: toFilterString(applyPreset(adjustments, preset.adjustments)) }}
                              crossOrigin="anonymous"
                            />
                            {/* Accent gradient bar */}
                            <div
                              className="absolute bottom-0 inset-x-0 h-0.5"
                              style={{ background: preset.accent }}
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
                              {preset.name}
                            </p>
                            <p className="text-[8px] text-white/25 mt-0.5 truncate leading-tight">
                              {preset.description}
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
