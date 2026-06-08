import React, { useState, useEffect, useCallback } from 'react';
import { User, Loader2, Sparkles } from 'lucide-react';
import { Adjustments, RegionalAdjustment } from './filterEngine';
import { API_BASE, resolveUrl } from '../../constants';

interface FaceData {
  id: string;
  bounding_box: { x: number; y: number; width: number; height: number };
  confidence: number;
  thumbnail?: string;
  masks: {
    skin: string;
  };
}

interface PortraitPanelProps {
  photoId?: number | string;
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const PortraitPanel: React.FC<PortraitPanelProps> = ({ photoId, adjustments, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [faces, setFaces] = useState<FaceData[]>([]);

  useEffect(() => {
    setFaces([]);
  }, [photoId]);

  const fetchFaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/portrait-masks/${photoId}`);
      if (res.ok) {
        const data = await res.json();
        setFaces(data.faces);
        
        // Automatically add regions if not present
        if (data.faces.length > 0) {
          const newRegions: RegionalAdjustment[] = [...(adjustments.regions || [])];
          let changed = false;

          data.faces.forEach((face: FaceData, index: number) => {
            const regionId = `face-${photoId}-${index}-skin`;
            if (!newRegions.find(r => r.id === regionId)) {
              newRegions.push({
                id: regionId,
                type: 'face',
                maskUrl: resolveUrl(face.masks.skin),
                adjustments: {
                  brightness: 0,
                  blur: 0,
                  sharpness: 0,
                  saturation: 0
                }
              });
              changed = true;
            }
          });

          if (changed) {
            onChange({ ...adjustments, regions: newRegions });
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch portrait masks", e);
    } finally {
      setIsLoading(false);
    }
  }, [photoId]);

  useEffect(() => {
    if (photoId) {
      fetchFaces();
    }
  }, [photoId, fetchFaces]);

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
        <User size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Portrait Enhancer</h3>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-white/30 space-y-3">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-[10px] uppercase font-medium">Analyzing Faces...</p>
        </div>
      ) : faces.length === 0 ? (
        <div className="text-center py-10 text-white/20">
          <p className="text-xs">No faces detected in this photo.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {faces.map((face, i) => {
            const regionId = `face-${photoId}-${i}-skin`;
            const region = adjustments.regions.find(r => r.id === regionId);
            if (!region) return null;

            return (
              <div key={face.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase">Face {i + 1}</span>
                </div>

                {/* Skin Smoothing (Blur) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <label className="text-[11px] text-white/55">Skin Smoothing</label>
                    <span className="text-[10px] tabular-nums text-primary">
                      {region.adjustments.blur || 0}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={region.adjustments.blur || 0}
                    onChange={(e) => handleRegionChange(regionId, 'blur', Number(e.target.value))}
                    className="adjustment-slider"
                  />
                </div>

                {/* Face Brightness */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <label className="text-[11px] text-white/55">Face Brightness</label>
                    <span className="text-[10px] tabular-nums text-primary">
                      {region.adjustments.brightness || 0}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={region.adjustments.brightness || 0}
                    onChange={(e) => handleRegionChange(regionId, 'brightness', Number(e.target.value))}
                    className="adjustment-slider"
                  />
                </div>

                {/* Face Glow (Saturation) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <label className="text-[11px] text-white/55">Skin Vibrance</label>
                    <span className="text-[10px] tabular-nums text-primary">
                      {region.adjustments.saturation || 0}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={region.adjustments.saturation || 0}
                    onChange={(e) => handleRegionChange(regionId, 'saturation', Number(e.target.value))}
                    className="adjustment-slider"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-white/5">
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <div className="flex gap-2 items-start">
            <Sparkles size={12} className="text-primary mt-0.5" />
            <p className="text-[10px] text-white/40 leading-relaxed">
              AI automatically isolates skin tones for non-destructive smoothing and relighting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
