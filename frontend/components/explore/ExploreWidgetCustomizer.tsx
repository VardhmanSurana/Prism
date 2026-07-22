import React, { useState } from 'react';
import { SlidersHorizontal, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, X } from 'lucide-react';
import { GlassMaterial } from '@/components/ui/GlassMaterial';

export interface WidgetConfig {
  id: string;
  label: string;
  enabled: boolean;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'memories', label: 'Memories Carousel', enabled: true },
  { id: 'insights', label: 'Photography Insights & Stats', enabled: true },
  { id: 'rediscover', label: 'Rediscover & Organise Micro-Tasks', enabled: true },
  { id: 'activity', label: 'Recent Activity Feed', enabled: true },
  { id: 'highlights', label: 'Auto-Generated Highlight Reels', enabled: true },
  { id: 'on-this-day', label: 'On This Day', enabled: true },
  { id: 'ai-themes', label: 'AI Themes & Categories', enabled: true },
  { id: 'seasons', label: 'Seasonal Memory Grids', enabled: true },
  { id: 'timeline', label: 'Event Timeline', enabled: true },
];

export const LAYOUT_STORAGE_KEY = 'prism_explore_layout_v1';

export const loadSavedWidgets = (): WidgetConfig[] => {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed: WidgetConfig[] = JSON.parse(raw);
      // Merge with default to handle newly added widgets
      const savedIds = new Set(parsed.map(w => w.id));
      const missing = DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id));
      return [...parsed, ...missing];
    }
  } catch (e) {
    console.error('Failed to load explore widget layout:', e);
  }
  return DEFAULT_WIDGETS;
};

interface ExploreWidgetCustomizerProps {
  widgets: WidgetConfig[];
  onChange: (widgets: WidgetConfig[]) => void;
}

export const ExploreWidgetCustomizer: React.FC<ExploreWidgetCustomizerProps> = ({ widgets, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localWidgets, setLocalWidgets] = useState<WidgetConfig[]>(widgets);

  const handleToggle = (id: string) => {
    const updated = localWidgets.map(w => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    setLocalWidgets(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= localWidgets.length) return;
    const copy = [...localWidgets];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIdx, 0, moved);
    setLocalWidgets(copy);
  };

  const handleReset = () => {
    setLocalWidgets(DEFAULT_WIDGETS);
  };

  const handleSave = () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(localWidgets));
    onChange(localWidgets);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => {
          setLocalWidgets(widgets);
          setIsOpen(true);
        }}
        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white transition-colors flex items-center gap-1.5"
        aria-label="Customize Dashboard Layout"
      >
        <SlidersHorizontal size={13} className="text-primary" />
        <span>Customize Dashboard</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <GlassMaterial intensity="medium" className="relative w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-serif font-bold text-white mb-1">Customize Explore Dashboard</h3>
            <p className="text-xs text-gray-400 mb-5">Toggle visibility and reorder dashboard widgets to match your workflow.</p>

            <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar pr-1 mb-6">
              {localWidgets.map((w, idx) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(w.id)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        w.enabled ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-gray-500'
                      }`}
                    >
                      {w.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <span className={`text-sm font-medium ${w.enabled ? 'text-white' : 'text-gray-500 line-through'}`}>
                      {w.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-white disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === localWidgets.length - 1}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-white disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-medium text-white hover:bg-white/15"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90"
                >
                  Save Layout
                </button>
              </div>
            </div>
          </GlassMaterial>
        </div>
      )}
    </>
  );
};
