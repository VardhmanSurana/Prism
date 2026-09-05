/**
 * AnnotationsPanel.tsx
 * Main layout wrapper for the drawing sidebar panel. Coordinates sub-panels for drawing tools, colors, text properties, doodles, and layers.
 */

import React, { useMemo, useState } from 'react';
import { RotateCcw, ChevronDown, Pen, Palette, Square, Type, AlignLeft, Layers, Pipette, Plus, Sparkles, Info, CheckSquare, Trash2 } from 'lucide-react';
import { ColorPicker, ColorService, useColor } from 'react-color-palette';
import { Annotation, DrawToolId, DoodleLineStyle, LineTexture, LineTaper } from './types';
import { ToolsGrid } from './ToolsGrid';
import { ColorPickerSection } from './ColorPickerSection';
import { TextPropertiesSection } from './TextPropertiesSection';
import { DoodleSettingsSection } from './DoodleSettingsSection';
import { LayersListSection } from './LayersListSection';
import { PenSettingsSection } from './PenSettingsSection';
import { EmojiPicker } from '@/components/Editor/ImageEditor/EmojiPicker';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';
import { isBoundedShape } from '../AnnotationCanvas/shapeUtils';
import { DEFAULT_PEN_SETTINGS, PenSettings } from './types';

const TOOL_LABELS: Record<string, string> = {
  select: 'Select',
  freehand: 'Pen',
  arrow: 'Arrow',
  doubleArrow: 'Double Arrow',
  line: 'Line',
  rect: 'Rectangle',
  roundedRect: 'Rounded Rect',
  circle: 'Circle / Oval',
  triangle: 'Triangle',
  rightTriangle: 'Right Triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: '5-Point Star',
  fourPointStar: '4-Point Star',
  heart: 'Heart',
  lightning: 'Lightning',
  speechBubble: 'Speech Bubble',
  cloud: 'Cloud',
  highlighter: 'Highlight',
  text: 'Text',
  textPath: 'Text Doodle',
  eraser: 'Eraser',
};

const getToolLabel = (type: string) => TOOL_LABELS[type] || type;

export interface AnnotationsPanelProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: DrawToolId;
  setActiveDrawTool: (tool: DrawToolId) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  selectedAnnIds?: string[];
  setSelectedAnnIds?: (ids: string[]) => void;
  setActiveOpacity?: (opacity: number) => void;
  markStyleChanged?: () => void;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  
  // Text layer settings
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  fontSize?: number;
  setFontSize?: (size: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (w: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (s: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (val: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (val: number) => void;
  onUpdateTextProps?: (updatedProps: Partial<Annotation>) => void;

  // Text doodle settings
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;

  // Pen (freehand) settings
  penSettings?: PenSettings;
  setPenSettings?: (next: PenSettings) => void;
}

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({
  annotations,
  onChange,
  activeDrawTool,
  setActiveDrawTool,
  activeColor,
  setActiveColor,
  strokeWidth,
  setStrokeWidth,
  selectedAnnId,
  setSelectedAnnId,
  selectedAnnIds = [],
  setSelectedAnnIds,
  setActiveOpacity,
  markStyleChanged,
  
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  fontWeight,
  setWeight,
  fontStyle,
  setStyle,
  textDecoration,
  setDecoration,
  textAlign,
  setTextAlign,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  onUpdateTextProps,

  doodleText,
  setDoodleText,
  doodleFontSize,
  setDoodleFontSize,
  doodleFontFamily,
  setDoodleFontFamily,
  showDoodleGuide,
  setShowDoodleGuide,
  penSettings = DEFAULT_PEN_SETTINGS,
  setPenSettings,
  brushSize = 35,
  setBrushSize,
}) => {
  const isDefault = useMemo(() => annotations.length === 0, [annotations]);

  const effectiveSelectedIds = useMemo(() => {
    return selectedAnnIds.length > 0
      ? selectedAnnIds
      : (selectedAnnId ? [selectedAnnId] : []);
  }, [selectedAnnIds, selectedAnnId]);

  const selectedAnnotations = useMemo(() => {
    return annotations.filter(a => effectiveSelectedIds.includes(a.id));
  }, [annotations, effectiveSelectedIds]);

  const selectedAnn = useMemo(() => {
    return annotations.find(a => a.id === selectedAnnId) || selectedAnnotations[0] || null;
  }, [annotations, selectedAnnId, selectedAnnotations]);

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ann of annotations) {
      counts[ann.type] = (counts[ann.type] || 0) + 1;
    }
    return counts;
  }, [annotations]);

  const presentTypes = useMemo(() => {
    return Object.keys(countsByType);
  }, [countsByType]);

  const isAllSameType = useMemo(() => {
    if (selectedAnnotations.length === 0) return false;
    const first = selectedAnnotations[0].type;
    return selectedAnnotations.every(a => a.type === first);
  }, [selectedAnnotations]);

  const isAllBoundedShapes = useMemo(() => {
    if (selectedAnnotations.length === 0) return false;
    return selectedAnnotations.every(a => isBoundedShape(a.type));
  }, [selectedAnnotations]);

  const isAllFreehand = useMemo(() => {
    if (selectedAnnotations.length === 0) return false;
    return selectedAnnotations.every(a => a.type === 'freehand');
  }, [selectedAnnotations]);

  const isAllText = useMemo(() => {
    if (selectedAnnotations.length === 0) return false;
    return selectedAnnotations.every(a => a.type === 'text');
  }, [selectedAnnotations]);

  const isAllLines = useMemo(() => {
    if (selectedAnnotations.length === 0) return false;
    return selectedAnnotations.every(a => a.type === 'line' || a.type === 'arrow' || a.type === 'doubleArrow');
  }, [selectedAnnotations]);

  const handleSelectType = (type: string, e?: React.MouseEvent) => {
    setActiveDrawTool('select');
    const matchingIds = annotations.filter(a => a.type === type).map(a => a.id);
    if (e?.shiftKey) {
      const allIn = matchingIds.every(id => effectiveSelectedIds.includes(id));
      const next = allIn
        ? effectiveSelectedIds.filter(id => !matchingIds.includes(id))
        : Array.from(new Set([...effectiveSelectedIds, ...matchingIds]));
      setSelectedAnnIds?.(next);
      setSelectedAnnId?.(next[0] ?? null);
    } else {
      const isExactMatch = matchingIds.length === effectiveSelectedIds.length &&
        matchingIds.every(id => effectiveSelectedIds.includes(id));
      if (isExactMatch) {
        setSelectedAnnIds?.([]);
        setSelectedAnnId?.(null);
      } else {
        setSelectedAnnIds?.(matchingIds);
        setSelectedAnnId?.(matchingIds[0] ?? null);
      }
    }
  };

  const handleSelectAll = () => {
    setActiveDrawTool('select');
    if (effectiveSelectedIds.length === annotations.length && annotations.length > 0) {
      setSelectedAnnIds?.([]);
      setSelectedAnnId?.(null);
    } else {
      const allIds = annotations.map(a => a.id);
      setSelectedAnnIds?.(allIds);
      setSelectedAnnId?.(allIds[0] ?? null);
    }
  };

  const handleDeselectAll = () => {
    setSelectedAnnIds?.([]);
    setSelectedAnnId?.(null);
  };

  const handleDeleteSelected = () => {
    onChange(annotations.filter(a => !effectiveSelectedIds.includes(a.id)));
    setSelectedAnnIds?.([]);
    setSelectedAnnId?.(null);
  };

  // Same custom picker as the Color tab — seeded from the selected shape's fill
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [fillCustomColor, setFillCustomColor] = useColor('#22c55e');

  const handleReset = () => {
    onChange([]);
  };

  const handleEmojiSelect = (emoji: string) => {
    const newAnn: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      color: activeColor,
      strokeWidth: strokeWidth,
      text: emoji,
      fontSize: 64,
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      bounds: {
        x: 400,
        y: 400,
        w: 200,
        h: 200,
      },
    };
    onChange([...annotations, newAnn]);
    setActiveDrawTool('select');
  };

  const [open, setOpen] = useState({
    drawing: true,
    color: true,
    fill: true,
    doodle: true,
    lineStyle: true,
    textProps: true,
    layers: true,
  });
  const toggle = (key: keyof typeof open) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
          Markup & Draw
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1"
          >
            <RotateCcw size={9} /> Clear All
          </button>
        )}
      </div>

      <div className="flex-1 px-3 pb-6 space-y-2">

        {/* ── 1. Drawing Tool Card ── */}
        <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
          <div
            onClick={() => toggle('drawing')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
              <Pen size={11} className="text-primary" />
              <span>Drawing Tool</span>
            </div>
            <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.drawing ? 'rotate-0' : '-rotate-90'}`} />
          </div>

          {open.drawing && (
            <div className="space-y-3 pt-1">
              <ToolsGrid
                activeDrawTool={activeDrawTool}
                setActiveDrawTool={setActiveDrawTool}
              />

              {/* ── Multi-Selection Status Banner ── */}
              {effectiveSelectedIds.length > 0 && (
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                      <CheckSquare size={13} className="text-primary" />
                      <span>
                        {effectiveSelectedIds.length} {effectiveSelectedIds.length === 1 ? 'Markup' : isAllSameType ? `${getToolLabel(selectedAnnotations[0].type)}s` : 'Markups'} Selected
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-[9px] font-semibold text-white/60 hover:text-white px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        Deselect
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 text-[9px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={10} /> Delete ({effectiveSelectedIds.length})
                      </button>
                    </div>
                  </div>
                  {effectiveSelectedIds.length > 1 && (
                    <div className="text-[9px] text-white/50 leading-tight">
                      Editing toolbar controls updates all selected markups. Drag any markup on canvas to move it individually.
                    </div>
                  )}
                </div>
              )}

              {/* ── Select Same Markup / Quick Multi-Select ── */}
              {activeDrawTool === 'select' && annotations.length > 0 && (
                <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                      Select by Type
                    </span>
                    <span className="text-[9px] text-white/40 font-mono">
                      Shift+Click to multi-select
                    </span>
                  </div>

                  {/* Primary quick action: Select all of current markup type */}
                  {selectedAnn && countsByType[selectedAnn.type] > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSelectType(selectedAnn.type)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 text-white/90 hover:text-primary transition-all text-[10px] font-semibold cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={11} className="text-primary group-hover:scale-110 transition-transform" />
                        <span>Select All {getToolLabel(selectedAnn.type)}s</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                        {countsByType[selectedAnn.type]}
                      </span>
                    </button>
                  )}

                  {/* Type Filter Chips */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className={`text-[9px] px-2 py-1 rounded-md font-semibold border transition-all cursor-pointer ${
                        effectiveSelectedIds.length === annotations.length && annotations.length > 0
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      All ({annotations.length})
                    </button>
                    {presentTypes.map(t => {
                      const count = countsByType[t];
                      const matchingIds = annotations.filter(a => a.type === t).map(a => a.id);
                      const isFullySelected = matchingIds.length > 0 && matchingIds.every(id => effectiveSelectedIds.includes(id));
                      const isPartiallySelected = !isFullySelected && matchingIds.some(id => effectiveSelectedIds.includes(id));
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={(e) => handleSelectType(t, e)}
                          title={`Select all ${getToolLabel(t)}s (${count})`}
                          className={`text-[9px] px-2 py-1 rounded-md font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                            isFullySelected
                              ? 'bg-primary/20 border-primary/50 text-primary font-bold shadow-sm'
                              : isPartiallySelected
                                ? 'bg-primary/10 border-primary/25 text-white/80'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{getToolLabel(t)}</span>
                          <span className="text-[8px] opacity-70 font-mono">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Emoji Picker */}
              {activeDrawTool === 'emoji' && (
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-white/5">
                    <span className="text-[9px] font-bold uppercase text-white/50 tracking-widest">Select Emoji</span>
                  </div>
                  <EmojiPicker onSelect={handleEmojiSelect} />
                </div>
              )}

              {/* Stroke Width */}
              {activeDrawTool !== 'eraser' && (
                <EditorSlider
                  label={effectiveSelectedIds.length > 1 ? `Stroke Width (${effectiveSelectedIds.length} items)` : 'Stroke Width'}
                  value={strokeWidth}
                  onChange={val => {
                    setStrokeWidth(val);
                    markStyleChanged?.();
                    if (effectiveSelectedIds.length > 0) {
                      onUpdateTextProps?.({ strokeWidth: val });
                    }
                  }}
                  min={1} max={20} defaultValue={4} unit=" px"
                />
              )}

              {/* Pen options */}
              {(activeDrawTool === 'freehand' || isAllFreehand || (selectedAnn && selectedAnn.type === 'freehand')) && (
                <PenSettingsSection
                  settings={penSettings}
                  onChange={(patch) => {
                    setPenSettings?.({ ...penSettings, ...patch });
                    if (effectiveSelectedIds.length > 0) {
                      onUpdateTextProps?.(patch as any);
                    }
                  }}
                  selectedFreehand={selectedAnn && selectedAnn.type === 'freehand' ? selectedAnn : null}
                  onUpdateSelected={onUpdateTextProps}
                />
              )}

              {/* Brush Size (eraser) */}
              {activeDrawTool === 'eraser' && (
                <EditorSlider
                  label="Brush Size"
                  value={brushSize || 30}
                  onChange={val => setBrushSize?.(val)}
                  min={10} max={100} defaultValue={30} unit=" px"
                />
              )}

              {/* Layer Opacity */}
              {effectiveSelectedIds.length > 0 && (
                <EditorSlider
                  label={effectiveSelectedIds.length > 1 ? `Layer Opacity (${effectiveSelectedIds.length} items)` : 'Layer Opacity'}
                  value={Math.round((selectedAnn?.opacity ?? 1) * 100)}
                  onChange={val => {
                    const nextOpacity = val / 100;
                    setActiveOpacity?.(nextOpacity);
                    onUpdateTextProps?.({ opacity: nextOpacity });
                  }}
                  min={0} max={100} defaultValue={100} unit="%"
                />
              )}
            </div>
          )}
        </div>

        {/* ── 2. Color Card ── */}
        <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
          <div
            onClick={() => toggle('color')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
              <Palette size={11} className="text-primary" />
              <span>Color</span>
            </div>
            <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.color ? 'rotate-0' : '-rotate-90'}`} />
          </div>
          {open.color && (
            <div className="pt-1">
              <ColorPickerSection
                activeColor={activeColor}
                setActiveColor={setActiveColor}
                markStyleChanged={markStyleChanged}
              />
            </div>
          )}
        </div>

        {/* ── 3. Shape Fill & Style Card — only when bounded shape(s) are selected ── */}
        {selectedAnn && (isBoundedShape(selectedAnn.type) || isAllBoundedShapes) && (() => {
          const isRect = selectedAnn.type === 'rect' || selectedAnn.type === 'roundedRect';
          const isStar = selectedAnn.type === 'star' || selectedAnn.type === 'fourPointStar';
          const isPolygon = selectedAnn.type === 'pentagon' || selectedAnn.type === 'hexagon';
          const isSpeechBubble = selectedAnn.type === 'speechBubble';

          return (
            <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
              <button
                type="button"
                onClick={() => toggle('fill')}
                aria-expanded={open.fill}
                className="w-full flex items-center justify-between text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
                  <Square size={11} className="text-[#22c55e]" />
                  <span>Shape Style &amp; FX</span>
                </div>
                <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.fill ? 'rotate-0' : '-rotate-90'}`} />
              </button>

              {open.fill && (
                <div className="space-y-3 pt-1">
                  {/* ── Shape Superpowers (Dynamic per shape) ── */}
                  {(isRect || isSpeechBubble) && (
                    <EditorSlider
                      label="Corner Radius"
                      value={selectedAnn.cornerRadius ?? (selectedAnn.type === 'roundedRect' || isSpeechBubble ? 15 : 0)}
                      onChange={(val) => onUpdateTextProps?.({ cornerRadius: val })}
                      min={0}
                      max={50}
                      defaultValue={selectedAnn.type === 'roundedRect' || isSpeechBubble ? 15 : 0}
                      unit="px"
                    />
                  )}

                  {isStar && (
                    <>
                      <EditorSlider
                        label="Star Points"
                        value={selectedAnn.starPoints ?? (selectedAnn.type === 'star' ? 5 : 4)}
                        onChange={(val) => onUpdateTextProps?.({ starPoints: val })}
                        min={3}
                        max={12}
                        defaultValue={selectedAnn.type === 'star' ? 5 : 4}
                        unit=" pts"
                      />
                      <EditorSlider
                        label="Point Spikiness"
                        value={Math.round((selectedAnn.starSpikiness ?? (selectedAnn.type === 'star' ? 0.42 : 0.3)) * 100)}
                        onChange={(val) => onUpdateTextProps?.({ starSpikiness: val / 100 })}
                        min={15}
                        max={75}
                        defaultValue={selectedAnn.type === 'star' ? 42 : 30}
                        unit="%"
                      />
                    </>
                  )}

                  {isPolygon && (
                    <EditorSlider
                      label="Polygon Sides"
                      value={selectedAnn.polygonSides ?? (selectedAnn.type === 'pentagon' ? 5 : 6)}
                      onChange={(val) => onUpdateTextProps?.({ polygonSides: val })}
                      min={3}
                      max={10}
                      defaultValue={selectedAnn.type === 'pentagon' ? 5 : 6}
                      unit=" sides"
                    />
                  )}

                  {isSpeechBubble && selectedAnn.bounds && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 block">
                        Tail Orientation
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: 'left', label: 'Left', getPos: (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w * 0.18, y: b.y + b.h }) },
                          { id: 'center', label: 'Center', getPos: (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w * 0.5, y: b.y + b.h }) },
                          { id: 'right', label: 'Right', getPos: (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w * 0.82, y: b.y + b.h }) },
                          { id: 'deep', label: 'Deep', getPos: (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w * 0.18, y: b.y + b.h * 1.28 }) },
                        ].map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            // ponytail: tail position derives from EACH bubble's own bounds,
                            // not the primary's — a broadcast patch would misplace the rest
                            onClick={() => onChange(annotations.map(a =>
                              effectiveSelectedIds.includes(a.id) && a.bounds
                                ? { ...a, tailPos: preset.getPos(a.bounds) }
                                : a
                            ))}
                            className="px-2 py-1.5 rounded-lg border text-[9px] font-semibold bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-center"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Stroke Outline Style ── */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 block">
                      Outline Style
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'solid', label: 'Solid' },
                        { id: 'dashed', label: 'Dashed' },
                        { id: 'dotted', label: 'Dotted' },
                      ].map(s => {
                        const isActive = (selectedAnn.shapeStrokeStyle ?? 'solid') === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onUpdateTextProps?.({ shapeStrokeStyle: s.id as 'solid' | 'dashed' | 'dotted' })}
                            className={`py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all text-center ${
                              isActive
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Tactile Texture ── */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 block">
                      Texture
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: 'none', label: 'Smooth' },
                        { id: 'chalk', label: 'Chalk' },
                        { id: 'crayon', label: 'Crayon' },
                        { id: 'drybrush', label: 'Bristle' },
                      ].map(tex => {
                        const isActive = (selectedAnn.lineTexture ?? 'none') === tex.id;
                        return (
                          <button
                            key={tex.id}
                            type="button"
                            onClick={() => onUpdateTextProps?.({ lineTexture: tex.id as LineTexture })}
                            className={`py-1.5 px-1.5 rounded-lg text-[9px] font-bold border transition-all text-center ${
                              isActive
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {tex.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Visual FX (Bloom & Glass) ── */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 block">
                      Visual FX
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'glow', label: 'Neon Glow' },
                        { id: 'glass', label: 'Frosted' },
                      ].map(fx => {
                        const isActive = (selectedAnn.shapeEffect ?? 'none') === fx.id;
                        return (
                          <button
                            key={fx.id}
                            type="button"
                            onClick={() => onUpdateTextProps?.({ shapeEffect: fx.id as 'none' | 'glow' | 'glass' })}
                            className={`py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all text-center ${
                              isActive
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {fx.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Fill Mode (None / Solid / Gradient) ── */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 block">
                      Fill Type
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'none', label: 'No Fill' },
                        { id: 'solid', label: 'Solid' },
                        { id: 'gradient', label: 'Gradient' },
                      ].map(m => {
                        const isGrad = !!(selectedAnn.gradientFill && selectedAnn.gradientFill !== 'none');
                        const activeMode = isGrad ? 'gradient' : selectedAnn.fillShape ? 'solid' : 'none';
                        const isActive = activeMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (m.id === 'none') {
                                onUpdateTextProps?.({ fillShape: false, gradientFill: 'none' });
                              } else if (m.id === 'solid') {
                                onUpdateTextProps?.({ fillShape: true, gradientFill: 'none' });
                              } else {
                                onUpdateTextProps?.({
                                  fillShape: true,
                                  gradientFill: selectedAnn.gradientFill && selectedAnn.gradientFill !== 'none'
                                    ? selectedAnn.gradientFill
                                    : 'sunset',
                                });
                              }
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all text-center ${
                              isActive
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Solid fill controls */}
                    {selectedAnn.fillShape && (!selectedAnn.gradientFill || selectedAnn.gradientFill === 'none') && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#f43f5e', '#ffffff', '#000000'].map((c) => {
                            const cur = (selectedAnn.fillColor ?? selectedAnn.color).toLowerCase();
                            const isActive = cur === c.toLowerCase();
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => onUpdateTextProps?.({ fillColor: c, fillShape: true, gradientFill: 'none' })}
                                className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                                  isActive ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#12141a] scale-110' : 'border-white/10 hover:scale-110'
                                }`}
                                style={{ backgroundColor: c }}
                                title={c}
                                aria-label={`Fill color ${c}`}
                              />
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              setFillCustomColor(ColorService.convert('hex', selectedAnn.fillColor ?? selectedAnn.color));
                              setShowFillPicker(prev => !prev);
                            }}
                            className={`flex items-center gap-1 px-2 h-5 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                              showFillPicker
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                            aria-expanded={showFillPicker}
                            title="Custom fill color"
                          >
                            <Pipette size={10} />
                            <span>Custom</span>
                          </button>
                        </div>
                        {showFillPicker && (
                          <div className="rounded-xl overflow-hidden border border-white/10">
                            <ColorPicker
                              color={fillCustomColor}
                              onChange={setFillCustomColor}
                              hideInput={false}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateTextProps?.({ fillColor: fillCustomColor.hex, fillShape: true, gradientFill: 'none' });
                                setShowFillPicker(false);
                              }}
                              className="w-full py-2 bg-primary text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                        <EditorSlider
                          label="Fill Opacity"
                          value={Math.round((selectedAnn.fillOpacity ?? 0.5) * 100)}
                          onChange={val => onUpdateTextProps?.({ fillOpacity: val / 100 })}
                          min={0} max={100} defaultValue={50} unit="%"
                        />
                      </div>
                    )}

                    {/* Gradient presets */}
                    {selectedAnn.fillShape && selectedAnn.gradientFill && selectedAnn.gradientFill !== 'none' && (
                      <div className="space-y-1.5 pt-1">
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { id: 'sunset', name: 'Sunset', bg: 'linear-gradient(135deg, #f43f5e, #f59e0b)' },
                            { id: 'cyber', name: 'Cyber', bg: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' },
                            { id: 'emerald', name: 'Emerald', bg: 'linear-gradient(135deg, #10b981, #064e3b)' },
                            { id: 'gold', name: 'Gold', bg: 'linear-gradient(135deg, #fbbf24, #d97706)' },
                            { id: 'noir', name: 'Noir', bg: 'linear-gradient(135deg, #4b5563, #111827)' },
                          ].map(g => {
                            const isActive = selectedAnn.gradientFill === g.id;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => onUpdateTextProps?.({ fillShape: true, gradientFill: g.id as any })}
                                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                                  isActive
                                    ? 'border-primary ring-1 ring-primary bg-primary/10'
                                    : 'border-white/10 hover:border-white/20 bg-white/5'
                                }`}
                                title={g.name}
                              >
                                <span className="w-5 h-5 rounded-full shadow-inner border border-white/20" style={{ background: g.bg }} />
                                <span className="text-[8px] font-medium text-white/70 truncate w-full text-center">{g.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Badge Label inside Shape ── */}
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">
                        Badge Label
                      </span>
                      {selectedAnn.badgeText && (
                        <button
                          type="button"
                          onClick={() => onUpdateTextProps?.({ badgeText: '' })}
                          className="text-[9px] text-zinc-400 hover:text-white transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={selectedAnn.badgeText || ''}
                      onChange={(e) => onUpdateTextProps?.({ badgeText: e.target.value })}
                      placeholder="Text centered inside shape..."
                      maxLength={30}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Line Style Card — only when a line/arrow is selected ── */}
        {/* ── Line & Curve Style Card — only when a line/arrow is selected ── */}
        {selectedAnn && (selectedAnn.type === 'line' || selectedAnn.type === 'arrow' || selectedAnn.type === 'doubleArrow') && (
          <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
            {/* Semantic Header Button */}
            <button
              type="button"
              onClick={() => toggle('lineStyle')}
              aria-expanded={open.lineStyle}
              className="w-full flex items-center justify-between text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded p-0.5 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Pen size={12} className="text-primary" />
                <span className="text-[11px] font-medium text-white/90 group-hover:text-white">Line & Curve Style</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.03] text-white/40 font-mono border border-white/5">
                  {selectedAnn.points?.length ?? 2} pts
                </span>
                <ChevronDown size={13} className={`text-white/40 transition-transform duration-150 ${open.lineStyle ? 'rotate-0' : '-rotate-90'}`} />
              </div>
            </button>

            {open.lineStyle && (
              <div className="space-y-3 pt-0.5">
                {/* ── 1. Curve Control Points ── */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-white/50">Curve Points</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const pts = selectedAnn.points ?? [];
                        if (pts.length < 2) return;
                        let maxLen = -1;
                        let bestSeg = 0;
                        for (let i = 0; i < pts.length - 1; i++) {
                          const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
                          if (d > maxLen) {
                            maxLen = d;
                            bestSeg = i;
                          }
                        }
                        const pA = pts[bestSeg], pB = pts[bestSeg + 1];
                        const dx = pB.x - pA.x, dy = pB.y - pA.y;
                        const len = Math.hypot(dx, dy) || 1;
                        const nx = -dy / len, ny = dx / len;
                        const midX = (pA.x + pB.x) / 2 + nx * Math.min(45, Math.max(25, len * 0.25));
                        const midY = (pA.y + pB.y) / 2 + ny * Math.min(45, Math.max(25, len * 0.25));
                        const newPts = [...pts];
                        newPts.splice(bestSeg + 1, 0, { x: midX, y: midY });
                        // ponytail: geometry belongs to the primary only — broadcasting
                        // one line's points onto a multi-selection would corrupt the rest
                        onChange(annotations.map(a => a.id === selectedAnn.id ? { ...a, points: newPts } : a));
                      }}
                      className="flex items-center justify-center gap-1.5 h-7 px-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white/90 hover:text-white text-[10.5px] font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                    >
                      <Plus size={11} className="text-primary" />
                      <span>Add Point</span>
                    </button>
                    <button
                      type="button"
                      disabled={!selectedAnn.points || selectedAnn.points.length <= 2}
                      onClick={() => {
                        const pts = selectedAnn.points ?? [];
                        if (pts.length <= 2) return;
                        // ponytail: primary-only, see Add Point above
                        onChange(annotations.map(a => a.id === selectedAnn.id ? { ...a, points: [pts[0], pts[pts.length - 1]] } : a));
                      }}
                      className={`flex items-center justify-center gap-1.5 h-7 px-2 rounded-lg border text-[10.5px] font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                        selectedAnn.points && selectedAnn.points.length > 2
                          ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 hover:border-white/20 text-white/80 hover:text-white'
                          : 'opacity-35 cursor-not-allowed border-white/5 bg-transparent text-white/30'
                      }`}
                    >
                      <RotateCcw size={10} />
                      <span>Straighten</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 leading-snug px-0.5">
                    <Info size={11} className="flex-shrink-0 text-white/30" />
                    <span>Click curve on canvas to add · Double-click to delete</span>
                  </div>
                </div>

                {/* ── 2. Stroke Taper Profiles ── */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-white/50">Stroke Taper</div>
                  <div role="radiogroup" aria-label="Stroke Taper" className="grid grid-cols-5 gap-1">
                    {[
                      {
                        id: 'none',
                        label: 'Uniform',
                        title: 'Uniform: constant stroke width',
                        svg: <line x1="3" y1="7" x2="23" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />,
                      },
                      {
                        id: 'hand',
                        label: 'Brush',
                        title: 'Hand Brush: calligraphic pressure swell and organic taper',
                        svg: <path d="M 3 7 Q 8 3.8, 14 3.8 Q 20 3.8, 23 6.5 Q 20 9.8, 14 9.8 Q 8 9.8, 3 7 Z" fill="currentColor" />,
                      },
                      {
                        id: 'taperStart',
                        label: 'Needle',
                        title: 'Needle: fine entry expanding to thick body',
                        svg: <path d="M 3 7 L 23 3.5 L 23 10.5 Z" fill="currentColor" />,
                      },
                      {
                        id: 'taperBoth',
                        label: 'Dual',
                        title: 'Double Taper: pointed ends with weighted center',
                        svg: <path d="M 3 7 Q 13 3.5, 23 7 Q 13 10.5, 3 7 Z" fill="currentColor" />,
                      },
                      {
                        id: 'dynamic',
                        label: 'Pulse',
                        title: 'Dynamic Pulse: organic undulating rhythm',
                        svg: <path d="M 3 7 Q 8 3.5, 13 7 Q 18 10.5, 23 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />,
                      },
                    ].map((t) => {
                      const isActive = (selectedAnn.lineTaper ?? 'none') === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          title={t.title}
                          onClick={() => onUpdateTextProps?.({ lineTaper: t.id as LineTaper })}
                          className={`flex flex-col items-center justify-center h-10 py-1 px-0.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                            isActive
                              ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                              : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                          }`}
                        >
                          <svg width="26" height="14" viewBox="0 0 26 14" className="overflow-visible">
                            {t.svg}
                          </svg>
                          <span className="text-[9px] font-medium tracking-tight mt-0.5 truncate">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 3. Texture Effects ── */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-white/50">Texture Effect</div>
                  <div role="radiogroup" aria-label="Texture Effect" className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'none', label: 'Smooth', title: 'Smooth vector stroke' },
                      { id: 'chalk', label: 'Chalk', title: 'Chalk: porous paper grain and chalk tooth' },
                      { id: 'crayon', label: 'Crayon', title: 'Crayon: rough wax laydown' },
                      { id: 'drybrush', label: 'Bristle', title: 'Drybrush: directional bristle drag' },
                    ].map((tex) => {
                      const isActive = (selectedAnn.lineTexture ?? 'none') === tex.id;
                      return (
                        <button
                          key={tex.id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          title={tex.title}
                          onClick={() => onUpdateTextProps?.({ lineTexture: tex.id as LineTexture })}
                          className={`flex items-center justify-center h-7 px-1.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-center cursor-pointer ${
                            isActive
                              ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                              : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                          }`}
                        >
                          <span className="text-[10px] font-medium whitespace-nowrap">{tex.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 4. Pattern Overlays ── */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-white/50">Pattern Wave</div>
                  <div role="radiogroup" aria-label="Pattern Wave" className="grid grid-cols-4 gap-1">
                    {[
                      { id: undefined, label: 'None', path: 'M3 7 H21' },
                      { id: 'wave', label: 'Wave', path: 'M3 7 Q6 3 9 7 T15 7 T21 7' },
                      { id: 'zigzag', label: 'Zigzag', path: 'M3 7 L6 3 L10 11 L14 3 L18 11 L21 7' },
                      { id: 'sketch', label: 'Sketch', path: 'M3 7 Q6 5 10 8 T16 6 T21 7' },
                      { id: 'ripple', label: 'Ripple', path: 'M3 7 Q6 5 8 7 T13 7 T18 7 T21 7' },
                      { id: 'arc', label: 'Arc', path: 'M3 9 Q12 2 21 9' },
                      { id: 'sCurve', label: 'S-Curve', path: 'M3 9 Q7 4 12 7 T21 5' },
                      { id: 'loop', label: 'Loop', path: 'M3 7 C6 2 9 2 9 7 C9 12 12 12 15 7 C17 3 19 5 21 7' },
                    ].map((s) => {
                      const isActive = (selectedAnn.doodleLineStyle ?? undefined) === s.id;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          title={s.label}
                          onClick={() => onUpdateTextProps?.({ doodleLineStyle: s.id as DoodleLineStyle | undefined })}
                          className={`flex flex-col items-center justify-center h-11 py-1 px-0.5 rounded-lg border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer ${
                            isActive
                              ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                              : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.05] hover:border-white/10'
                          }`}
                        >
                          <svg width="24" height="12" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d={s.path} />
                          </svg>
                          <span className="text-[9px] font-medium tracking-tight mt-0.5 whitespace-nowrap truncate max-w-full px-0.5">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4. Text Doodle Card — only when textPath tool is active ── */}        {activeDrawTool === 'textPath' && (
          <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
            <div
              onClick={() => toggle('doodle')}
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
                <AlignLeft size={11} className="text-primary" />
                <span>Text Doodle</span>
              </div>
              <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.doodle ? 'rotate-0' : '-rotate-90'}`} />
            </div>
            {open.doodle && (
              <div className="pt-1">
                <DoodleSettingsSection
                  doodleText={doodleText}
                  setDoodleText={setDoodleText}
                  doodleFontSize={doodleFontSize}
                  setDoodleFontSize={setDoodleFontSize}
                  doodleFontFamily={doodleFontFamily}
                  setDoodleFontFamily={setDoodleFontFamily}
                  showDoodleGuide={showDoodleGuide}
                  setShowDoodleGuide={setShowDoodleGuide}
                />
              </div>
            )}
          </div>
        )}

        {/* ── 5. Text Properties Card — only when text annotation(s) are selected ── */}
        {selectedAnn && (selectedAnn.type === 'text' || isAllText) && (
          <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
            <div
              onClick={() => toggle('textProps')}
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
                <Type size={11} className="text-primary" />
                <span>Text Properties</span>
              </div>
              <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.textProps ? 'rotate-0' : '-rotate-90'}`} />
            </div>
            {open.textProps && (
              <div className="pt-1">
                <TextPropertiesSection
                  fontFamily={fontFamily}
                  setFontFamily={setFontFamily}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  fontWeight={fontWeight}
                  setWeight={setWeight}
                  fontStyle={fontStyle}
                  setStyle={setStyle}
                  textDecoration={textDecoration}
                  setDecoration={setDecoration}
                  textAlign={textAlign}
                  setTextAlign={setTextAlign}
                  lineHeight={lineHeight}
                  setLineHeight={setLineHeight}
                  letterSpacing={letterSpacing}
                  setLetterSpacing={setLetterSpacing}
                  onUpdateTextProps={onUpdateTextProps}
                />
              </div>
            )}
          </div>
        )}

        {/* ── 6. Layers Card ── */}
        <div className="bg-[#12141a] rounded-xl border border-white/5 p-3 space-y-3">
          <div
            onClick={() => toggle('layers')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-white">
              <Layers size={11} className="text-primary" />
              <span>Layers {annotations.length > 0 ? `(${annotations.length})` : ''}</span>
            </div>
            <ChevronDown size={12} className={`text-white/30 transition-transform duration-150 ${open.layers ? 'rotate-0' : '-rotate-90'}`} />
          </div>
          {open.layers && (
            <div className="pt-1">
              <LayersListSection
                annotations={annotations}
                onChange={onChange}
                selectedAnnId={selectedAnnId}
                setSelectedAnnId={setSelectedAnnId}
                selectedAnnIds={selectedAnnIds}
                setSelectedAnnIds={setSelectedAnnIds}
                setActiveDrawTool={setActiveDrawTool}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
