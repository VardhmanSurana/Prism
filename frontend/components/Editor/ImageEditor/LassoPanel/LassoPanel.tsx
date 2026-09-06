/**
 * LassoPanel.tsx
 * Professional Lasso Selection & Refine Edge Studio control panel for Prism.
 * Matches the unified Image Editor aesthetic (Camera RAW / Adjust studio design system).
 */

import React, { useState } from 'react';
import {
  DEFAULT_LASSO_STATE,
  DEFAULT_REFINE_SETTINGS,
  Point2D,
  RefineEdgeSettings,
  MagneticSettings,
  createSelectAllMask,
  invertMask,
  applyRefineEdgeToMask,
  generateScaledMaskCanvas,
  convertMaskToTransparentAlpha,
} from '../lassoEngine';
import { loadCanvasImage } from '../utils/imageUtils';
import {
  RotateCcw,
  Undo2,
  SlidersHorizontal,
  Eye,
  Scissors,
  ChevronDown,
  Info,
} from 'lucide-react';
import { LassoPanelProps } from './types';
import { LassoToolSelection } from './LassoToolSelection';
import { LassoRefineSection } from './LassoRefineSection';
import { LassoPreviewSection } from './LassoPreviewSection';
import { LassoActionsSection } from './LassoActionsSection';
import { LassoShortcutsGuide } from './LassoShortcutsGuide';

export const LassoPanel: React.FC<LassoPanelProps> = ({
  state = DEFAULT_LASSO_STATE,
  onChange,
  adjustments,
  onAdjustmentsChange,
  onConvertToInpaintMask,
  canvasWidth = 1920,
  canvasHeight = 1080,
  naturalWidth,
  naturalHeight,
  onAddHistoryEntry,
}) => {
  const [openSections, setOpenSections] = useState({
    tools: true,
    refine: true,
    preview: true,
    shortcuts: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const update = (patch: Partial<typeof state>) => onChange({ ...state, ...patch });

  const updateRefine = (patch: Partial<RefineEdgeSettings>) => {
    onChange({
      ...state,
      refine: { ...state.refine, ...patch },
    });
  };

  const updateMagnetic = (patch: Partial<MagneticSettings>) => {
    onChange({
      ...state,
      magnetic: { ...state.magnetic, ...patch },
    });
  };

  const handleUndoLast = () => {
    if (state.points.length > 0) {
      onChange({
        ...state,
        points: state.points.slice(0, -1),
        liveWirePath: [],
      });
    }
  };

  const handleClear = () => {
    onChange({
      ...state,
      points: [],
      liveWirePath: [],
      closedPaths: [],
      isClosed: false,
      hasActiveMask: false,
      activeMaskDataUrl: null,
    });
  };

  const handleSelectAll = () => {
    const all = createSelectAllMask(canvasWidth, canvasHeight);
    const refined = applyRefineEdgeToMask(all, state.refine);
    const allBox: Point2D[] = [
      { x: 1, y: 1 },
      { x: canvasWidth - 1, y: 1 },
      { x: canvasWidth - 1, y: canvasHeight - 1 },
      { x: 1, y: canvasHeight - 1 },
    ];
    onChange({
      ...state,
      points: [],
      liveWirePath: [],
      closedPaths: [allBox],
      hasActiveMask: true,
      activeMaskDataUrl: refined.toDataURL('image/png'),
    });
  };

  const handleInvert = () => {
    if (state.activeMaskDataUrl) {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = canvasWidth;
        c.height = canvasHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          const inverted = invertMask(c);
          const refined = applyRefineEdgeToMask(inverted, state.refine);
          onChange({
            ...state,
            hasActiveMask: true,
            activeMaskDataUrl: refined.toDataURL('image/png'),
          });
        }
      };
      img.src = state.activeMaskDataUrl;
    }
  };

  const getEffectiveHighResMaskUrl = async (forInpaint: boolean = false): Promise<string | null> => {
    const targetW = naturalWidth && naturalWidth > 0 ? naturalWidth : canvasWidth;
    const targetH = naturalHeight && naturalHeight > 0 ? naturalHeight : canvasHeight;

    let existingCanvas: HTMLCanvasElement | null = null;
    let sourceW = canvasWidth;
    let sourceH = canvasHeight;

    if (state.activeMaskDataUrl) {
      try {
        const img = await loadCanvasImage(state.activeMaskDataUrl);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          sourceW = img.naturalWidth;
          sourceH = img.naturalHeight;
          const c = document.createElement('canvas');
          c.width = sourceW;
          c.height = sourceH;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            existingCanvas = c;
          }
        }
      } catch (err) {
        console.warn('Failed to load activeMaskDataUrl in getEffectiveHighResMaskUrl:', err);
      }
    }

    const scaledMask = generateScaledMaskCanvas(
      state.points,
      state.closedPaths,
      existingCanvas,
      sourceW,
      sourceH,
      targetW,
      targetH,
    );

    const refined = applyRefineEdgeToMask(scaledMask, state.refine);

    if (forInpaint) {
      // Magic Eraser inpaint requires transparent background (alpha = 0) and solid white mask (alpha = 255)
      const transparentMask = convertMaskToTransparentAlpha(refined);
      return transparentMask.toDataURL('image/png');
    }

    return refined.toDataURL('image/png');
  };

  const handleRemoveBackground = async () => {
    const maskUrl = await getEffectiveHighResMaskUrl(false);
    if (!maskUrl) return;

    onAdjustmentsChange({
      ...adjustments,
      background: {
        ...(adjustments.background || {
          modelId: 'lasso-cutout',
          backdropColor: '#ffffff',
          blurRadius: 20,
          customImageSrc: null,
          invertMask: false,
        }),
        enabled: true,
        mode: 'remove_bg',
        backdrop: adjustments.background?.backdrop || 'transparent',
        maskUrl,
        refine: { ...DEFAULT_REFINE_SETTINGS },
      },
    });

    onAddHistoryEntry?.('lasso', 'Lasso: Remove Background');
  };

  const handleRemoveObject = async () => {
    const maskUrl = await getEffectiveHighResMaskUrl(false);
    if (!maskUrl) return;

    onAdjustmentsChange({
      ...adjustments,
      background: {
        ...(adjustments.background || {
          modelId: 'lasso-cutout',
          backdropColor: '#ffffff',
          blurRadius: 20,
          customImageSrc: null,
          invertMask: false,
        }),
        enabled: true,
        mode: 'keep_bg',
        backdrop: adjustments.background?.backdrop || 'transparent',
        maskUrl,
        refine: { ...DEFAULT_REFINE_SETTINGS },
      },
    });

    onAddHistoryEntry?.('lasso', 'Lasso: Remove Object');
  };

  const handleConvertToInpaint = async () => {
    const maskUrl = await getEffectiveHighResMaskUrl(true);
    if (maskUrl) {
      onConvertToInpaintMask?.(maskUrl);
    }
  };

  const isChanged =
    state.hasActiveMask ||
    state.points.length > 0 ||
    state.refine.feather !== DEFAULT_LASSO_STATE.refine.feather ||
    state.refine.smooth !== DEFAULT_LASSO_STATE.refine.smooth ||
    state.refine.shiftEdge !== DEFAULT_LASSO_STATE.refine.shiftEdge ||
    state.refine.contrast !== DEFAULT_LASSO_STATE.refine.contrast;

  const hasValidSelection = state.hasActiveMask || state.points.length >= 3;

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white p-4 space-y-4 select-none">
      {/* ── Sub-header & Reset ── */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Selection & Mask Studio
        </span>

        <div className="flex items-center gap-1.5">
          {state.points.length > 0 && state.type !== 'freehand' && (
            <button
              onClick={handleUndoLast}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
              title="Undo Last Anchor Point"
            >
              <Undo2 size={10} />
              Undo
            </button>
          )}

          {isChanged && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-semibold transition-all cursor-pointer"
              title="Clear active selection"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── 1. Selection Tool & Boolean Mode Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('tools')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Scissors size={11} className="text-primary" />
            <span>Selection Tool</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.tools ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.tools && (
          <LassoToolSelection
            state={state}
            update={update}
            updateMagnetic={updateMagnetic}
          />
        )}
      </div>

      {/* ── 2. Refine Edge & Mask Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('refine')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <SlidersHorizontal size={11} className="text-primary" />
            <span>Refine Edge & Mask</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.refine ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.refine && (
          <LassoRefineSection
            state={state}
            updateRefine={updateRefine}
          />
        )}
      </div>

      {/* ── 3. Mask Preview Mode & Quick Actions Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
        <div
          onClick={() => toggleSection('preview')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
            <Eye size={11} className="text-primary" />
            <span>Mask Preview Mode</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.preview ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.preview && (
          <LassoPreviewSection
            state={state}
            update={update}
            handleSelectAll={handleSelectAll}
            handleInvert={handleInvert}
          />
        )}
      </div>

      {/* ── 4. Apply Selection Action Buttons ── */}
      <LassoActionsSection
        hasValidSelection={hasValidSelection}
        onRemoveBackground={handleRemoveBackground}
        onRemoveObject={handleRemoveObject}
        onConvertToInpaint={handleConvertToInpaint}
      />

      {/* ── 5. Keyboard Shortcuts Card ── */}
      <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-2">
        <div
          onClick={() => toggleSection('shortcuts')}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 group-hover:text-white/80">
            <Info size={11} className="text-primary" />
            <span>Shortcuts Guide</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-white/30 transition-transform duration-150 ${
              openSections.shortcuts ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>

        {openSections.shortcuts && <LassoShortcutsGuide />}
      </div>
    </div>
  );
};

