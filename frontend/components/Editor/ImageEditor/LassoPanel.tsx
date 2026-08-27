/**
 * LassoPanel.tsx
 * Professional Lasso Selection & Refine Edge Studio control panel for Prism.
 * Matches the unified Image Editor aesthetic (Camera RAW / Adjust studio design system).
 */

import React, { useState } from 'react';
import {
  LassoState,
  DEFAULT_LASSO_STATE,
  LassoType,
  LassoOperation,
  Point2D,
  MaskPreviewMode,
  RefineEdgeSettings,
  MagneticSettings,
  createSelectAllMask,
  invertMask,
  applyRefineEdgeToMask,
  renderPolygonToMask,
} from './lassoEngine';
import {
  MousePointer,
  Magnet,
  Pentagon,
  Layers,
  RotateCcw,
  Paintbrush,
  Undo2,
  SlidersHorizontal,
  Eye,
  Sparkles,
  Scissors,
  CheckCircle2,
  Minimize2,
  Maximize2,
  Plus,
  Minus,
  BoxSelect,
  ChevronDown,
  Info,
  Wand2,
} from 'lucide-react';
import { EditorSlider } from './ui/EditorSlider';
import { Adjustments } from './filterEngine';

interface LassoPanelProps {
  state: LassoState;
  onChange: (s: LassoState) => void;
  adjustments: Adjustments;
  onAdjustmentsChange: (adj: Adjustments) => void;
  onConvertToInpaintMask?: (maskUrl: string) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const LassoPanel: React.FC<LassoPanelProps> = ({
  state = DEFAULT_LASSO_STATE,
  onChange,
  adjustments,
  onAdjustmentsChange,
  onConvertToInpaintMask,
  canvasWidth = 1920,
  canvasHeight = 1080,
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

  const update = (patch: Partial<LassoState>) => onChange({ ...state, ...patch });

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

  const handleConvertToInpaint = () => {
    let maskUrl = state.activeMaskDataUrl;
    if (!maskUrl && state.points.length >= 3) {
      const maskCanvas = renderPolygonToMask(state.points, canvasWidth, canvasHeight);
      const refined = applyRefineEdgeToMask(maskCanvas, state.refine);
      maskUrl = refined.toDataURL('image/png');
    }
    if (maskUrl) {
      onConvertToInpaintMask?.(maskUrl);
      handleClear();
    }
  };

  const isChanged =
    state.hasActiveMask ||
    state.points.length > 0 ||
    state.refine.feather !== DEFAULT_LASSO_STATE.refine.feather ||
    state.refine.smooth !== DEFAULT_LASSO_STATE.refine.smooth ||
    state.refine.shiftEdge !== DEFAULT_LASSO_STATE.refine.shiftEdge ||
    state.refine.contrast !== DEFAULT_LASSO_STATE.refine.contrast;

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
          <div className="space-y-3 pt-1">
            {/* Tool Type Selector Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'freehand', label: 'Freehand', icon: <MousePointer size={11} /> },
                  { id: 'polygonal', label: 'Polygonal', icon: <Pentagon size={11} /> },
                  { id: 'magnetic', label: 'Snapping', icon: <Magnet size={11} /> },
                ] as const
              ).map(tool => {
                const isSelected = state.type === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() =>
                      update({ type: tool.id as LassoType, points: [], liveWirePath: [], isClosed: false })
                    }
                    className={`editor-btn editor-chip-btn ${
                      isSelected ? 'active' : ''
                    } py-2 px-1 text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1`}
                  >
                    {tool.icon}
                    <span className="truncate">{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Magnetic Intelligent Scissors Fine-Tuning */}
            {state.type === 'magnetic' && (
              <div className="bg-black/30 p-2.5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex items-center gap-1 text-[9px] font-bold text-primary uppercase tracking-wider">
                  <Sparkles size={10} /> Edge Snapping Settings
                </div>

                <EditorSlider
                  label="Edge Sensitivity"
                  value={state.magnetic.sensitivity}
                  onChange={val => updateMagnetic({ sensitivity: val })}
                  min={10}
                  max={100}
                  defaultValue={50}
                  unit="%"
                />

                <EditorSlider
                  label="Snap Radius"
                  value={state.magnetic.snapRadius}
                  onChange={val => updateMagnetic({ snapRadius: val })}
                  min={5}
                  max={40}
                  defaultValue={15}
                  unit=" px"
                />
              </div>
            )}

            {/* Boolean Combination Modes */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block">
                Combine Mode
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'new', label: 'New', icon: <Minimize2 size={9} /> },
                    { id: 'add', label: 'Add', icon: <Plus size={9} /> },
                    { id: 'subtract', label: 'Sub', icon: <Minus size={9} /> },
                    { id: 'intersect', label: 'Intersect', icon: <BoxSelect size={9} /> },
                  ] as const
                ).map(mode => {
                  const isSelected = state.operation === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => update({ operation: mode.id as LassoOperation })}
                      className={`editor-btn editor-chip-btn ${
                        isSelected ? 'active' : ''
                      } py-1.5 px-1 font-bold text-[9px] uppercase flex items-center justify-center gap-1`}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
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
          <div className="space-y-3 pt-1">
            {/* Feather Slider */}
            <EditorSlider
              label="Feather Radius"
              value={state.refine.feather}
              onChange={val => updateRefine({ feather: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit=" px"
            />

            {/* Smooth Slider */}
            <EditorSlider
              label="Smooth Contour"
              value={state.refine.smooth}
              onChange={val => updateRefine({ smooth: val })}
              min={0}
              max={50}
              defaultValue={0}
              unit=" px"
            />

            {/* Shift Edge (Expand / Contract) */}
            <EditorSlider
              label="Shift Edge (Expand/Contract)"
              value={state.refine.shiftEdge}
              onChange={val => updateRefine({ shiftEdge: val })}
              min={-30}
              max={30}
              defaultValue={0}
              unit=" px"
              bipolar
            />

            {/* Mask Contrast */}
            <EditorSlider
              label="Mask Contrast"
              value={state.refine.contrast}
              onChange={val => updateRefine({ contrast: val })}
              min={0}
              max={100}
              defaultValue={0}
              unit="%"
            />
          </div>
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
          <div className="space-y-3 pt-1">
            {/* Preview Mode Selector Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'ants', label: 'Ants' },
                  { id: 'overlay', label: 'Rubylith' },
                  { id: 'bw', label: 'B & W' },
                ] as const
              ).map(p => {
                const isSelected = state.previewMode === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => update({ previewMode: p.id as MaskPreviewMode })}
                    className={`editor-btn editor-chip-btn ${
                      isSelected ? 'active' : ''
                    } py-1.5 px-2 text-[10px] font-bold uppercase`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions (Select All / Invert) */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={handleSelectAll}
                className="py-2 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Maximize2 size={11} /> Select All
              </button>
              <button
                onClick={handleInvert}
                disabled={!state.hasActiveMask}
                className="py-2 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 active:scale-[0.98]"
              >
                <CheckCircle2 size={11} /> Invert Mask
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Apply Selection Action Buttons ── */}
      <div className="space-y-2 pt-1">
        <button
          onClick={handleConvertToInpaint}
          disabled={!state.hasActiveMask && state.points.length < 3}
          className="w-full py-2.5 px-4 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-30 flex items-center justify-center gap-2"
        >
          <Wand2 size={13} />
          <span>Convert to Magic Eraser Mask</span>
        </button>
      </div>

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

        {openSections.shortcuts && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[9px] text-white/50 border-t border-white/5">
            <div><span className="text-white/80 font-medium">Enter:</span> Close Selection</div>
            <div><span className="text-white/80 font-medium">Esc:</span> Cancel Path</div>
            <div><span className="text-white/80 font-medium">Backspace:</span> Pop Anchor</div>
            <div><span className="text-white/80 font-medium">Space:</span> Pan Image</div>
            <div><span className="text-white/80 font-medium">Ctrl+A:</span> Select All</div>
            <div><span className="text-white/80 font-medium">Ctrl+D:</span> Deselect</div>
            <div><span className="text-white/80 font-medium">Ctrl+Shift+I:</span> Invert</div>
            <div><span className="text-white/80 font-medium">R-Click:</span> Pop Point</div>
          </div>
        )}
      </div>
    </div>
  );
};
