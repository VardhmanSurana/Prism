/**
 * AnnotationsPanel.tsx
 * Main layout wrapper for the drawing sidebar panel. Coordinates sub-panels for drawing tools, colors, text properties, doodles, and layers.
 */

import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Annotation, DrawToolId } from './types';
import { ToolsGrid } from './ToolsGrid';
import { ColorPickerSection } from './ColorPickerSection';
import { TextPropertiesSection } from './TextPropertiesSection';
import { DoodleSettingsSection } from './DoodleSettingsSection';
import { LayersListSection } from './LayersListSection';

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
  brushSize = 35,
  setBrushSize,
}) => {
  const isDefault = useMemo(() => annotations.length === 0, [annotations]);

  const selectedAnn = useMemo(() => {
    return annotations.find(a => a.id === selectedAnnId) || null;
  }, [annotations, selectedAnnId]);

  const handleReset = () => {
    onChange([]);
  };

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

      <div className="flex-1 px-4 pb-6 space-y-6">
        {/* Draw Tools Grid */}
        <ToolsGrid
          activeDrawTool={activeDrawTool}
          setActiveDrawTool={setActiveDrawTool}
        />

        {/* Color picker */}
        <ColorPickerSection
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          markStyleChanged={markStyleChanged}
        />

        {/* Stroke Width Slider — hidden when Brush (eraser) is active */}
        {activeDrawTool !== 'eraser' && (
        <div className="group/item">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
              Stroke Width
            </label>
            <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
              {strokeWidth}px
            </span>
          </div>
          <div className="relative h-4 flex items-center">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
              style={{
                left: '0%',
                width: `${((strokeWidth - 1) / 19) * 100}%`,
                boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
              }}
            />
            <input
              type="range"
              min={1}
              max={20}
              value={strokeWidth}
              onChange={e => { setStrokeWidth(Number(e.target.value)); markStyleChanged?.(); }}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>
        )}

        {/* Brush Size Slider — only shown when Brush (eraser) tool is active */}
        {activeDrawTool === 'eraser' && (
        <div className="group/item">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
              Brush Size
            </label>
            <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
              {brushSize}
            </span>
          </div>
          <div className="relative h-4 flex items-center">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
              style={{
                left: '0%',
                width: `${((brushSize - 10) / 90) * 100}%`,
                boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
              }}
            />
            <input
              type="range"
              min={10}
              max={100}
              value={brushSize}
              onChange={e => setBrushSize?.(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>
        )}

        {/* Layer Opacity Slider */}
        {selectedAnn && (
          <div className="group/item mt-4">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Layer Opacity
              </label>
              <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                {Math.round((selectedAnn.opacity ?? 1) * 100)}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${(selectedAnn.opacity ?? 1) * 100}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((selectedAnn.opacity ?? 1) * 100)}
                onChange={e => {
                  const nextOpacity = Number(e.target.value) / 100;
                  setActiveOpacity?.(nextOpacity);
                  onUpdateTextProps?.({ opacity: nextOpacity });
                }}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>
        )}

        {/* Selected Shape Fill Properties Panel */}
        {selectedAnn && (selectedAnn.type === 'rect' || selectedAnn.type === 'circle') && (
          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 shadow-md mt-4">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
                SHAPE FILL PROPERTIES
              </span>
            </div>

            {/* Fill Checkbox */}
            <div className="flex items-center justify-between">
              <label htmlFor="shapeFillCheckbox" className="text-[11px] font-medium text-zinc-400 select-none cursor-pointer">
                Fill Shape
              </label>
              <input
                id="shapeFillCheckbox"
                type="checkbox"
                checked={selectedAnn.fillShape || false}
                onChange={(e) => {
                  onUpdateTextProps?.({ fillShape: e.target.checked });
                }}
                className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Fill Opacity Slider */}
            {selectedAnn.fillShape && (
              <div className="group/item">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                    Fill Opacity
                  </label>
                  <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                    {Math.round((selectedAnn.fillOpacity ?? 0.5) * 100)}%
                  </span>
                </div>
                <div className="relative h-4 flex items-center">
                  <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                  <div
                    className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                    style={{
                      left: '0%',
                      width: `${(selectedAnn.fillOpacity ?? 0.5) * 100}%`,
                      boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((selectedAnn.fillOpacity ?? 0.5) * 100)}
                    onChange={(e) => {
                      const val = Number(e.target.value) / 100;
                      onUpdateTextProps?.({ fillOpacity: val });
                    }}
                    className="adjustment-slider slider-thumb-premium"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Doodle Settings Panel */}
        {activeDrawTool === 'textPath' && (
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
        )}

        {/* Selected Text Layer Properties Panel */}
        {selectedAnn && selectedAnn.type === 'text' && (
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
        )}

        {/* Annotations List */}
        <LayersListSection
          annotations={annotations}
          onChange={onChange}
        />
      </div>
    </div>
  );
};
