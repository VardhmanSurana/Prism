import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Smile,
  Eye,
  Sun,
  RotateCcw,
  Users,
  User,
} from 'lucide-react';
import {
  Adjustments,
  PortraitAdjustments,
  SingleFaceAdjustments,
  DEFAULT_PORTRAIT_ADJUSTMENTS,
  DEFAULT_SINGLE_FACE_ADJUSTMENTS,
} from './filterEngine';
import { API_BASE, resolveUrl } from '@/constants';
import { EditorSlider } from './ui/EditorSlider';

interface FaceMaskData {
  id: string;
  box?: [number, number, number, number];
  masks: Record<string, string>;
}

interface PortraitPanelProps {
  photoId?: number | string;
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
  selectedFaceIndex?: number | null;
  onSelectFace?: (index: number) => void;
}

type PortraitTab = 'skin' | 'eyes' | 'mouth';

export const PortraitPanel: React.FC<PortraitPanelProps> = ({
  photoId,
  adjustments,
  onChange,
  selectedFaceIndex,
  onSelectFace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<FaceMaskData[]>([]);
  const [activeTab, setActiveTab] = useState<PortraitTab>('skin');

  const currentPortrait: PortraitAdjustments = adjustments.portrait || {
    ...DEFAULT_PORTRAIT_ADJUSTMENTS,
  };

  // Determine active target face ID ('all' or 'face_0', 'face_1', etc.)
  const targetFaceId: string =
    typeof selectedFaceIndex === 'number' && detectedFaces[selectedFaceIndex]
      ? detectedFaces[selectedFaceIndex].id
      : currentPortrait.selectedFaceId || 'all';

  const targetOverride = targetFaceId !== 'all' ? currentPortrait.faces?.[targetFaceId] : null;

  const activeFaceAdj = {
    skinSmoothing: targetOverride?.skinSmoothing ?? currentPortrait.skinSmoothing ?? 0,
    skinTexture: targetOverride?.skinTexture ?? currentPortrait.skinTexture ?? 75,
    skinBrightness: targetOverride?.skinBrightness ?? currentPortrait.skinBrightness ?? 0,
    skinWarmth: targetOverride?.skinWarmth ?? currentPortrait.skinWarmth ?? 0,
    skinTone: targetOverride?.skinTone ?? currentPortrait.skinTone ?? 0,
    realTone: targetOverride?.realTone ?? currentPortrait.realTone ?? 0,
    eyeWhitening: targetOverride?.eyeWhitening ?? currentPortrait.eyeWhitening ?? 0,
    eyeEnhance: targetOverride?.eyeEnhance ?? currentPortrait.eyeEnhance ?? 0,
    eyeCatchlight: targetOverride?.eyeCatchlight ?? currentPortrait.eyeCatchlight ?? 0,
    teethWhitening: targetOverride?.teethWhitening ?? currentPortrait.teethWhitening ?? 0,
    lipVibrance: targetOverride?.lipVibrance ?? currentPortrait.lipVibrance ?? 0,
    eyebrowEnhance: targetOverride?.eyebrowEnhance ?? currentPortrait.eyebrowEnhance ?? 0,
    masks: targetOverride?.masks || currentPortrait.masks,
    box: targetOverride?.box,
  };

  // Fetch AI Portrait Masks from Backend for all faces
  const fetchPortraitMasks = useCallback(async () => {
    if (!photoId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/portrait-masks/${photoId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.faces) && data.faces.length > 0) {
          setDetectedFaces(data.faces);

          // Build multi-face masks object preserving any user overrides
          const multiFaces: Record<string, SingleFaceAdjustments> = { ...(currentPortrait.faces || {}) };
          const vTag = Date.now();
          const resolveWithBuster = (url?: string) => url ? `${resolveUrl(url)}?v=${vTag}` : undefined;

          data.faces.forEach((face: FaceMaskData, idx: number) => {
            const rawMasks = face.masks || {};
            const resolvedMasks = {
              skin: resolveWithBuster(rawMasks.skin),
              eyes: resolveWithBuster(rawMasks.eyes),
              lips: resolveWithBuster(rawMasks.lips),
              teeth: resolveWithBuster(rawMasks.teeth || rawMasks.mouth),
              eyebrows: resolveWithBuster(rawMasks.eyebrows),
            };

            const existing = currentPortrait.faces?.[face.id];

            multiFaces[face.id] = {
              ...(existing || {}),
              masks: resolvedMasks,
              box: face.box,
            };
          });

          const primaryMasks = data.faces[0]?.masks || {};
          const primaryResolved = {
            skin: resolveWithBuster(primaryMasks.skin),
            eyes: resolveWithBuster(primaryMasks.eyes),
            lips: resolveWithBuster(primaryMasks.lips),
            teeth: resolveWithBuster(primaryMasks.teeth || primaryMasks.mouth),
            eyebrows: resolveWithBuster(primaryMasks.eyebrows),
          };

          onChange({
            ...adjustments,
            portrait: {
              ...currentPortrait,
              masks: primaryResolved,
              faces: multiFaces,
            },
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch AI portrait masks', e);
    } finally {
      setIsLoading(false);
    }
  }, [photoId, currentPortrait, adjustments, onChange]);

  useEffect(() => {
    fetchPortraitMasks();
  }, [photoId]);

  // Handle selecting a target face
  const handleSelectTarget = (id: string, index: number | null) => {
    if (index !== null) {
      onSelectFace?.(index);
    }
    onChange({
      ...adjustments,
      portrait: {
        ...currentPortrait,
        selectedFaceId: id,
      },
    });
  };

  // Update specific portrait parameter for active target (All Faces or Individual Face)
  const updateParam = useCallback(
    (key: keyof SingleFaceAdjustments, value: number) => {
      if (targetFaceId === 'all') {
        // Global / Batch update across all faces
        onChange({
          ...adjustments,
          portrait: {
            ...currentPortrait,
            [key]: value,
          },
        });
      } else {
        // Targeted update for individual selected face
        const updatedFaces = { ...(currentPortrait.faces || {}) };
        const existingFace = updatedFaces[targetFaceId] || {};

        updatedFaces[targetFaceId] = {
          ...existingFace,
          [key]: value,
        };

        onChange({
          ...adjustments,
          portrait: {
            ...currentPortrait,
            faces: updatedFaces,
          },
        });
      }
    },
    [adjustments, currentPortrait, targetFaceId, onChange]
  );

  // Apply Quick Portrait Style Presets
  const applyPreset = (preset: 'natural' | 'fresh' | 'studio' | 'smooth' | 'glamour' | 'reset') => {
    const presets: Record<string, Partial<SingleFaceAdjustments>> = {
      natural: {
        skinSmoothing: 35,
        skinTexture: 85,
        realTone: 25,
        skinBrightness: 6,
        skinWarmth: 5,
        skinTone: 2,
        eyeWhitening: 25,
        eyeEnhance: 20,
        eyeCatchlight: 20,
        teethWhitening: 25,
        lipVibrance: 12,
        eyebrowEnhance: 15,
      },
      fresh: {
        skinSmoothing: 45,
        skinTexture: 80,
        realTone: 35,
        skinBrightness: 12,
        skinWarmth: -3,
        skinTone: 4,
        eyeWhitening: 40,
        eyeEnhance: 30,
        eyeCatchlight: 35,
        teethWhitening: 35,
        lipVibrance: 18,
        eyebrowEnhance: 20,
      },
      studio: {
        skinSmoothing: 50,
        skinTexture: 85,
        realTone: 45,
        skinBrightness: 8,
        skinWarmth: 4,
        skinTone: 0,
        eyeWhitening: 35,
        eyeEnhance: 35,
        eyeCatchlight: 40,
        teethWhitening: 35,
        lipVibrance: 16,
        eyebrowEnhance: 25,
      },
      smooth: {
        skinSmoothing: 70,
        skinTexture: 50,
        realTone: 30,
        skinBrightness: 10,
        skinWarmth: 6,
        skinTone: 0,
        eyeWhitening: 30,
        eyeEnhance: 25,
        eyeCatchlight: 25,
        teethWhitening: 30,
        lipVibrance: 15,
        eyebrowEnhance: 25,
      },
      glamour: {
        skinSmoothing: 65,
        skinTexture: 65,
        realTone: 40,
        skinBrightness: 16,
        skinWarmth: 10,
        skinTone: 6,
        eyeWhitening: 45,
        eyeEnhance: 40,
        eyeCatchlight: 45,
        teethWhitening: 45,
        lipVibrance: 28,
        eyebrowEnhance: 35,
      },
    };

    if (preset === 'reset') {
      if (targetFaceId === 'all') {
        onChange({
          ...adjustments,
          portrait: {
            ...DEFAULT_PORTRAIT_ADJUSTMENTS,
            masks: currentPortrait.masks,
            faces: currentPortrait.faces,
          },
        });
      } else {
        const updatedFaces = { ...(currentPortrait.faces || {}) };
        if (updatedFaces[targetFaceId]) {
          updatedFaces[targetFaceId] = {
            ...DEFAULT_SINGLE_FACE_ADJUSTMENTS,
            masks: updatedFaces[targetFaceId].masks,
            box: updatedFaces[targetFaceId].box,
          };
        }
        onChange({
          ...adjustments,
          portrait: {
            ...currentPortrait,
            faces: updatedFaces,
          },
        });
      }
      return;
    }

    const values = presets[preset] || {};

    if (targetFaceId === 'all') {
      onChange({
        ...adjustments,
        portrait: {
          ...currentPortrait,
          ...values,
        },
      });
    } else {
      const updatedFaces = { ...(currentPortrait.faces || {}) };
      const existingFace = updatedFaces[targetFaceId] || { ...DEFAULT_SINGLE_FACE_ADJUSTMENTS };
      updatedFaces[targetFaceId] = {
        ...existingFace,
        ...values,
      };
      onChange({
        ...adjustments,
        portrait: {
          ...currentPortrait,
          faces: updatedFaces,
        },
      });
    }
  };

  const isModified =
    activeFaceAdj.skinSmoothing !== 0 ||
    activeFaceAdj.skinTexture !== 75 ||
    activeFaceAdj.realTone !== 0 ||
    activeFaceAdj.skinBrightness !== 0 ||
    activeFaceAdj.skinWarmth !== 0 ||
    activeFaceAdj.skinTone !== 0 ||
    activeFaceAdj.eyeWhitening !== 0 ||
    activeFaceAdj.eyeEnhance !== 0 ||
    activeFaceAdj.eyeCatchlight !== 0 ||
    activeFaceAdj.teethWhitening !== 0 ||
    activeFaceAdj.lipVibrance !== 0 ||
    activeFaceAdj.eyebrowEnhance !== 0;

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] p-4 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FCBC00]">
            <Sparkles size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Portrait Studio</h3>
            <p className="text-[10px] text-white/40">
              {detectedFaces.length > 1
                ? `${detectedFaces.length} Faces Detected — Multi-Target Editing`
                : 'AI-powered facial feature retouching'}
            </p>
          </div>
        </div>

        {isModified && (
          <button
            onClick={() => applyPreset('reset')}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/50 hover:text-white hover:bg-white/5 transition-all"
            title="Reset active portrait sliders"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* ── Status / Loading ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-white/40 space-y-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <Loader2 size={24} className="animate-spin text-[#FCBC00]" />
          <p className="text-[11px] font-medium tracking-wide">Segmenting Facial Features with AI...</p>
          <span className="text-[9px] text-white/30">Extracting skin, eyes, lips, and teeth contours</span>
        </div>
      ) : detectedFaces.length === 0 ? (
        <div className="text-center py-10 px-4 bg-white/[0.02] border border-white/5 rounded-xl text-white/40 space-y-2">
          <Smile size={28} className="mx-auto text-white/20" />
          <p className="text-xs font-medium text-white/70">No Faces Detected</p>
          <p className="text-[11px] text-white/30 leading-relaxed">
            AI did not detect a clear frontal face in this photo. Ensure the subject is well-lit.
          </p>
        </div>
      ) : (
        <>
          {/* ── Multi-Face Target Selector Bar ── */}
          {detectedFaces.length > 1 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Target Person</span>
                <span className="text-[9px] text-white/30">Click on face in photo or select below</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5 overflow-x-auto custom-scrollbar">
                <button
                  onClick={() => handleSelectTarget('all', null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                    targetFaceId === 'all'
                      ? 'bg-[#FCBC00] text-black font-semibold shadow'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users size={12} />
                  <span>All Faces</span>
                </button>

                {detectedFaces.map((face, index) => {
                  const isSelected = targetFaceId === face.id;
                  const hasCustom = !!currentPortrait.faces?.[face.id] && (
                    currentPortrait.faces[face.id].skinSmoothing !== 0 ||
                    currentPortrait.faces[face.id].skinBrightness !== 0 ||
                    currentPortrait.faces[face.id].teethWhitening !== 0 ||
                    currentPortrait.faces[face.id].eyeWhitening !== 0
                  );

                  return (
                    <button
                      key={face.id}
                      onClick={() => handleSelectTarget(face.id, index)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 relative ${
                        isSelected
                          ? 'bg-[#FCBC00] text-black font-semibold shadow'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <User size={12} />
                      <span>Face {index + 1}</span>
                      {hasCustom && !isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Custom retouches applied" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quick Style Presets ── */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Quick Looks</span>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'natural', label: 'Natural' },
                  { id: 'fresh', label: 'Fresh' },
                  { id: 'studio', label: 'Studio' },
                  { id: 'smooth', label: 'Smooth' },
                  { id: 'glamour', label: 'Glamour' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="px-1.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] hover:text-[#FCBC00] border border-white/5 text-white/80 transition-all text-center truncate"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Feature Sub-Tabs ── */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-white/[0.03] border border-white/5">
            <button
              onClick={() => setActiveTab('skin')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === 'skin'
                  ? 'bg-[#FCBC00] text-black shadow font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sun size={12} />
              <span>Skin</span>
            </button>
            <button
              onClick={() => setActiveTab('eyes')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === 'eyes'
                  ? 'bg-[#FCBC00] text-black shadow font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Eye size={12} />
              <span>Eyes</span>
            </button>
            <button
              onClick={() => setActiveTab('mouth')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === 'mouth'
                  ? 'bg-[#FCBC00] text-black shadow font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Smile size={12} />
              <span>Mouth</span>
            </button>
          </div>

          {/* ── Tab Content: Skin Studio ── */}
          {activeTab === 'skin' && (
            <div className="space-y-3.5 pt-1">
              <EditorSlider
                label="Skin Smoothing"
                value={activeFaceAdj.skinSmoothing}
                onChange={val => updateParam('skinSmoothing', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Pore Texture Detail"
                value={activeFaceAdj.skinTexture}
                onChange={val => updateParam('skinTexture', val)}
                min={0}
                max={100}
                defaultValue={75}
                unit="%"
              />

              <EditorSlider
                label="Real Tone Balance"
                value={activeFaceAdj.realTone}
                onChange={val => updateParam('realTone', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Skin Brightness"
                value={activeFaceAdj.skinBrightness}
                onChange={val => updateParam('skinBrightness', val)}
                min={-50}
                max={50}
                defaultValue={0}
                bipolar
              />

              <EditorSlider
                label="Skin Warmth"
                value={activeFaceAdj.skinWarmth}
                onChange={val => updateParam('skinWarmth', val)}
                min={-50}
                max={50}
                defaultValue={0}
                bipolar
              />

              <EditorSlider
                label="Skin Tint (Magenta / Green)"
                value={activeFaceAdj.skinTone}
                onChange={val => updateParam('skinTone', val)}
                min={-50}
                max={50}
                defaultValue={0}
                bipolar
              />
            </div>
          )}

          {/* ── Tab Content: Eyes & Brows ── */}
          {activeTab === 'eyes' && (
            <div className="space-y-3.5 pt-1">
              <EditorSlider
                label="Eye Whitening"
                value={activeFaceAdj.eyeWhitening}
                onChange={val => updateParam('eyeWhitening', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Iris Clarity & Contrast"
                value={activeFaceAdj.eyeEnhance}
                onChange={val => updateParam('eyeEnhance', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Iris Catchlight Sparkle"
                value={activeFaceAdj.eyeCatchlight}
                onChange={val => updateParam('eyeCatchlight', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Eyebrow Definition"
                value={activeFaceAdj.eyebrowEnhance}
                onChange={val => updateParam('eyebrowEnhance', val)}
                min={0}
                max={100}
                defaultValue={0}
              />
            </div>
          )}

          {/* ── Tab Content: Mouth & Smile ── */}
          {activeTab === 'mouth' && (
            <div className="space-y-3.5 pt-1">
              <EditorSlider
                label="Teeth Whitening"
                value={activeFaceAdj.teethWhitening}
                onChange={val => updateParam('teethWhitening', val)}
                min={0}
                max={100}
                defaultValue={0}
              />

              <EditorSlider
                label="Lip Vibrance & Color"
                value={activeFaceAdj.lipVibrance}
                onChange={val => updateParam('lipVibrance', val)}
                min={-50}
                max={50}
                defaultValue={0}
                bipolar
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
