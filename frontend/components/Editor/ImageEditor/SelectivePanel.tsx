import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Loader2, Sparkles, Image as ImageIcon, Cloud, Droplets, TreeDeciduous } from 'lucide-react';
import { Adjustments, RegionalAdjustment } from './filterEngine';
import { API_BASE, resolveUrl } from '@/constants';

interface RegionData {
  id: string;
  label: string;
  type: string;
  maskUrl: string;
  bounding_box: { x: number; y: number; width: number; height: number };
  confidence: number;
  mask?: string;
}

interface SelectivePanelProps {
  photoId?: number | string;
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

const getIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('sky')) return <Cloud size={14} />;
  if (l.includes('water')) return <Droplets size={14} />;
  if (l.includes('grass') || l.includes('tree')) return <TreeDeciduous size={14} />;
  return <ImageIcon size={14} />;
};

export const SelectivePanel: React.FC<SelectivePanelProps> = ({ photoId, adjustments, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [availableRegions, setAvailableRegions] = useState<RegionData[]>([]);

  useEffect(() => {
    setAvailableRegions([]);
  }, [photoId]);

  const fetchRegions = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Get Subject/Background
      const bgRes = await fetch(`${API_BASE}/api/v1/photos/background-mask/${photoId}`);
      const bgData = await bgRes.json();
      
      // 2. Get Semantic Regions (Sky, Water, etc.)
      const semRes = await fetch(`${API_BASE}/api/v1/photos/semantic-masks/${photoId}`);
      const semData = await semRes.json();

      const combined = [
        { id: `background-${photoId}`, label: 'Background', type: 'background', maskUrl: resolveUrl(bgData.mask_url) },
        ...semData.regions
      ];
      
      setAvailableRegions(combined);
    } catch (e) {
      console.error("Failed to fetch regions", e);
    } finally {
      setIsLoading(false);
    }
  }, [photoId]);

  useEffect(() => {
    if (photoId) {
      fetchRegions();
    }
  }, [photoId, fetchRegions]);

  const handleToggleRegion = useCallback((reg: RegionData) => {
    const exists = adjustments.regions.find(r => r.id === reg.id);
    if (exists) {
      // Remove it
      onChange({ ...adjustments, regions: adjustments.regions.filter(r => r.id !== reg.id) });
    } else {
      // Add it
      onChange({
        ...adjustments,
        regions: [...adjustments.regions, {
          id: reg.id,
          type: reg.type as RegionalAdjustment['type'],
          maskUrl: reg.maskUrl,
          adjustments: { brightness: 0, contrast: 0, saturation: 0, blur: 0 }
        }]
      });
    }
  }, [adjustments, onChange]);

  const handleRegionChange = useCallback((regionId: string, key: keyof RegionalAdjustment['adjustments'], value: number) => {
    const newRegions = adjustments.regions.map(r => {
      if (r.id === regionId) {
        return {
          ...r,
          adjustments: { ...r.adjustments, [key]: value }
        };
      }
      return r;
    });
    onChange({ ...adjustments, regions: newRegions });
  }, [adjustments, onChange]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Layers size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Selective AI Edits</h3>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-white/30 space-y-3">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-[10px] uppercase font-medium tracking-widest">Scanning Scenery...</p>
        </div>
      ) : availableRegions.length === 0 ? (
        <div className="text-center py-10 text-white/20">
          <p className="text-xs">No selectable regions found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Selection Chips */}
          <div className="flex flex-wrap gap-2">
            {availableRegions.map(reg => {
              const active = !!adjustments.regions.find(r => r.id === reg.id);
              return (
                <button
                  key={reg.id}
                  onClick={() => handleToggleRegion(reg)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                    active 
                      ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20' 
                      : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  {getIcon(reg.label)}
                  {reg.label}
                </button>
              );
            })}
          </div>

          {/* Active Adjustment Sliders */}
          <div className="space-y-8 pt-2">
            {adjustments.regions.map(reg => {
              const info = availableRegions.find(ar => ar.id === reg.id);
              if (!info) return null;

              return (
                <div key={reg.id} className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-primary">{getIcon(info.label)}</div>
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{info.label} Adjustments</span>
                    </div>
                    <button 
                      onClick={() => handleToggleRegion(info)}
                      className="text-[9px] font-bold text-white/20 hover:text-red-400 uppercase"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Brightness */}
                  <div className="space-y-2 group/item">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Brightness</label>
                      <span className="text-[10px] tabular-nums text-primary font-mono font-bold transition-all duration-300">{reg.adjustments.brightness || 0}</span>
                    </div>
                    <div className="relative h-4 flex items-center group/slider">
                      <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                      <div
                        className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                        style={{
                          left:  `${Math.min(50, ((reg.adjustments.brightness || 0) + 100) / 2)}%`,
                          width: `${Math.abs(((reg.adjustments.brightness || 0) + 100) / 2 - 50)}%`,
                          background: `rgb(var(--color-primary) / ${reg.adjustments.brightness !== 0 ? 0.8 : 0.2})`,
                          boxShadow: reg.adjustments.brightness !== 0 ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
                        }}
                      />
                      <input
                        type="range" min="-100" max="100"
                        value={reg.adjustments.brightness || 0}
                        onChange={(e) => handleRegionChange(reg.id, 'brightness', Number(e.target.value))}
                        className="adjustment-slider slider-thumb-premium"
                      />
                    </div>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-2 group/item">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Contrast</label>
                      <span className="text-[10px] tabular-nums text-primary font-mono font-bold transition-all duration-300">{reg.adjustments.contrast || 0}</span>
                    </div>
                    <div className="relative h-4 flex items-center group/slider">
                      <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                      <div
                        className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                        style={{
                          left:  `${Math.min(50, ((reg.adjustments.contrast || 0) + 100) / 2)}%`,
                          width: `${Math.abs(((reg.adjustments.contrast || 0) + 100) / 2 - 50)}%`,
                          background: `rgb(var(--color-primary) / ${reg.adjustments.contrast !== 0 ? 0.8 : 0.2})`,
                          boxShadow: reg.adjustments.contrast !== 0 ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
                        }}
                      />
                      <input
                        type="range" min="-100" max="100"
                        value={reg.adjustments.contrast || 0}
                        onChange={(e) => handleRegionChange(reg.id, 'contrast', Number(e.target.value))}
                        className="adjustment-slider slider-thumb-premium"
                      />
                    </div>
                  </div>

                  {/* Saturation */}
                  <div className="space-y-2 group/item">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Saturation</label>
                      <span className="text-[10px] tabular-nums text-primary font-mono font-bold transition-all duration-300">{reg.adjustments.saturation || 0}</span>
                    </div>
                    <div className="relative h-4 flex items-center group/slider">
                      <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                      <div
                        className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                        style={{
                          left:  `${Math.min(50, ((reg.adjustments.saturation || 0) + 100) / 2)}%`,
                          width: `${Math.abs(((reg.adjustments.saturation || 0) + 100) / 2 - 50)}%`,
                          background: `rgb(var(--color-primary) / ${reg.adjustments.saturation !== 0 ? 0.8 : 0.2})`,
                          boxShadow: reg.adjustments.saturation !== 0 ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
                        }}
                      />
                      <input
                        type="range" min="-100" max="100"
                        value={reg.adjustments.saturation || 0}
                        onChange={(e) => handleRegionChange(reg.id, 'saturation', Number(e.target.value))}
                        className="adjustment-slider slider-thumb-premium"
                      />
                    </div>
                  </div>

                  {/* Blur (Specific for Background) */}
                  {reg.type === 'background' && (
                    <div className="space-y-2 group/item">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Blur (Bokeh)</label>
                        <span className="text-[10px] tabular-nums text-primary font-mono font-bold transition-all duration-300">{reg.adjustments.blur || 0}</span>
                      </div>
                      <div className="relative h-4 flex items-center group/slider">
                        <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                        <div
                          className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                          style={{
                            left:  '0%',
                            width: `${reg.adjustments.blur || 0}%`,
                            background: `rgb(var(--color-primary) / ${reg.adjustments.blur !== 0 ? 0.8 : 0.2})`,
                            boxShadow: reg.adjustments.blur !== 0 ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
                          }}
                        />
                        <input
                          type="range" min="0" max="100"
                          value={reg.adjustments.blur || 0}
                          onChange={(e) => handleRegionChange(reg.id, 'blur', Number(e.target.value))}
                          className="adjustment-slider slider-thumb-premium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-white/5">
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <div className="flex gap-2 items-start">
            <Sparkles size={12} className="text-primary mt-0.5" />
            <p className="text-[10px] text-white/40 leading-relaxed">
              Selective editing allows you to enhance specific parts of your photo independently using AI masks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
