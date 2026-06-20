import { DrawingTool, TextLayer, VectorShape } from '../types';
import {
  MousePointer,
  Pencil,
  Highlighter as HighlightIcon,
  MoveRight,
  Square,
  Circle,
  Type,
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Scissors,
  Sparkles,
} from 'lucide-react';

interface DrawingPanelContentsProps {
  activeTool: DrawingTool;
  setActiveTool: (tool: DrawingTool) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontWeight: 'normal' | 'bold';
  setWeight: (w: 'normal' | 'bold') => void;
  fontStyle: 'normal' | 'italic';
  setStyle: (s: 'normal' | 'italic') => void;
  textDecoration: 'none' | 'underline' | 'line-through';
  setDecoration: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign: 'left' | 'center' | 'right';
  setTextAlign: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (val: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (val: number) => void;
  onClearAll: () => void;
  selectedTextLayer: TextLayer | null;
  onUpdateSelectedText: (text: string) => void;
  selectedShapeLayer?: VectorShape | null;
  opacity?: number;
  setOpacity?: (o: number) => void;
  onAddCustomText?: (preset: Partial<TextLayer>) => void;
  onUpdateTextProps?: (updatedProps: Partial<TextLayer>) => void;
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;
}

export default function DrawingPanelContents({
  activeTool,
  setActiveTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
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
  lineHeight = 1.2,
  setLineHeight,
  letterSpacing = 0,
  setLetterSpacing,
  onClearAll,
  selectedTextLayer,
  onUpdateSelectedText,
  selectedShapeLayer = null,
  opacity = 100,
  setOpacity,
  onAddCustomText,
  onUpdateTextProps,
  doodleText = 'peace in the air',
  setDoodleText,
  doodleFontSize = 18,
  setDoodleFontSize,
  doodleFontFamily = 'Space Grotesk',
  setDoodleFontFamily,
  showDoodleGuide = true,
  setShowDoodleGuide,
}: DrawingPanelContentsProps) {

  // Color Swatches from Reference Image
  const colorsRow1 = [
    '#ff4a4a', // Vivid Red
    '#ff7f11', // Orange
    '#f4d35e', // Golden Yellow
    '#39ca74', // Green
    '#17bebb', // Cyan
    '#3498db'  // Intense Blue
  ];

  const colorsRow2 = [
    '#5c5cff', // Bright Blue-Purple
    '#9b5de5', // Royal Purple
    '#ff1493', // Deep Pink
    '#ee6c4d', // Coral Salmon
    '#f15bb5', // Bubblegum Magenta
    '#e25f8b'  // Pastel Ruby
  ];

  const colorsRow3 = [
    '#ffffff', // Pure White
    '#cbd5e0', // Light Gray
    '#718096', // Mid Slate
    '#2d3748', // Charcoal
    '#000000'  // Dark Ink Black
  ];

  const tools: { id: DrawingTool; label: string; icon: any }[] = [
    { id: 'select', label: 'Select', icon: MousePointer },
    { id: 'pen', label: 'Pen', icon: Pencil },
    { id: 'highlighter', label: 'HighLighter', icon: HighlightIcon },
    { id: 'arrow', label: 'Arrow', icon: MoveRight },
    { id: 'rect', label: 'Rect', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'textPath', label: 'Text Doodle', icon: Sparkles },
  ];

  return (
    <div className="flex flex-col gap-5 text-xs text-slate-300">
      
      {/* Dynamic Header & Clear All */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a] uppercase tracking-wider font-semibold text-[10px] text-[#8e8e9a]">
        <span>MARKUP & DRAW</span>
        <button
          onClick={onClearAll}
          className="text-pink-500 hover:text-pink-400 text-[10px] font-semibold transition"
        >
          CLEAR ALL
        </button>
      </div>

      {/* DRAWING TOOL MODULE */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase text-[#8e8e9a] mb-2 tracking-wider">DRAWING TOOL</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                className={`py-2 px-1 rounded flex flex-col items-center justify-center gap-1 transition ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#1e1e24] text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[9px] font-medium tracking-tight truncate w-full text-center">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TEXT PATH DOODLE SETTINGS PANEL */}
      {activeTool === 'textPath' && (
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[9px] font-bold uppercase text-white tracking-widest">
              TEXT DOODLE SETTINGS
            </span>
          </div>

          {/* Core Words Input */}
          <div className="space-y-1">
            <label className="text-[9px] text-[#8e8e9a] font-semibold uppercase tracking-wider block">
              Doodle Text Wordings
            </label>
            <input
              type="text"
              value={doodleText}
              onChange={(e) => setDoodleText && setDoodleText(e.target.value)}
              placeholder="e.g. peace in the air"
              className="w-full bg-[#16161c] border border-zinc-800 focus:border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none tracking-wide transition"
            />
            <p className="text-[8px] text-zinc-500 italic mt-0.5 leading-normal">
              💡 Hint: Double-click on the image to activate doodle mode, then drag to draw details!
            </p>
          </div>

          {/* Font Size slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[#8e8e9a] font-semibold uppercase tracking-wider">
                Font Size
              </span>
              <span className="font-mono text-[10px] text-white">{doodleFontSize}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="48"
              value={doodleFontSize}
              onChange={(e) => setDoodleFontSize && setDoodleFontSize(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Custom Font Family select */}
          <div className="space-y-1">
            <span className="text-[9px] text-[#8e8e9a] font-semibold uppercase tracking-wider block">
              Font Style
            </span>
            <select
              value={doodleFontFamily}
              onChange={(e) => setDoodleFontFamily && setDoodleFontFamily(e.target.value)}
              className="w-full bg-[#16161c] border border-zinc-800 rounded px-2.5 py-1 text-[11px] tracking-wide text-white focus:outline-none cursor-pointer"
            >
              <option value="Space Grotesk">Space Grotesk (Tech Modern)</option>
              <option value="Montserrat">Montserrat (Modern Sans Accent)</option>
              <option value="Pacifico">Pacifico (Retro Brush Outline)</option>
              <option value="Caveat">Caveat (Playful Handwriting)</option>
              <option value="Satisfy">Satisfy (Elegant Brush Script)</option>
              <option value="Bebas Neue">Bebas Neue (Tall Stamp)</option>
              <option value="Helvetica">Arial / Standard Sans</option>
              <option value="JetBrains Mono">JetBrains Mono (Consoles)</option>
            </select>
          </div>

          {/* Show outline path guide */}
          <div className="flex items-center justify-between pt-1">
            <label className="text-[9px] text-[#8e8e9a] font-semibold uppercase tracking-wider cursor-pointer select-none" htmlFor="showDoodleGuideCheck">
              Show Path Guide Line
            </label>
            <input
              id="showDoodleGuideCheck"
              type="checkbox"
              checked={showDoodleGuide}
              onChange={(e) => setShowDoodleGuide && setShowDoodleGuide(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-800 bg-[#16161c] accent-zinc-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* COLOR SWATCH MODULE */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase text-[#8e8e9a] mb-2.5 tracking-wider">COLOR</h3>
        
        {/* Swatch Matrix */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2.5">
            {colorsRow1.map((c) => (
              <button
                key={c}
                onClick={() => setStrokeColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5.5 h-5.5 rounded-full transition-transform hover:scale-110 relative shrink-0 ${
                  strokeColor === c ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/10'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2.5">
            {colorsRow2.map((c) => (
              <button
                key={c}
                onClick={() => setStrokeColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5.5 h-5.5 rounded-full transition-transform hover:scale-110 relative shrink-0 ${
                  strokeColor === c ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/10'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2.5 items-center">
            {colorsRow3.map((c) => (
              <button
                key={c}
                onClick={() => setStrokeColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5.5 h-5.5 rounded-full transition-transform hover:scale-110 relative shrink-0 ${
                  strokeColor === c ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/10'
                }`}
              >
                {c === '#000000' && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 p-1.5 bg-[#17171c] rounded">
          <span className="text-[10px]">Active Stroke Color:</span>
          <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: strokeColor }} />
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-8 h-4 rounded bg-transparent border-0 opacity-0 absolute cursor-pointer"
          />
          <span className="text-[10px] font-mono text-zinc-400 font-semibold">{strokeColor}</span>
        </div>
      </div>

      {/* STROKE WIDTH SLIDER */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase text-[#8e8e9a] tracking-wider">Stroke Width</span>
          <span className="font-mono text-[11px] font-medium text-white">{strokeWidth}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="32"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>

      {/* LAYER OPACITY SLIDER */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase text-[#8e8e9a] tracking-wider">Layer Opacity</span>
          <span className="font-mono text-[11px] font-medium text-white">{opacity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity && setOpacity(Number(e.target.value))}
          disabled={!selectedTextLayer && !selectedShapeLayer}
          className={`w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-white ${
            (!selectedTextLayer && !selectedShapeLayer) ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        />
        {(!selectedTextLayer && !selectedShapeLayer) && (
          <p className="text-[9px] text-zinc-500 mt-1">Select a text or shape layer to adjust its opacity.</p>
        )}
      </div>

      {/* CANVA TYPOGRAPHY PRESETS & TEMPLATES */}
      <div className="pt-2 border-t border-[#27272a] space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider">
            CANVA TEXT TEMPLATES
          </span>
          <span className="bg-[#22c55e]/15 text-[#22c55e] text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
            WYSIWYG
          </span>
        </div>

        {/* Triple Starters Panel */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onAddCustomText && onAddCustomText({
              text: 'Add a heading',
              fontSize: 44,
              fontWeight: 'bold',
              fontFamily: 'Montserrat',
              textAlign: 'center',
            })}
            className="w-full text-left py-2 px-3 bg-[#16161c] hover:bg-[#1f1f26] border border-zinc-800 hover:border-zinc-700 rounded transition font-bold text-white text-[13px] tracking-wide flex items-center justify-between active:scale-98"
          >
            <span>+ Add title</span>
            <span className="text-[9px] text-zinc-500 font-normal italic">Montserrat Bold</span>
          </button>
          
          <button
            onClick={() => onAddCustomText && onAddCustomText({
              text: 'Add a subheading',
              fontSize: 28,
              fontWeight: 'bold',
              fontFamily: 'Space Grotesk',
              textAlign: 'center',
            })}
            className="w-full text-left py-1.5 px-3 bg-[#16161c] hover:bg-[#1f1f26] border border-zinc-800 hover:border-zinc-700 rounded transition font-semibold text-zinc-200 text-xs flex items-center justify-between active:scale-98"
          >
            <span>+ Add subtitle</span>
            <span className="text-[9px] text-zinc-500 font-normal italic">Space Grotesk</span>
          </button>

          <button
            onClick={() => onAddCustomText && onAddCustomText({
              text: 'Add body copy script text here.',
              fontSize: 16,
              fontFamily: 'Inter',
              textAlign: 'center',
            })}
            className="w-full text-left py-1.5 px-3 bg-[#16161c] hover:bg-[#1f1f26] border border-zinc-800 hover:border-zinc-700 rounded transition text-zinc-400 text-[10px] flex items-center justify-between active:scale-98"
          >
            <span>+ Add body text</span>
            <span className="text-[9px] text-zinc-500 font-normal italic">Inter Standard</span>
          </button>
        </div>

        {/* Premium Graphic Templates Grid */}
        <div className="space-y-1.5">
          <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-2">
            PRE-STYLED COMBINATIONS:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: 'adventure',
                label: 'Life is an ADVENTURE',
                text: 'Adventure',
                fontFamily: 'Pacifico',
                fontSize: 34,
                color: '#ffffff',
                textShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                cardClass: 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-900/40 text-[#ffffff]'
              },
              {
                id: 'congratulations',
                label: 'Greetings',
                text: 'Congratulations!',
                fontFamily: 'Satisfy',
                fontSize: 22,
                color: '#f15bb5',
                cardClass: 'bg-pink-950/20 hover:bg-pink-950/30 border-pink-900/40 text-[#f15bb5]'
              },
              {
                id: 'marketing',
                label: 'Portfolio',
                text: 'PORTFOLIO',
                fontFamily: 'Montserrat',
                fontSize: 15,
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: 2,
                textTransform: 'uppercase',
                cardClass: 'bg-[#18181c] hover:bg-zinc-800 border-zinc-800 text-white'
              },
              {
                id: 'operations',
                label: 'Tall Bebas Banner',
                text: "OPERATIONS\nMANAGER",
                fontFamily: 'Bebas Neue',
                fontSize: 20,
                color: '#ffffff',
                letterSpacing: 2,
                lineHeight: 0.9,
                cardClass: 'bg-[#18181c] hover:bg-zinc-800 border-zinc-800 text-white'
              },
              {
                id: 'sale_tall',
                label: 'Vivid Red Sale',
                text: 'SALE',
                fontFamily: 'Bebas Neue',
                fontSize: 38,
                color: '#ff4a4a',
                letterSpacing: 3,
                cardClass: 'bg-red-950/10 hover:bg-red-950/25 border-red-950/50 text-[#ff4a4a]'
              },
              {
                id: 'minimalism',
                label: 'Minimalism Display',
                text: 'MINIMALISM',
                fontFamily: 'Montserrat',
                fontSize: 13,
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: 5,
                textTransform: 'uppercase',
                cardClass: 'bg-[#18181c] hover:bg-zinc-800 border-zinc-800 text-slate-100'
              },
              {
                id: 'hello_winter',
                label: 'Cozy Handwriting',
                text: 'Hello Winter',
                fontFamily: 'Caveat',
                fontSize: 26,
                color: '#17bebb',
                cardClass: 'bg-teal-950/20 hover:bg-teal-950/30 border-teal-900/40 text-[#17bebb]'
              },
              {
                id: 'neon_pink',
                label: 'Neon Glowing',
                text: '#OMG',
                fontFamily: 'Bebas Neue',
                fontSize: 32,
                color: '#ff1493',
                textShadow: '0 0 10px #ff1493',
                textStroke: '1px #ffffff',
                cardClass: 'bg-pink-950/15 hover:bg-pink-950/25 border-pink-900/30'
              },
              {
                id: 'barcode_style',
                label: 'Barcode Style',
                text: '|||| CODE ||||',
                fontFamily: 'JetBrains Mono',
                fontSize: 14,
                color: '#39ca74',
                letterSpacing: 4,
                cardClass: 'bg-green-950/10 hover:bg-green-950/20 border-green-950/40 text-[#39ca74]'
              },
              {
                id: 'yellow_highlight',
                label: 'Yellow Banner Highlight',
                text: 'BLACK FRIDAY',
                fontFamily: 'Bebas Neue',
                fontSize: 17,
                color: '#000000',
                bgColor: '#f4d35e',
                letterSpacing: 2,
                cardClass: 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700'
              },
              {
                id: 'handmade',
                label: 'Vintage Serif Stamp',
                text: 'HAND MADE',
                fontFamily: 'Cinzel',
                fontSize: 14,
                color: '#ee6c4d',
                letterSpacing: 1,
                cardClass: 'bg-[#1a1a20] hover:bg-zinc-800 border-zinc-800 text-[#ee6c4d]'
              },
              {
                id: 'jumpjump',
                label: 'Heavy Slanted Slant',
                text: 'JUMP JUMP',
                fontFamily: 'Anton',
                fontSize: 22,
                color: '#eab308',
                fontStyle: 'italic',
                cardClass: 'bg-yellow-950/10 hover:bg-yellow-950/20 border-yellow-950/30'
              },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => onAddCustomText && onAddCustomText({
                  text: p.text,
                  fontFamily: p.fontFamily,
                  fontSize: p.fontSize * 1.5,
                  color: p.color,
                  textShadow: p.textShadow,
                  textStroke: p.textStroke,
                  bgColor: p.bgColor,
                  letterSpacing: p.letterSpacing,
                  lineHeight: p.lineHeight,
                  fontStyle: p.fontStyle as any,
                  fontWeight: p.fontWeight as any,
                  textTransform: p.textTransform as any,
                })}
                className={`p-3 rounded-lg border text-center transition flex flex-col items-center justify-center min-h-[72px] relative overflow-hidden active:scale-95 cursor-pointer ${p.cardClass}`}
              >
                <div
                  style={{
                    fontFamily: p.fontFamily,
                    color: p.color,
                    letterSpacing: p.letterSpacing ? `${p.letterSpacing}px` : undefined,
                    lineHeight: p.lineHeight || 1.1,
                    textShadow: p.textShadow,
                    WebkitTextStroke: p.textStroke,
                    backgroundColor: p.bgColor,
                    fontStyle: p.fontStyle,
                    padding: p.bgColor ? '2px 6px' : undefined,
                    borderRadius: p.bgColor ? '3px' : undefined,
                    fontWeight: p.fontWeight || 'normal',
                    textTransform: p.textTransform as any,
                  }}
                  className="font-medium truncate max-w-full text-center whitespace-pre-line text-[14px]"
                >
                  {p.text}
                </div>
                <span className="absolute bottom-1 right-2 text-[7px] text-zinc-500 tracking-tight font-mono">
                  {p.fontFamily}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TEXT PROPERTIES MODULE */}
      {selectedTextLayer && (
        <div className="pt-3 border-t border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-[10px] font-bold uppercase text-white tracking-wider">SELECTED LAYER PROPERTIES</span>
          </div>

          {/* Font Family Dropdown */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">FONT FAMILY</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full bg-[#1e1e24] border border-[#2d2d38] rounded px-2.5 py-1.5 text-xs tracking-wide text-white focus:outline-none"
            >
              <option value="Arial">Arial (Standard)</option>
              <option value="Space Grotesk">Space Grotesk (Tech Modern)</option>
              <option value="Bebas Neue">Bebas Neue (Tall Display)</option>
              <option value="Pacifico">Pacifico (Retro Brush)</option>
              <option value="Caveat">Caveat (Playful Script)</option>
              <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
              <option value="Montserrat">Montserrat (Modern Sans)</option>
              <option value="Cinzel">Cinzel (Classical Serifs)</option>
              <option value="Satisfy">Satisfy (Elegant Script)</option>
              <option value="Anton">Anton (Heavy Display)</option>
              <option value="JetBrains Mono">JetBrains Mono (Console)</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          {/* Font Size slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-zinc-400 uppercase">Font Size</label>
              <span className="font-mono text-white text-[10px] font-semibold">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Line Spacing (Line Height) slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-zinc-400 uppercase">Line Height</label>
              <span className="font-mono text-white text-[10px] font-semibold">{lineHeight.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight && setLineHeight(Number(e.target.value))}
              className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Letter Spacing slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-zinc-400 uppercase">Letter Spacing</label>
              <span className="font-mono text-white text-[10px] font-semibold">{letterSpacing}px</span>
            </div>
            <input
              type="range"
              min="-4"
              max="24"
              step="1"
              value={letterSpacing}
              onChange={(e) => setLetterSpacing && setLetterSpacing(Number(e.target.value))}
              className="w-full h-1 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Style & Align selection grid */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[9px] text-[#8e8e9a] block mb-1">STYLE</span>
              <div className="flex bg-[#111115] rounded p-0.5">
                <button
                  onClick={() => setWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                  className={`flex-1 flex justify-center py-1 rounded text-[10px] transition ${
                    fontWeight === 'bold' ? 'bg-[#2d2d38] text-white font-bold' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                  className={`flex-1 flex justify-center py-1 rounded text-[10px] transition ${
                    fontStyle === 'italic' ? 'bg-[#2d2d38] text-white italic' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDecoration(textDecoration === 'underline' ? 'none' : 'underline')}
                  className={`flex-1 flex justify-center py-1 rounded text-[10px] transition ${
                    textDecoration === 'underline' ? 'bg-[#2d2d38] text-white underline' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <span className="text-[9px] text-[#8e8e9a] block mb-1">ALIGN</span>
              <div className="flex bg-[#111115] rounded p-0.5">
                <button
                  onClick={() => setTextAlign('left')}
                  className={`flex-1 flex justify-center py-1 rounded transition ${
                    textAlign === 'left' ? 'bg-[#2d2d38] text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTextAlign('center')}
                  className={`flex-1 flex justify-center py-1 rounded transition ${
                    textAlign === 'center' ? 'bg-[#2d2d38] text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTextAlign('right')}
                  className={`flex-1 flex justify-center py-1 rounded transition ${
                    textAlign === 'right' ? 'bg-[#2d2d38] text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ADVANCED CANVA BG HIGHLIGHT FOR SELECTED TEXT */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-400 block uppercase tracking-wide">
              Text HIGHLIGHT BANNER
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'None', value: '' },
                { label: 'Yellow', value: '#eab308' },
                { label: 'Red', value: '#ff4a4a' },
                { label: 'Pink', value: '#f15bb5' },
                { label: 'Black', value: '#000000' },
                { label: 'Charcoal', value: '#1e1e24' },
                { label: 'Teal', value: '#17bebb' }
              ].map((sw) => {
                const isCurrent = (selectedTextLayer.bgColor || '') === sw.value;
                return (
                  <button
                    key={sw.label}
                    onClick={() => onUpdateTextProps && onUpdateTextProps({ bgColor: sw.value })}
                    style={{ backgroundColor: sw.value || 'transparent' }}
                    className={`px-2.5 py-1 rounded text-[9px] border font-medium cursor-pointer transition active:scale-95 ${
                      isCurrent
                        ? 'border-[#22c55e] text-[#22c55e] bg-zinc-950 font-bold'
                        : 'border-zinc-800 hover:border-zinc-600 text-zinc-300 bg-zinc-900/40'
                    }`}
                  >
                    {sw.value === '' && <span className="opacity-65">✖</span>} {sw.label}
                  </button>
                );
              })}
            </div>

            {/* Manual Background color picker */}
            <div className="flex items-center gap-2 p-1.5 bg-[#17171c] rounded">
              <span className="text-[9px] text-zinc-400">Custom Banner BG:</span>
              <div
                className="w-4 h-4 rounded border border-white/20"
                style={{ backgroundColor: selectedTextLayer.bgColor || '#1e1e24' }}
              />
              <input
                type="color"
                value={selectedTextLayer.bgColor || '#000000'}
                onChange={(e) => onUpdateTextProps && onUpdateTextProps({ bgColor: e.target.value })}
                className="w-8 h-4 rounded bg-transparent border-0 opacity-0 absolute cursor-pointer"
              />
              <span className="text-[9px] font-mono text-zinc-400 font-semibold">{selectedTextLayer.bgColor || 'none'}</span>
            </div>
          </div>

          {/* HOLLOW AND NEON SPECIAL EFFECTS */}
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-wide">CREATIVE EFFECTS & CASE</span>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Hollow outline toggler */}
              <button
                onClick={() => {
                  const hasStroke = !!selectedTextLayer.textStroke && selectedTextLayer.textStroke !== 'none';
                  onUpdateTextProps && onUpdateTextProps({
                    textStroke: hasStroke ? 'none' : '1px #ffffff'
                  });
                }}
                className={`py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 text-[10px] transition cursor-pointer active:scale-95 ${
                  selectedTextLayer.textStroke && selectedTextLayer.textStroke !== 'none'
                    ? 'bg-zinc-100 text-black font-bold border-zinc-200'
                    : 'bg-[#18181c] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                }`}
                title="Hollow Stroke outline style"
              >
                <span>Outline Stroke</span>
                <span className="text-[8px] opacity-75">#OMG</span>
              </button>

              {/* Pink Neon Glow Toggler */}
              <button
                onClick={() => {
                  const hasGlow = !!selectedTextLayer.textShadow && selectedTextLayer.textShadow !== 'none';
                  onUpdateTextProps && onUpdateTextProps({
                    textShadow: hasGlow ? 'none' : '0 0 10px #ff1493'
                  });
                }}
                className={`py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 text-[10px] transition cursor-pointer active:scale-95 ${
                  selectedTextLayer.textShadow && selectedTextLayer.textShadow !== 'none'
                    ? 'bg-pink-500/15 text-pink-400 font-bold border-pink-500/50'
                    : 'bg-[#18181c] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                }`}
                title="Glowing Neon style"
              >
                <span>Neon Glow 🌟</span>
              </button>

              {/* Case Casing Switcher */}
              <div className="col-span-2 space-y-1">
                <span className="text-[9px] text-[#8e8e9a] block uppercase tracking-wide">TEXT CASE TRANSFORM</span>
                <div className="flex bg-[#111115] rounded p-0.5 border border-zinc-800">
                  {[
                    { label: 'Normal', value: 'none' },
                    { label: 'UPPER', value: 'uppercase' },
                    { label: 'lower', value: 'lowercase' },
                    { label: 'Capital', value: 'capitalize' },
                  ].map((caseOption) => {
                    const isSelected = (selectedTextLayer.textTransform || 'none') === caseOption.value;
                    return (
                      <button
                        key={caseOption.value}
                        onClick={() => onUpdateTextProps && onUpdateTextProps({ textTransform: caseOption.value as any })}
                        className={`flex-1 text-center py-1.5 rounded text-[10px] uppercase tracking-wider transition font-medium cursor-pointer ${
                          isSelected
                            ? 'bg-[#2d2d38] text-white font-bold shadow-sm'
                            : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        {caseOption.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
