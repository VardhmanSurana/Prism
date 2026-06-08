import React, { useCallback, useState, useMemo } from 'react';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { API_BASE, resolveUrl } from '../../constants';

interface BackgroundPanelProps {
  photoId?: number | string;
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ photoId, adjustments, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);

  const regionId = photoId ? `background-${photoId}` : null;

  // Derive hasMask from adjustments.regions so the panel survives remounts
  // (e.g. when the user switches tools and returns). The local useState version
  // reset on remount and briefly flashed the unmasked UI.
  const region = useMemo(
    () => (regionId ? adjustments.regions.find(r => r.id === regionId) : undefined),
    [adjustments.regions, regionId],
  );
  const hasMask = !!region;

  const handleGenerateMask = async () => {
    if (!photoId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/background-mask/${encodeURIComponent(String(photoId))}`);
      if (res.ok) {
        const data = await res.json();
        const id = `background-${photoId}`;

        const newRegions = [...(adjustments.regions || [])];
        if (!newRegions.find(r => r.id === id)) {
          newRegions.push({
            id,
            type: 'background',
            maskUrl: resolveUrl(data.mask_url),
            adjustments: {
              blur: 0,
              brightness: 0,
              saturation: 0
            }
          });
          onChange({ ...adjustments, regions: newRegions });
        }
      }
    } catch (e) {
      console.error("Failed to fetch background mask", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegionChange = useCallback((key: string, value: number) => {
    if (!regionId) return;
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
  }, [adjustments, regionId, onChange]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Background Editor</h3>
      </div>

      {!hasMask ? (
        <div className="space-y-4 py-4">
          <p className="text-[11px] text-white/40 leading-relaxed">
            AI can separate your subject from the background, allowing you to add depth-of-field blur or adjust background lighting.
          </p>
          <button
            onClick={handleGenerateMask}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-xs font-bold transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Separate Background
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Background Blur */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-[11px] text-white/55 font-medium tracking-tight">Background Blur</label>
              <span className="text-[10px] tabular-nums text-primary font-bold">
                {region?.adjustments.blur || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={region?.adjustments.blur || 0}
              onChange={(e) => handleRegionChange('blur', Number(e.target.value))}
              className="adjustment-slider"
            />
            <p className="text-[9px] text-white/20 italic">Simulates a wide-aperture lens (Bokeh).</p>
          </div>

          {/* Background Exposure */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-[11px] text-white/55 font-medium tracking-tight">Background Brightness</label>
              <span className="text-[10px] tabular-nums text-primary font-bold">
                {region?.adjustments.brightness || 0}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={region?.adjustments.brightness || 0}
              onChange={(e) => handleRegionChange('brightness', Number(e.target.value))}
              className="adjustment-slider"
            />
            <p className="text-[9px] text-white/20 italic">Dim the background to make the subject pop.</p>
          </div>

          {/* Background Saturation */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-[11px] text-white/55 font-medium tracking-tight">Background Saturation</label>
              <span className="text-[10px] tabular-nums text-primary font-bold">
                {region?.adjustments.saturation || 0}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={region?.adjustments.saturation || 0}
              onChange={(e) => handleRegionChange('saturation', Number(e.target.value))}
              className="adjustment-slider"
            />
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-white/5">
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <div className="flex gap-2 items-start">
            <Sparkles size={12} className="text-primary mt-0.5" />
            <p className="text-[10px] text-white/40 leading-relaxed">
              Use this tool to create professional depth effects and cinematic lighting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
