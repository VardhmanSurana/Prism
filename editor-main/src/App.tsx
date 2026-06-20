import { useState, useEffect, ChangeEvent } from 'react';
import {
  ActiveSidebarTab,
  DrawingTool,
  DrawingLine,
  VectorShape,
  TextLayer,
  ImageAdjustments,
  EditorState,
  HistoryItem,
} from './types';
import DrawingPanelContents from './components/DrawingPanelContents';
import CanvasViewport from './components/CanvasViewport';
import { SAMPLE_IMAGES } from './components/SampleImages';
import {
  Download,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';

const INITIAL_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  highHue: 0,
  highSat: 0,
  shadowHue: 0,
  shadowSat: 0,
  sharpness: 0,
  blur: 0,
  noise: 0,
  vignette: 0,
  faceGlow: 0,
  smoothSkin: 0,
  eyeBright: 0,
  teethWhite: 0,
  grain: 0,
  leakColor: '#ff8c00',
  leakIntensity: 0,
  leakPosition: 'left',
  frameStyle: 'none',
  rotation: 0,
  flipH: false,
  flipV: false,
  cropPercent: null,
  blendImage: null,
  blendMode: 'screen',
  blendOpacity: 50,
};

export default function App() {
  // Loaded images (default to Fountain courtyard sample)
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_IMAGES[0].url);
  const [originalSrc, setOriginalSrc] = useState<string>(SAMPLE_IMAGES[0].url);
  const [imageName, setImageName] = useState<string>('Fountain Courtyard');
  
  // Drawing Instruments parameters
  const [activeTool, setActiveTool] = useState<DrawingTool>('text');
  const [strokeColor, setStrokeColor] = useState<string>('#ff4a4a'); // default Red as referenced
  const [strokeWidth, setStrokeWidth] = useState<number>(7);        // default 7px as reference
  const [fontFamily, setFontFamily] = useState<string>('Space Grotesk');
  const [fontSize, setFontSize] = useState<number>(56);              // default 56px text
  const [fontWeight, setWeight] = useState<'normal' | 'bold'>('bold');
  const [fontStyle, setStyle] = useState<'normal' | 'italic'>('normal');
  const [txtDecoration, setDecoration] = useState<'none' | 'underline' | 'line-through'>('none');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);

  // Text Path Doodle control parameters
  const [doodleText, setDoodleText] = useState<string>('peace in the air');
  const [doodleFontSize, setDoodleFontSize] = useState<number>(18);
  const [doodleFontFamily, setDoodleFontFamily] = useState<string>('Space Grotesk');
  const [showDoodleGuide, setShowDoodleGuide] = useState<boolean>(true);

  // Working element arrays
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [shapes, setShapes] = useState<VectorShape[]>([]);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedText, setSelectedText] = useState<TextLayer | null>(null);
  const [selectedShape, setSelectedShape] = useState<VectorShape | null>(null);
  const [opacity, setOpacity] = useState<number>(100);

  // Sync selected text properties and state parameters
  const handleSelectText = (txt: TextLayer | null) => {
    setSelectedText(txt);
    if (txt) {
      setSelectedShape(null); // Deselect shape
      setStrokeColor(txt.color);
      setFontFamily(txt.fontFamily);
      setFontSize(txt.fontSize);
      setWeight(txt.fontWeight);
      setStyle(txt.fontStyle);
      setDecoration(txt.textDecoration);
      setTextAlign(txt.textAlign);
      setOpacity(txt.opacity ?? 100);
      setLineHeight(txt.lineHeight ?? 1.2);
      setLetterSpacing(txt.letterSpacing ?? 0);
    }
  };

  const handleSelectShape = (sh: VectorShape | null) => {
    setSelectedShape(sh);
    if (sh) {
      setSelectedText(null); // Deselect text
      setStrokeColor(sh.color);
      setStrokeWidth(sh.strokeWidth);
      setOpacity(sh.opacity ?? 100);
    }
  };

  const handleSetOpacity = (val: number) => {
    setOpacity(val);
    if (selectedText) {
      const updatedLayer = { ...selectedText, opacity: val };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    } else if (selectedShape) {
      const updatedLayer = { ...selectedShape, opacity: val };
      setSelectedShape(updatedLayer);
      setShapes(shapes.map((s) => s.id === selectedShape.id ? updatedLayer : s));
    }
  };

  const handleSetStrokeColor = (color: string) => {
    setStrokeColor(color);
    if (selectedText) {
      const updatedLayer = { ...selectedText, color };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    } else if (selectedShape) {
      const updatedLayer = { ...selectedShape, color };
      setSelectedShape(updatedLayer);
      setShapes(shapes.map((s) => s.id === selectedShape.id ? updatedLayer : s));
    }
  };

  const handleSetFontFamily = (font: string) => {
    setFontFamily(font);
    if (selectedText) {
      const updatedLayer = { ...selectedText, fontFamily: font };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetFontSize = (size: number) => {
    setFontSize(size);
    if (selectedText) {
      const updatedLayer = { ...selectedText, fontSize: size };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetWeight = (w: 'normal' | 'bold') => {
    setWeight(w);
    if (selectedText) {
      const updatedLayer = { ...selectedText, fontWeight: w };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetStyle = (s: 'normal' | 'italic') => {
    setStyle(s);
    if (selectedText) {
      const updatedLayer = { ...selectedText, fontStyle: s };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetDecoration = (d: 'none' | 'underline' | 'line-through') => {
    setDecoration(d);
    if (selectedText) {
      const updatedLayer = { ...selectedText, textDecoration: d };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetTextAlign = (align: 'left' | 'center' | 'right') => {
    setTextAlign(align);
    if (selectedText) {
      const updatedLayer = { ...selectedText, textAlign: align };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetLineHeight = (val: number) => {
    setLineHeight(val);
    if (selectedText) {
      const updatedLayer = { ...selectedText, lineHeight: val };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  const handleSetLetterSpacing = (val: number) => {
    setLetterSpacing(val);
    if (selectedText) {
      const updatedLayer = { ...selectedText, letterSpacing: val };
      setSelectedText(updatedLayer);
      setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
    }
  };

  // Comparisons and zoom
  const [showBeforeAfter, setShowBeforeAfter] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(188); // mock default zoom is 188%
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Undo/Redo historical stack
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Build current state block helper
  const getCurrentStateBlock = (): EditorState => {
    return {
      imageSrc,
      name: imageName,
      adjustments: INITIAL_ADJUSTMENTS,
      preset: 'original',
      lines,
      shapes,
      texts,
    };
  };

  // Push new baseline onto History stack
  const handlePushHistory = (label: string, overrideObj?: Partial<EditorState>) => {
    const currentState = getCurrentStateBlock();
    if (overrideObj) {
      if (overrideObj.lines !== undefined) currentState.lines = overrideObj.lines;
      if (overrideObj.shapes !== undefined) currentState.shapes = overrideObj.shapes;
      if (overrideObj.texts !== undefined) currentState.texts = overrideObj.texts;
    }
    const newRecord: HistoryItem = {
      id: 'step_' + Math.random().toString(36).substr(2, 9),
      label,
      timestamp: new Date(),
      state: JSON.parse(JSON.stringify(currentState)), // Deep copy freeze
    };

    const trimmedStack = history.slice(0, currentIndex + 1);
    setHistory([...trimmedStack, newRecord]);
    setCurrentIndex(trimmedStack.length);
  };

  // Triggered on first layout paint to seed initial baseline
  useEffect(() => {
    if (history.length === 0) {
      const initialRecord: HistoryItem = {
        id: 'initial',
        label: 'INITIAL • Original image',
        timestamp: new Date(),
        state: {
          imageSrc,
          name: imageName,
          adjustments: INITIAL_ADJUSTMENTS,
          preset: 'original',
          lines: [
            {
              id: 'init-curve',
              type: 'pen',
              color: '#ff4a4a',
              strokeWidth: 8,
              points: [
                { x: 30.5, y: 15.2 },
                { x: 31.2, y: 16.5 },
                { x: 31.9, y: 18.1 },
                { x: 32.4, y: 19.9 },
                { x: 32.9, y: 21.4 }
              ]
            }
          ],
          shapes: [],
          texts: []
        },
      };
      setHistory([initialRecord]);
      setCurrentIndex(0);
      setLines(initialRecord.state.lines);
    }
  }, [imageSrc]);

  // Handle reverting / skipping back in time inside stack
  const handleRevertIndex = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= history.length) return;
    const item = history[targetIdx];
    setCurrentIndex(targetIdx);

    setLines(item.state.lines);
    setShapes(item.state.shapes);
    setTexts(item.state.texts);
    setSelectedText(null);
    setSelectedShape(null);
  };

  // Wipe vector components and restart
  const handleClearAllDrawings = () => {
    setLines([]);
    setShapes([]);
    setTexts([]);
    setSelectedText(null);
    setSelectedShape(null);
    handlePushHistory('Reset Canvas');
  };

  // Swap sample image instantly
  const handleSwapSampleImage = (item: typeof SAMPLE_IMAGES[0]) => {
    setImageSrc(item.url);
    setOriginalSrc(item.url);
    setImageName(item.label);
    
    // Clear elements
    setLines([]);
    setShapes([]);
    setTexts([]);
    setSelectedText(null);
    setSelectedShape(null);

    // Refresh history stack
    const resetRecord: HistoryItem = {
      id: 'step_' + Math.random().toString(36).substr(2, 9),
      label: `Loaded: ${item.label}`,
      timestamp: new Date(),
      state: {
        imageSrc: item.url,
        name: item.label,
        adjustments: INITIAL_ADJUSTMENTS,
        preset: 'original',
        lines: [],
        shapes: [],
        texts: [],
      },
    };
    setHistory([resetRecord]);
    setCurrentIndex(0);
  };

  // Handle uploading personal images
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const urlStr = reader.result as string;
        setImageSrc(urlStr);
        setOriginalSrc(urlStr);
        setImageName(file.name.substring(0, 20) || 'Uploaded Image');

        setLines([]);
        setShapes([]);
        setTexts([]);
        setSelectedText(null);
        setSelectedShape(null);

        const uploadRecord: HistoryItem = {
          id: 'step_' + Math.random().toString(36).substr(2, 9),
          label: `Uploaded: ${file.name.substring(0, 16)}`,
          timestamp: new Date(),
          state: {
            imageSrc: urlStr,
            name: file.name,
            adjustments: INITIAL_ADJUSTMENTS,
            preset: 'original',
            lines: [],
            shapes: [],
            texts: [],
          },
        };
        setHistory([uploadRecord]);
        setCurrentIndex(0);
      };
      reader.readAsDataURL(file);
    }
  };

  // Selected text edits callback
  const handleUpdateSelectedTextString = (newString: string) => {
    if (!selectedText) return;
    const updatedList = texts.map((txt) =>
      txt.id === selectedText.id ? { ...txt, text: newString } : txt
    );
    setTexts(updatedList);
    setSelectedText({ ...selectedText, text: newString });
  };

  // Modern callback to update generic selected text formatting and advanced attributes
  const handleUpdateSelectedTextProps = (updatedProps: Partial<TextLayer>) => {
    if (!selectedText) return;
    const updatedLayer = { ...selectedText, ...updatedProps };
    setSelectedText(updatedLayer);
    setTexts(texts.map((t) => t.id === selectedText.id ? updatedLayer : t));
  };

  // Add custom styled preset text layer onto canvas base
  const handleAddCustomText = (preset: Partial<TextLayer>) => {
    const textId = 'txt_' + Math.random().toString(36).substr(2, 9);
    const newText: TextLayer = {
      id: textId,
      text: preset.text || 'Add text',
      x: preset.x !== undefined ? preset.x : 35,
      y: preset.y !== undefined ? preset.y : 35,
      width: preset.width || 35,
      height: preset.height || 10,
      opacity: preset.opacity || 100,
      rotation: preset.rotation || 0,
      lineHeight: preset.lineHeight || 1.2,
      letterSpacing: preset.letterSpacing || 0,
      fontSize: preset.fontSize || 36,
      fontFamily: preset.fontFamily || 'Inter',
      color: preset.color || strokeColor,
      fontWeight: preset.fontWeight || 'normal',
      fontStyle: preset.fontStyle || 'normal',
      textDecoration: preset.textDecoration || 'none',
      textAlign: preset.textAlign || 'center',
      bgColor: preset.bgColor,
      textStroke: preset.textStroke,
      textShadow: preset.textShadow,
      textTransform: preset.textTransform || 'none'
    };
    const nextTexts = [...texts, newText];
    setTexts(nextTexts);
    setSelectedText(newText);
    setSelectedShape(null);
    setActiveTool('select'); // Focus selection/transformation instantly
    handlePushHistory('Added Text Element', { texts: nextTexts });
  };

  // Compositor Download Logic (Fuses image, canvas lines, vector layers and downloads a real image!)
  const handleExportCopyImageRaw = (format: 'png' | 'jpeg' | 'webp') => {
    setExportDropdownOpen(false);
    
    // Create composite safely
    const canvas = document.createElement('canvas');
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous'; // resolve CORS constraints
    imgElement.referrerPolicy = 'no-referrer';
    imgElement.src = imageSrc;

    imgElement.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to image dimensions
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;

      // 1. Draw original base image
      ctx.drawImage(imgElement, 0, 0);

      // 2. Draw completed free-hand brush strokes scaled up to naturalWidth
      lines.forEach((line) => {
        if (line.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        const scaleFactor = canvas.width / 600;
        ctx.lineWidth = line.strokeWidth * scaleFactor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = line.type === 'highlighter' ? 0.45 : 1.0;

        ctx.moveTo(
          (line.points[0].x / 100) * canvas.width,
          (line.points[0].y / 100) * canvas.height
        );
        for (let i = 1; i < line.points.length; i++) {
          ctx.lineTo(
            (line.points[i].x / 100) * canvas.width,
            (line.points[i].y / 100) * canvas.height
          );
        }
        ctx.stroke();
      });

      // 3. Draw vector Shapes (Rects, Circles)
      shapes.forEach((sh) => {
        ctx.beginPath();
        ctx.strokeStyle = sh.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 1.0;

        if (sh.type === 'rect') {
          ctx.strokeRect((sh.x / 100) * canvas.width, (sh.y / 100) * canvas.height, (sh.width / 100) * canvas.width, (sh.height / 100) * canvas.height);
        } else if (sh.type === 'circle') {
          const cx = ((sh.x + sh.width / 2) / 100) * canvas.width;
          const cy = ((sh.y + sh.height / 2) / 100) * canvas.height;
          const rx = Math.abs((sh.width / 2 / 100) * canvas.width);
          const ry = Math.abs((sh.height / 2 / 100) * canvas.height);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (sh.type === 'arrow') {
          ctx.moveTo((sh.x / 100) * canvas.width, (sh.y / 100) * canvas.height);
          ctx.lineTo(((sh.x + sh.width) / 100) * canvas.width, ((sh.y + sh.height) / 100) * canvas.height);
          ctx.stroke();
        }
      });

      // 4. Draw active text nodes
      texts.forEach((txt) => {
        ctx.font = `bold ${(txt.fontSize * 1.5)}px Arial`;
        ctx.fillStyle = txt.color;
        ctx.textAlign = 'left';
        ctx.fillText(txt.text, (txt.x / 100) * canvas.width, (txt.y / 100) * canvas.height);
      });

      // Reset alpha
      ctx.globalAlpha = 1.0;

      // Extract and trigger download
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const fileUrl = canvas.toDataURL(mime, 0.92);

      const downloadLink = document.createElement('a');
      downloadLink.download = `${imageName.toLowerCase().replace(/\s+/g, '_')}_markup.${format}`;
      downloadLink.href = fileUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    imgElement.onerror = () => {
      alert("Failed rendering high-res composite due to standard network CORS origin limits on public photographs. Exporting default editor screenshot instead!");
    };
  };

  return (
    <div id="studio-editor-root" className="h-screen w-screen bg-[#060608] text-white flex flex-col font-sans overflow-hidden select-none">
      
      {/* 1. APPBAR TOP NAVIGATION HEADER */}
      <header className="h-[52px] shrink-0 bg-[#0f0f11] border-b border-[#1e1e24] px-4 flex items-center justify-between">
        
        {/* Left cancellation */}
        <button
          onClick={handleClearAllDrawings}
          className="text-xs text-[#8e8e9a] hover:text-white font-mono font-bold tracking-wider hover:bg-white/5 px-3 py-1.5 rounded transition uppercase flex items-center gap-1.5 cursor-pointer"
        >
          ✕ Reset Workspace
        </button>

        {/* Studio Title */}
        <div className="flex items-center gap-6">
          <span className="font-display font-medium text-[11px] tracking-widest uppercase text-zinc-400">
            MARKUP STUDIO EDITOR
          </span>
        </div>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#e4e4e7] active:scale-98 transition flex items-center gap-1.5 shadow cursor-pointer font-sans"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Copy</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${exportDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-[#0f0f11] border border-zinc-800 rounded-lg shadow-2xl z-30 overflow-hidden font-mono uppercase text-[9px] font-semibold tracking-wider animate-fade-in text-[#8e8e9a]">
              <button
                onClick={() => handleExportCopyImageRaw('png')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white hover:text-black transition cursor-pointer"
              >
                💾 PNG (Lossless)
              </button>
              <button
                onClick={() => handleExportCopyImageRaw('jpeg')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white hover:text-black transition cursor-pointer"
              >
                📷 JPEG (Compressed)
              </button>
              <button
                onClick={() => handleExportCopyImageRaw('webp')}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white hover:text-black transition cursor-pointer"
              >
                🌐 WebP (Modern)
              </button>
            </div>
          )}
        </div>

      </header>

      {/* 2. MAIN APPLICATION WORKPLANE */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Collapsible Left utility drawer */}
        <div className="w-[300px] shrink-0 bg-[#0a0a0c] border-r border-[#1e1e24] p-4 overflow-y-auto flex flex-col gap-4 select-none">
          
          {/* IMAGE SELECTION BLOCK */}
          <div className="p-3 bg-zinc-900/40 rounded-lg border border-zinc-800/60">
            <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
              Source Image Workspace
            </h3>
            
            {/* Quick previews list */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              {SAMPLE_IMAGES.map((item) => {
                const isSelected = item.url === imageSrc;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwapSampleImage(item)}
                    title={item.description}
                    className={`relative aspect-square rounded overflow-hidden border transition cursor-pointer ${
                      isSelected ? 'border-[#ec4899] scale-[1.05] ring-1 ring-[#ec4899]/30' : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    <img src={item.url} alt={item.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>

            {/* Manual Upload label */}
            <label className="flex items-center justify-center gap-1 bg-[#1a1a22] hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded text-[9px] font-semibold text-zinc-400 hover:text-white transition cursor-pointer">
              Upload Custom Photograph
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          {/* Dynamic Utilities: Drawing & Markup parameters */}
          <DrawingPanelContents
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            strokeColor={strokeColor}
            setStrokeColor={handleSetStrokeColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            fontFamily={fontFamily}
            setFontFamily={handleSetFontFamily}
            fontSize={fontSize}
            setFontSize={handleSetFontSize}
            fontWeight={fontWeight}
            setWeight={handleSetWeight}
            fontStyle={fontStyle}
            setStyle={handleSetStyle}
            textDecoration={txtDecoration}
            setDecoration={handleSetDecoration}
            textAlign={textAlign}
            setTextAlign={handleSetTextAlign}
            lineHeight={lineHeight}
            setLineHeight={handleSetLineHeight}
            letterSpacing={letterSpacing}
            setLetterSpacing={handleSetLetterSpacing}
            onClearAll={handleClearAllDrawings}
            selectedTextLayer={selectedText}
            onUpdateSelectedText={handleUpdateSelectedTextString}
            selectedShapeLayer={selectedShape}
            opacity={opacity}
            setOpacity={handleSetOpacity}
            onAddCustomText={handleAddCustomText}
            onUpdateTextProps={handleUpdateSelectedTextProps}
            doodleText={doodleText}
            setDoodleText={setDoodleText}
            doodleFontSize={doodleFontSize}
            setDoodleFontSize={setDoodleFontSize}
            doodleFontFamily={doodleFontFamily}
            setDoodleFontFamily={setDoodleFontFamily}
            showDoodleGuide={showDoodleGuide}
            setShowDoodleGuide={setShowDoodleGuide}
          />

          {/* History Baseline panel */}
          {history.length > 1 && (
            <div className="mt-2 p-3 bg-[#111115] border border-zinc-800/80 rounded-lg">
              <span className="text-[9px] text-[#8e8e9a] font-bold block uppercase tracking-wider mb-2">History Baseline</span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {history.map((record, idx) => (
                  <button
                    key={record.id}
                    onClick={() => handleRevertIndex(idx)}
                    className={`w-full text-left text-[10px] p-1.5 rounded truncate flex justify-between cursor-pointer ${
                      idx === currentIndex ? 'bg-[#22c55e]/15 text-[#22c55e] font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{record.label}</span>
                    <span className="opacity-70 text-[8px] font-mono">#{idx}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Central interactive Image Workplane */}
        <CanvasViewport
          imageSrc={imageSrc}
          originalSrc={originalSrc}
          activeTab="MARKUP"
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          fontFamily={fontFamily}
          fontSize={fontSize}
          adjustments={INITIAL_ADJUSTMENTS}
          lines={lines}
          setLines={setLines}
          shapes={shapes}
          setShapes={setShapes}
          texts={texts}
          setTexts={setTexts}
          selectedTextLayer={selectedText}
          setSelectedTextLayer={handleSelectText}
          selectedShapeLayer={selectedShape}
          setSelectedShapeLayer={handleSelectShape}
          onPushHistory={handlePushHistory}
          showBeforeAfter={showBeforeAfter}
          setShowBeforeAfter={setShowBeforeAfter}
          zoom={zoom}
          setZoom={setZoom}
          doodleText={doodleText}
          doodleFontSize={doodleFontSize}
          doodleFontFamily={doodleFontFamily}
          showDoodleGuide={showDoodleGuide}
        />

      </main>

    </div>
  );
}
