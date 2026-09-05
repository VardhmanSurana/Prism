/**
 * TextPropertiesSection.tsx
 * Renders font property controls (font family, size, line height, letter spacing, alignment, bold, italic, underline) for annotation text.
 */

import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { Annotation } from './types';
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';
import { Dropdown } from '@/components/ui/Dropdown';

const FONT_OPTIONS = [
  'Arial',
  'Space Grotesk',
  'Bebas Neue',
  'Pacifico',
  'Caveat',
  'Playfair Display',
  'Montserrat',
  'Cinzel',
  'Satisfy',
  'Anton',
  'JetBrains Mono',
  'Times New Roman',
  'Courier New',
];

interface TextPropertiesSectionProps {
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
}

export const TextPropertiesSection: React.FC<TextPropertiesSectionProps> = ({
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
}) => {
  return (
    <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 shadow-md">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        <span className="text-[9px] font-bold uppercase text-white/70 tracking-widest">
          TEXT PROPERTIES
        </span>
      </div>

      {/* Font Family Dropdown — triggered menu, each font previewed in its own typeface */}
      <div className="space-y-1">
        <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">FONT FAMILY</span>
        <Dropdown
          value={fontFamily || 'Space Grotesk'}
          onChange={(v) => {
            setFontFamily?.(v);
            onUpdateTextProps?.({ fontFamily: v });
          }}
          options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
          optionStyle={(v) => ({ fontFamily: `"${v}", system-ui, sans-serif` })}
          className="w-full"
        />
      </div>

      {/* Font Size slider */}
      <EditorSlider
        label="Font Size"
        value={fontSize || 36}
        onChange={(val) => {
          setFontSize?.(val);
          onUpdateTextProps?.({ fontSize: val });
        }}
        min={12}
        max={120}
        defaultValue={36}
        unit=" px"
      />

      {/* Line Height slider */}
      <EditorSlider
        label="Line Height"
        value={lineHeight || 1.2}
        onChange={(val) => {
          setLineHeight?.(val);
          onUpdateTextProps?.({ lineHeight: val });
        }}
        min={0.8}
        max={2.5}
        step={0.1}
        defaultValue={1.2}
        formatValue={val => val.toFixed(1)}
      />

      {/* Letter Spacing slider */}
      <EditorSlider
        label="Letter Spacing"
        value={letterSpacing || 0}
        onChange={(val) => {
          setLetterSpacing?.(val);
          onUpdateTextProps?.({ letterSpacing: val });
        }}
        min={-4}
        max={24}
        step={1}
        defaultValue={0}
        unit=" px"
        bipolar
      />

      {/* Style & Align selection grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">STYLE</span>
          <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5 gap-1">
            <button
              onClick={() => {
                const next = fontWeight === 'bold' ? 'normal' : 'bold';
                setWeight?.(next);
                onUpdateTextProps?.({ fontWeight: next });
              }}
              className={`editor-btn editor-chip-btn ${
                fontWeight === 'bold' ? 'active' : ''
              } flex-1 flex justify-center py-1.5 text-[10px]`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const next = fontStyle === 'italic' ? 'normal' : 'italic';
                setStyle?.(next);
                onUpdateTextProps?.({ fontStyle: next });
              }}
              className={`editor-btn editor-chip-btn ${
                fontStyle === 'italic' ? 'active' : ''
              } flex-1 flex justify-center py-1.5 text-[10px]`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const next = textDecoration === 'underline' ? 'none' : 'underline';
                setDecoration?.(next);
                onUpdateTextProps?.({ textDecoration: next });
              }}
              className={`editor-btn editor-chip-btn ${
                textDecoration === 'underline' ? 'active' : ''
              } flex-1 flex justify-center py-1.5 text-[10px]`}
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">ALIGN</span>
          <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5 gap-1">
            <button
              onClick={() => {
                setTextAlign?.('left');
                onUpdateTextProps?.({ textAlign: 'left' });
              }}
              className={`editor-btn editor-chip-btn ${
                textAlign === 'left' ? 'active' : ''
              } flex-1 flex justify-center py-1.5`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setTextAlign?.('center');
                onUpdateTextProps?.({ textAlign: 'center' });
              }}
              className={`editor-btn editor-chip-btn ${
                textAlign === 'center' ? 'active' : ''
              } flex-1 flex justify-center py-1.5`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setTextAlign?.('right');
                onUpdateTextProps?.({ textAlign: 'right' });
              }}
              className={`editor-btn editor-chip-btn ${
                textAlign === 'right' ? 'active' : ''
              } flex-1 flex justify-center py-1.5`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
