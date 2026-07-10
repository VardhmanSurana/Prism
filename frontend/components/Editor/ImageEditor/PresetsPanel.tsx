/**
 * PresetsPanel.tsx
 * Film Looks + User Presets panel.
 *
 * Layout:
 *  - "Film Looks" section: 2-column grid of curated preset cards.
 *  - "My Presets" section: user-saved presets with delete button.
 *  - "Save Current" button: prompts for a name and saves to localStorage.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { BookMarked, Plus, Trash2, X, Check } from 'lucide-react';
import { Adjustments, DEFAULT_ADJUSTMENTS, toFilterString } from './filterEngine';
import { resolveUrl } from '@/constants';
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

export const PresetsPanel: React.FC<PresetsPanelProps> = ({ adjustments, onChange, imageSrc }) => {
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [presetIntensity, setPresetIntensity] = useState(100);

  const categories = ['All', 'Film', 'Portrait', 'Landscape', 'Vintage'];

  const previewUrl = useMemo(() => {
    if (!imageSrc) return '';
    const resolved = resolveUrl(imageSrc);
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}previewKey=${Date.now()}`;
  }, [imageSrc]);

  useEffect(() => {
    setUserPresets(loadUserPresets());
  }, []);

  const filteredPresets = useMemo(() => {
    if (activeCategory === 'All') return CURATED_PRESETS;
    return CURATED_PRESETS.filter(p => p.category === activeCategory);
  }, [activeCategory]);

  const handleApplyCurated = useCallback((preset: Preset) => {
    setActivePresetId(preset.id);
    setPresetIntensity(100);
    if (presetIntensity === 100) {
      onChange(applyPreset(adjustments, preset.adjustments));
    } else {
      const blended: Partial<Adjustments> = {};
      for (const [key, value] of Object.entries(preset.adjustments)) {
        const defaultVal = (DEFAULT_ADJUSTMENTS as any)[key] ?? 0;
        if (typeof value === 'number' && typeof defaultVal === 'number') {
          (blended as any)[key] = defaultVal + (value - defaultVal) * (presetIntensity / 100);
        } else {
          (blended as any)[key] = value;
        }
      }
      onChange(applyPreset(adjustments, blended));
    }
  }, [adjustments, onChange, presetIntensity]);

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

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">

      {/* ── Save current as preset ── */}
      <div className="px-4 pt-4 pb-3">
        {isSaving ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
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
              className="p-2 rounded-xl bg-primary text-[#050505] hover:brightness-110 disabled:opacity-40 transition-all"
            >
              <Check size={14} strokeWidth={3} />
            </button>
            <button
              onClick={() => { setIsSaving(false); setSaveName(''); }}
              className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white/70 transition-all"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsSaving(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 hover:bg-white/5 transition-all text-xs font-bold"
          >
            <Plus size={13} />
            Save Current as Preset
          </button>
        )}
      </div>

      {/* ── My Presets ── */}
      {userPresets.length > 0 && (
        <div className="px-4 pb-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">My Presets</p>
          <div className="space-y-2">
            {userPresets.map(preset => {
              const isActive = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'preset-card-selected border-white'
                      : 'bg-[var(--bg-tertiary)] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                  }`}
                  onClick={() => handleApplyUser(preset)}
                >
                  {/* Color swatch or image preview */}
                  <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-white/10 bg-black/30">
                    {imageSrc ? (
                      <img
                        src={previewUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                        style={{ filter: toFilterString(preset.adjustments) }}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                      >
                        <BookMarked size={12} className="text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-primary' : 'text-white/70'}`}>
                      {preset.name}
                    </p>
                    <p className="text-[9px] text-white/25 mt-0.5">
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(preset.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Film Looks ── */}
      <div className="px-4 pb-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">Film Looks</p>

        {/* Category Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto custom-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-white/30 hover:text-white/50 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Preset Intensity Slider */}
        {activePresetId && (
          <div className="mb-4 group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Intensity</label>
              <span className="text-[10px] tabular-nums text-primary font-mono font-bold">{presetIntensity}%</span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                style={{
                  left: '0%',
                  width: `${presetIntensity}%`,
                  background: `rgb(var(--color-primary) / 0.8)`,
                  boxShadow: '0 0 8px rgb(var(--color-primary) / 0.3)',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={presetIntensity}
                onChange={e => handleIntensityChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {filteredPresets.map(preset => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyCurated(preset)}
                className={`group relative flex flex-col items-start p-0 rounded-2xl border overflow-hidden transition-all duration-200 text-left bg-[var(--bg-tertiary)] ${
                  isActive
                    ? 'preset-card-selected border-white'
                    : 'border-white/5 hover:border-white/15 hover:scale-[1.01]'
                }`}
              >
                {/* Image preview area with preset filter */}
                <div className="w-full h-[90px] shrink-0 relative overflow-hidden bg-black/30">
                  {imageSrc ? (
                    <img
                      src={previewUrl}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                      style={{ filter: toFilterString(applyPreset(adjustments, preset.adjustments)) }}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: preset.accent }}
                    />
                  )}
                </div>

                {/* Active check overlay */}
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg z-10">
                    <Check size={10} strokeWidth={3} className="text-black" />
                  </div>
                )}

                {/* Label */}
                <div className="w-full px-2.5 py-2 bg-[var(--bg-tertiary)]">
                  <p className={`text-[10px] font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                    {preset.name}
                  </p>
                  <p className="text-[8px] text-white/20 mt-0.5 truncate">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
