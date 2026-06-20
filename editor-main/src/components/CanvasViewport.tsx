import { useState, useRef, useEffect, MouseEvent } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, AlertCircle, Compass } from 'lucide-react';
import {
  ActiveSidebarTab,
  DrawingTool,
  DrawingLine,
  VectorShape,
  TextLayer,
  ImageAdjustments,
  Point,
} from '../types';

interface CanvasViewportProps {
  imageSrc: string;
  originalSrc: string; // original, pure image
  activeTab: ActiveSidebarTab;
  activeTool: DrawingTool;
  setActiveTool: (tool: DrawingTool) => void;
  strokeColor: string;
  strokeWidth: number;
  fontFamily: string;
  fontSize: number;
  adjustments: ImageAdjustments;
  lines: DrawingLine[];
  setLines: (lines: DrawingLine[]) => void;
  shapes: VectorShape[];
  setShapes: (shapes: VectorShape[]) => void;
  texts: TextLayer[];
  setTexts: (texts: TextLayer[]) => void;
  selectedTextLayer: TextLayer | null;
  setSelectedTextLayer: (txt: TextLayer | null) => void;
  selectedShapeLayer?: VectorShape | null;
  setSelectedShapeLayer?: (sh: VectorShape | null) => void;
  onPushHistory: (label: string) => void;
  showBeforeAfter: boolean;
  setShowBeforeAfter: (val: boolean) => void;
  zoom: number;
  setZoom: (val: number) => void;
  doodleText?: string;
  doodleFontSize?: number;
  doodleFontFamily?: string;
  showDoodleGuide?: boolean;
}

// Helper function to dynamically draw text along an arbitrary curving path with vector style physics
function drawTextAlongPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  text: string,
  fontFamily: string,
  fontSize: number,
  color: string,
  canvasWidth: number,
  canvasHeight: number,
  showGuidePath: boolean
) {
  if (points.length < 2) return;
  const word = text || 'peace in the air';

  // Map 0-100 percentage coordinates to physical pixel dimensions
  const pixelPoints = points.map((pt) => ({
    x: (pt.x / 100) * canvasWidth,
    y: (pt.y / 100) * canvasHeight,
  }));

  ctx.save();

  // Draw 1px guide wire curve if enabled
  if (showGuidePath) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.25;
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) {
      ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    }
    ctx.stroke();
    // Reset alpha for text rendering
    ctx.globalAlpha = 1.0;
  }

  // Pre-load typography styles
  ctx.font = `500 ${fontSize}px "${fontFamily || 'Space Grotesk'}", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Cache segments lengths in pixels
  const lengths: number[] = [0];
  let accumulatedDist = 0;
  for (let i = 1; i < pixelPoints.length; i++) {
    const dx = pixelPoints[i].x - pixelPoints[i - 1].x;
    const dy = pixelPoints[i].y - pixelPoints[i - 1].y;
    accumulatedDist += Math.sqrt(dx * dx + dy * dy);
    lengths.push(accumulatedDist);
  }

  // Linear Interpolates coordinates and heading angle along a curved lines path
  const interpolateAlongPath = (d: number): { x: number; y: number; angle: number } | null => {
    if (d < 0 || d > accumulatedDist) return null;
    let idx = 0;
    while (idx < lengths.length - 1 && lengths[idx + 1] < d) {
      idx++;
    }
    const startL = lengths[idx];
    const endL = lengths[idx + 1];
    if (startL === endL) return null;

    const t = (d - startL) / (endL - startL);
    const p1 = pixelPoints[idx];
    const p2 = pixelPoints[idx + 1];

    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
      angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
    };
  };

  let currentDistOnPath = 4; // micro-margin at first point
  let letterIndex = 0;

  while (currentDistOnPath < accumulatedDist) {
    const char = word[letterIndex % word.length];
    // Safeguard character widths calculations
    const charWidth = ctx.measureText(char).width || fontSize * 0.55;

    const targetPositionOnPath = currentDistOnPath + charWidth / 2;
    const interp = interpolateAlongPath(targetPositionOnPath);
    if (!interp) break;

    ctx.save();
    ctx.translate(interp.x, interp.y);
    ctx.rotate(interp.angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();

    currentDistOnPath += charWidth + 2.5; // letter spacing padding
    letterIndex++;
  }

  ctx.restore();
}

export default function CanvasViewport({
  imageSrc,
  originalSrc,
  activeTab,
  activeTool,
  setActiveTool,
  strokeColor,
  strokeWidth,
  fontFamily,
  fontSize,
  adjustments,
  lines,
  setLines,
  shapes,
  setShapes,
  texts,
  setTexts,
  selectedTextLayer,
  setSelectedTextLayer,
  selectedShapeLayer = null,
  setSelectedShapeLayer,
  onPushHistory,
  showBeforeAfter,
  setShowBeforeAfter,
  zoom,
  setZoom,
  doodleText = 'peace in the air',
  doodleFontSize = 18,
  doodleFontFamily = 'Space Grotesk',
  showDoodleGuide = true,
}: CanvasViewportProps) {

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  // States for interaction
  const [isDrawing, setIsDrawing] = useState(false);
  const [showDoodleToast, setShowDoodleToast] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'text' | 'shape'; offset: Point } | null>(null);

  // Split-slider position (0 to 100)
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Dynamic coordinates for shapes during drag creation
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [tempShape, setTempShape] = useState<VectorShape | null>(null);

  // Text Box Resizing control states
  const [resizingLayerId, setResizingLayerId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStartGeo, setResizeStartGeo] = useState<{ x: number; y: number; width: number; height: number; mouseStart: { x: number; y: number } } | null>(null);

  // Text Box Rotation control states
  const [rotatingLayerId, setRotatingLayerId] = useState<string | null>(null);
  const rotateStartRef = useRef<{ centerX: number; centerY: number; startRotation: number; startAngleRad: number } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const ignoreNextMouseDownRef = useRef(false);

  // Track image container dimensions for relative positioning
  const [viewportDims, setViewportDims] = useState({ width: 600, height: 450 });

  // Recalculate dimensions
  useEffect(() => {
    if (imageRef.current) {
      const handleLoad = () => {
        setViewportDims({
          width: imageRef.current?.clientWidth || 600,
          height: imageRef.current?.clientHeight || 450,
        });
      };
      imageRef.current.addEventListener('load', handleLoad);
      // Run once immediately in case image is already cached
      handleLoad();
      return () => imageRef.current?.removeEventListener('load', handleLoad);
    }
  }, [imageSrc, zoom, adjustments.rotation]);

  // Fit image to viewport helper
  const handleResetView = () => {
    setZoom(100);
    setPanOffset({ x: 0, y: 0 });
  };

  // Redraw SVG freehand drawing lines on canvas
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed lines
    lines.forEach((line) => {
      if (line.points.length < 2) return;

      if (line.type === 'textPath') {
        const dText = line.doodleText || doodleText;
        const dFontSize = line.fontSize || doodleFontSize;
        const dFontFamily = line.fontFamily || doodleFontFamily;
        const dShowGuide = line.showGuidePath !== undefined ? line.showGuidePath : showDoodleGuide;

        drawTextAlongPath(
          ctx,
          line.points,
          dText,
          dFontFamily,
          dFontSize,
          line.color,
          canvas.width,
          canvas.height,
          dShowGuide
        );
      } else {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Highlighter translucency
        if (line.type === 'highlighter') {
          ctx.globalAlpha = 0.45;
        } else {
          ctx.globalAlpha = 1.0;
        }

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
      }
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Draw active drawing line
    if (isDrawing && currentPoints.length > 1) {
      if (activeTool === 'textPath') {
        drawTextAlongPath(
          ctx,
          currentPoints,
          doodleText,
          doodleFontFamily,
          doodleFontSize,
          strokeColor,
          canvas.width,
          canvas.height,
          showDoodleGuide
        );
      } else {
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (activeTool === 'highlighter') {
          ctx.globalAlpha = 0.45;
        } else {
          ctx.globalAlpha = 1.0;
        }

        ctx.moveTo(
          (currentPoints[0].x / 100) * canvas.width,
          (currentPoints[0].y / 100) * canvas.height
        );

        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(
            (currentPoints[i].x / 100) * canvas.width,
            (currentPoints[i].y / 100) * canvas.height
          );
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }
  }, [
    lines,
    currentPoints,
    isDrawing,
    strokeColor,
    strokeWidth,
    activeTool,
    viewportDims,
    doodleText,
    doodleFontSize,
    doodleFontFamily,
    showDoodleGuide,
  ]);


  // Capture Event coordinates relative to the Image Container
  const getCoordinates = (e: MouseEvent<HTMLDivElement>): Point => {
    const boundingBox = imageRef.current?.getBoundingClientRect();
    if (!boundingBox) return { x: 0, y: 0 };

    // Coordinates in percentage (0 to 100 scale relative to loaded image dimensions)
    const px = ((e.clientX - boundingBox.left) / boundingBox.width) * 100;
    const py = ((e.clientY - boundingBox.top) / boundingBox.height) * 100;
    return { x: px, y: py };
  };

  const handleResizeMouseDown = (e: MouseEvent, handle: string, item: TextLayer) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingLayerId(item.id);
    setResizeHandle(handle);
    setResizeStartGeo({
      x: item.x,
      y: item.y,
      width: item.width || 25,
      height: item.height || 8,
      mouseStart: { x: e.clientX, y: e.clientY }
    });
  };

  const handleRotateMouseDown = (e: MouseEvent, item: TextLayer) => {
    e.stopPropagation();
    e.preventDefault();
    setRotatingLayerId(item.id);
    setIsRotating(true);
    setSelectedTextLayer(item);
    setSelectedShapeLayer && setSelectedShapeLayer(null);

    const el = document.getElementById(`text-layer-${item.id}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cX = rect.left + rect.width / 2;
      const cY = rect.top + rect.height / 2;
      const startAngleRad = Math.atan2(e.clientY - cY, e.clientX - cX);
      rotateStartRef.current = {
        centerX: cX,
        centerY: cY,
        startRotation: item.rotation || 0,
        startAngleRad,
      };
    }
  };

  // Handles Double Click anywhere on the image workplane to invoke Text Path Doodle
  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Guard: ignore the mouseDown that precedes this dblclick so it doesn't create a stray text layer
    ignoreNextMouseDownRef.current = true;

    // Select/activate the Text Path Doodle tool
    setActiveTool('textPath');

    // Trigger standard canvas history notification or visual toast
    setShowDoodleToast(true);
    setTimeout(() => {
      setShowDoodleToast(false);
    }, 4500);
  };

  // Handles Canvas Mouse Down trigger
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Guard: skip this mousedown if it's the one that preceded a dblclick (prevents double text creation)
    if (ignoreNextMouseDownRef.current) {
      ignoreNextMouseDownRef.current = false;
      return;
    }

    // If middle mouse button was clicked, always allow panning
    if (e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
      return;
    }

    const coords = getCoordinates(e);

    // 1. CHOOSE ACTION BY ACTIVE TOOL
    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'textPath') {
      setIsDrawing(true);
      setCurrentPoints([coords]);
    } else if (['rect', 'circle', 'arrow'].includes(activeTool)) {
      setShapeStart(coords);
      setTempShape({
        id: 'temp',
        type: activeTool as any,
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: strokeColor,
        strokeWidth: Math.max(2, strokeWidth / 2),
      });
    } else if (activeTool === 'select') {
      // Check if user clicked a Text layer
      const clickedText = texts.find((txt) => {
        const w = txt.width || 25;
        const h = txt.height || 8;
        return coords.x >= txt.x && coords.x <= txt.x + w &&
               coords.y >= txt.y && coords.y <= txt.y + h;
      });

      if (clickedText) {
        setSelectedTextLayer(clickedText);
        setSelectedShapeLayer && setSelectedShapeLayer(null);
        setDraggedItem({
          id: clickedText.id,
          type: 'text',
          offset: { x: coords.x - clickedText.x, y: coords.y - clickedText.y },
        });
        return;
      }

      // Check if user clicked a Vector shape
      const clickedShape = shapes.find((sh) => {
        const isX = coords.x >= sh.x && coords.x <= sh.x + sh.width;
        const isY = coords.y >= sh.y && coords.y <= sh.y + sh.height;
        return isX && isY;
      });

      if (clickedShape) {
        setSelectedShapeLayer && setSelectedShapeLayer(clickedShape);
        setSelectedTextLayer(null);
        setDraggedItem({
          id: clickedShape.id,
          type: 'shape',
          offset: { x: coords.x - clickedShape.x, y: coords.y - clickedShape.y },
        });
        return;
      }

      // If they clicked on the background empty space of the canvas, deselect active layers
      setSelectedTextLayer(null);
      setSelectedShapeLayer && setSelectedShapeLayer(null);

      // And allow panning if they click and drag on the main background image
      if ((e.target as HTMLElement).tagName === 'IMG') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        e.preventDefault();
      }
    } else if (activeTool === 'text') {
      // Add custom Text node immediately at coordinates
      const textId = 'txt_' + Math.random().toString(36).substr(2, 9);
      const newText: TextLayer = {
        id: textId,
        text: 'Insert text',
        x: coords.x,
        y: coords.y,
        width: 25,
        height: 10,
        opacity: 100,
        rotation: 0,
        lineHeight: 1.2,
        letterSpacing: 0,
        fontSize: fontSize,
        fontFamily: fontFamily,
        color: strokeColor,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'center',
      };
      setTexts([...texts, newText]);
      setSelectedTextLayer(newText);
      setSelectedShapeLayer && setSelectedShapeLayer(null);
      setActiveTool('select'); // automatically trigger focus
      onPushHistory('Added Text Layer');
    }
  };

  // Canvas Mouse Move handler
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    // Handle Text Box rotating
    if (rotatingLayerId && rotateStartRef.current) {
      const { centerX, centerY, startRotation, startAngleRad } = rotateStartRef.current;
      const currentAngleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const angleDeltaRad = currentAngleRad - startAngleRad;
      const angleDeltaDeg = angleDeltaRad * (180 / Math.PI);
      
      let nextRotation = Math.round(startRotation + angleDeltaDeg);
      nextRotation = (nextRotation + 360) % 360;

      setTexts(
        texts.map((txt) =>
          txt.id === rotatingLayerId ? { ...txt, rotation: nextRotation } : txt
        )
      );

      if (selectedTextLayer && selectedTextLayer.id === rotatingLayerId) {
        setSelectedTextLayer({
          ...selectedTextLayer,
          rotation: nextRotation,
        });
      }
      return;
    }

    // Handle Text Box resizing
    if (resizingLayerId && resizeHandle && resizeStartGeo) {
      const boundingBox = imageRef.current?.getBoundingClientRect();
      if (boundingBox) {
        const deltaPxX = e.clientX - resizeStartGeo.mouseStart.x;
        const deltaPxY = e.clientY - resizeStartGeo.mouseStart.y;
        
        // Convert screen delta (pixels) to coordinates in percentage (0 to 100 scale relative to loaded image dimensions)
        const deltaPercentX = (deltaPxX / boundingBox.width) * 100;
        const deltaPercentY = (deltaPxY / boundingBox.height) * 100;

        let newX = resizeStartGeo.x;
        let newY = resizeStartGeo.y;
        let newWidth = resizeStartGeo.width;
        let newHeight = resizeStartGeo.height;

        if (resizeHandle === 'br') {
          newWidth = Math.max(5, resizeStartGeo.width + deltaPercentX);
          newHeight = Math.max(3, resizeStartGeo.height + deltaPercentY);
        } else if (resizeHandle === 'rm') {
          newWidth = Math.max(5, resizeStartGeo.width + deltaPercentX);
        } else if (resizeHandle === 'bl') {
          const targetWidth = resizeStartGeo.width - deltaPercentX;
          if (targetWidth > 5) {
            newX = resizeStartGeo.x + deltaPercentX;
            newWidth = targetWidth;
          }
          newHeight = Math.max(3, resizeStartGeo.height + deltaPercentY);
        } else if (resizeHandle === 'lm') {
          const targetWidth = resizeStartGeo.width - deltaPercentX;
          if (targetWidth > 5) {
            newX = resizeStartGeo.x + deltaPercentX;
            newWidth = targetWidth;
          }
        } else if (resizeHandle === 'tr') {
          newWidth = Math.max(5, resizeStartGeo.width + deltaPercentX);
          const targetHeight = resizeStartGeo.height - deltaPercentY;
          if (targetHeight > 3) {
            newY = resizeStartGeo.y + deltaPercentY;
            newHeight = targetHeight;
          }
        } else if (resizeHandle === 'tl') {
          const targetWidth = resizeStartGeo.width - deltaPercentX;
          if (targetWidth > 5) {
            newX = resizeStartGeo.x + deltaPercentX;
            newWidth = targetWidth;
          }
          const targetHeight = resizeStartGeo.height - deltaPercentY;
          if (targetHeight > 3) {
            newY = resizeStartGeo.y + deltaPercentY;
            newHeight = targetHeight;
          }
        }

        setTexts(
          texts.map((txt) =>
            txt.id === resizingLayerId
              ? { ...txt, x: newX, y: newY, width: newWidth, height: newHeight }
              : txt
          )
        );

        if (selectedTextLayer && selectedTextLayer.id === resizingLayerId) {
          setSelectedTextLayer({
            ...selectedTextLayer,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        }
      }
      return;
    }

    const coords = getCoordinates(e);

    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'textPath')) {
      setCurrentPoints([...currentPoints, coords]);
    } else if (shapeStart && tempShape) {
      const width = coords.x - shapeStart.x;
      const height = coords.y - shapeStart.y;
      setTempShape({
        ...tempShape,
        width: width,
        height: height,
      });
    } else if (draggedItem && activeTool === 'select') {
      if (draggedItem.type === 'text') {
        const wVal = selectedTextLayer?.width || 25;
        const hVal = selectedTextLayer?.height || 8;
        // Check image boundaries to restrict dragging outside
        const nextX = Math.max(0, Math.min(100 - wVal, coords.x - draggedItem.offset.x));
        const nextY = Math.max(0, Math.min(100 - hVal, coords.y - draggedItem.offset.y));
        
        setTexts(
          texts.map((txt) =>
            txt.id === draggedItem.id
              ? { ...txt, x: nextX, y: nextY }
              : txt
          )
        );

        if (selectedTextLayer && selectedTextLayer.id === draggedItem.id) {
          setSelectedTextLayer({
            ...selectedTextLayer,
            x: nextX,
            y: nextY,
          });
        }
      } else if (draggedItem.type === 'shape') {
        const itemW = selectedShapeLayer?.width || 10;
        const itemH = selectedShapeLayer?.height || 10;
        const nextX = Math.max(0, Math.min(100 - itemW, coords.x - draggedItem.offset.x));
        const nextY = Math.max(0, Math.min(100 - itemH, coords.y - draggedItem.offset.y));

        setShapes(
          shapes.map((sh) =>
            sh.id === draggedItem.id
              ? { ...sh, x: nextX, y: nextY }
              : sh
          )
        );

        if (selectedShapeLayer && selectedShapeLayer.id === draggedItem.id) {
          setSelectedShapeLayer && setSelectedShapeLayer({
            ...selectedShapeLayer,
            x: nextX,
            y: nextY,
          });
        }
      }
    }
  };

  // Canvas Mouse Up handler
  const handleMouseUp = () => {
    if (rotatingLayerId) {
      setRotatingLayerId(null);
      rotateStartRef.current = null;
      onPushHistory('Rotated text overlay angle');
      return;
    }

    if (resizingLayerId) {
      setResizingLayerId(null);
      setResizeHandle(null);
      setResizeStartGeo(null);
      onPushHistory('Resized text overlay bounds');
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'textPath')) {
      const lineId = 'line_' + Math.random().toString(36).substr(2, 9);
      const newLine: DrawingLine = {
        id: lineId,
        type: activeTool === 'textPath' ? 'textPath' : (activeTool === 'highlighter' ? 'highlighter' : 'pen'),
        color: strokeColor,
        strokeWidth: strokeWidth,
        points: currentPoints,
        doodleText: activeTool === 'textPath' ? doodleText : undefined,
        fontSize: activeTool === 'textPath' ? doodleFontSize : undefined,
        fontFamily: activeTool === 'textPath' ? doodleFontFamily : undefined,
        showGuidePath: activeTool === 'textPath' ? showDoodleGuide : undefined,
      };
      setLines([...lines, newLine]);
      setIsDrawing(false);
      setCurrentPoints([]);
      onPushHistory(activeTool === 'textPath' ? 'Scribbled Text Path Doodle' : `Drew with ${activeTool}`);
    } else if (shapeStart && tempShape) {
      // Normalise coordinates if drawn backwards
      const x = tempShape.width < 0 ? tempShape.x + tempShape.width : tempShape.x;
      const y = tempShape.height < 0 ? tempShape.y + tempShape.height : tempShape.y;
      const width = Math.abs(tempShape.width);
      const height = Math.abs(tempShape.height);

      const shapeId = 'sh_' + Math.random().toString(36).substr(2, 9);
      const finalShape: VectorShape = {
        ...tempShape,
        id: shapeId,
        x,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height),
        opacity: 100, // initialized at full opacity
      };

      setShapes([...shapes, finalShape]);
      setShapeStart(null);
      setTempShape(null);
      onPushHistory(`Added Shape: ${tempShape.type}`);
    } else if (draggedItem) {
      setDraggedItem(null);
      onPushHistory('Moved canvas overlay');
    }
  };

  // Trigger element erasure or deletion
  const handleElementClick = (layerId: string, type: 'text' | 'shape') => {
    if (activeTool === 'eraser') {
      if (type === 'text') {
        setTexts(texts.filter((t) => t.id !== layerId));
        if (selectedTextLayer?.id === layerId) setSelectedTextLayer(null);
      } else {
        setShapes(shapes.filter((s) => s.id !== layerId));
      }
      onPushHistory(`Erased canvas element`);
    }
  };

  // Build custom inline adjustments CSS filter string
  const getFilterCSS = () => {
    const { brightness, contrast, saturation, blur, sharpness } = adjustments;
    let filters = '';
    filters += `brightness(${brightness + 100}%) `;
    filters += `contrast(${contrast + 100}%) `;
    filters += `saturate(${saturation + 100}%) `;
    if (blur > 0) filters += `blur(${blur / 3}px) `;
    if (sharpness > 0) filters += `contrast(${100 + sharpness / 2}%) brightness(${100 - sharpness / 20}%) `;
    return filters.trim();
  };

  // Drag overlay slider control
  const handleSplitDrag = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSplit || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.max(0, Math.min(100, pos)));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleSplitDrag}
      onMouseUp={() => setIsDraggingSplit(false)}
      onMouseDown={(e) => {
        if (e.target === containerRef.current) {
          setSelectedTextLayer(null);
          setSelectedShapeLayer && setSelectedShapeLayer(null);
        }
      }}
      className="flex-1 min-h-0 bg-[#060608] relative flex flex-col items-center justify-center p-4 overflow-hidden select-none"
    >

      {/* Dynamic Doodle Activation Toast */}
      {showDoodleToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#14141a] border border-zinc-800 px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-2xl animate-bounce">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <p className="text-white text-xs font-semibold tracking-wide flex items-center gap-1">
            ✍️ Text Doodle Activated: <span className="text-[#22c55e] font-mono font-bold">"{doodleText}"</span>. Drag on image to start!
          </p>
        </div>
      )}
      
      {/* ZOOM & PAN WRAPPER */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
          transition: isPanning ? 'none' : 'transform 0.15s cubic-bezier(0.16,1,0.3,1)',
          cursor: isPanning ? 'grabbing' : ['pen', 'highlighter', 'textPath'].includes(activeTool) ? 'crosshair' : 'default',
        }}
        className="relative shadow-2xl shadow-black/80 origin-center transition-transform shrink-0"
      >
        
        {/* POLAROID FRAME AND OTHER BESPOKE BOXES CONTAINER */}
        <div
          style={{
            transform: `rotate(${adjustments.rotation}deg) scaleX(${adjustments.flipH ? -1 : 1}) scaleY(${adjustments.flipV ? -1 : 1})`,
            padding: adjustments.frameStyle === 'polaroid' ? '16px 16px 64px 16px' : adjustments.frameStyle === 'white' || adjustments.frameStyle === 'black' ? '20px' : '0px',
            backgroundColor: adjustments.frameStyle === 'polaroid' || adjustments.frameStyle === 'white' ? '#ffffff' : adjustments.frameStyle === 'black' ? '#111111' : adjustments.frameStyle === 'wood' ? '#8B5A2B' : 'transparent',
            border: adjustments.frameStyle === 'wood' ? '12px outset #5C3815' : adjustments.frameStyle === 'neon' ? '3px solid #06b6d4' : 'none',
            borderRadius: adjustments.frameStyle === 'rounded' ? '32px' : '0px',
            boxShadow: adjustments.frameStyle === 'neon' ? '0 0 15px rgba(6,182,212,0.6)' : 'none',
            overflow: adjustments.frameStyle === 'rounded' ? 'hidden' : 'visible'
          }}
          className="relative transition-all duration-300"
        >

          {/* DYNAMIC COMPARISON SPLIT VIEWER */}
          <div className="relative overflow-hidden" style={{ width: viewportDims.width, height: viewportDims.height }}>
            
            {/* BEFORE RAW ORIGINAL IMAGE (LEFT SLIDE MASK) */}
            {showBeforeAfter && (
              <div
                style={{ width: `${splitPos}%` }}
                className="absolute left-0 top-0 h-full z-15 overflow-hidden transition-all border-r-2 border-pink-500"
              >
                <img
                  src={originalSrc}
                  alt="Original Image"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  style={{ width: viewportDims.width, height: viewportDims.height, maxWidth: 'none', objectFit: 'cover' }}
                />
                
                {/* BEFORE TAG SHROUD */}
                <div className="absolute top-2 left-2 bg-black/70 px-1.5 py-0.5 rounded text-[8px] tracking-widest text-[#a1a1aa] uppercase font-bold z-20">
                  RAW ORIGINAL
                </div>
              </div>
            )}

            {/* SPLID DRAG LINE BUTTON TRIGGER */}
            {showBeforeAfter && (
              <div
                style={{ left: `${splitPos}%` }}
                onMouseDown={(e) => {
                  setIsDraggingSplit(true);
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="absolute top-0 bottom-0 w-8 -ml-4 z-20 cursor-col-resize flex flex-col justify-center items-center group"
              >
                <div className="w-1.5 h-full bg-pink-500 rounded transition group-hover:scale-x-125 select-none" />
                <div className="absolute w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold shadow shadow-black">
                  ↔
                </div>
              </div>
            )}

            {/* MAIN ADJUSTED IMAGE */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Active Canvas"
              draggable={false}
              referrerPolicy="no-referrer"
              style={{
                filter: getFilterCSS(),
                width: zoom > 100 ? 'auto' : '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
              }}
              className="block relative shadow"
            />

            {/* OVERLAYS */}

            {/* A. Radial vignette shade */}
            {adjustments.vignette > 0 && (
              <div
                style={{
                  background: `radial-gradient(ellipse, rgba(0,0,0,0) 35%, rgba(0,0,0, ${adjustments.vignette / 125}) 100%)`,
                }}
                className="absolute inset-0 pointer-events-none z-1"
              />
            )}

            {/* B. Analog grain noise layer */}
            {adjustments.grain > 0 && (
              <div
                style={{
                  opacity: adjustments.grain / 120,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
                className="absolute inset-0 pointer-events-none mix-blend-overlay z-2"
              />
            )}

            {/* C. Light leak overlay */}
            {adjustments.leakIntensity > 0 && (
              <div
                style={{
                  opacity: adjustments.leakIntensity / 100,
                  background: adjustments.leakPosition === 'left'
                    ? `linear-gradient(to right, ${adjustments.leakColor}, transparent 55%)`
                    : adjustments.leakPosition === 'right'
                    ? `linear-gradient(to left, ${adjustments.leakColor}, transparent 55%)`
                    : adjustments.leakPosition === 'top'
                    ? `linear-gradient(to bottom, ${adjustments.leakColor}, transparent 55%)`
                    : `linear-gradient(to top, ${adjustments.leakColor}, transparent 55%)`,
                }}
                className="absolute inset-0 pointer-events-none mix-blend-screen z-3"
              />
            )}

            {/* D. Color Temperature blend simulation */}
            {adjustments.temperature !== 0 && (
              <div
                style={{
                  opacity: Math.abs(adjustments.temperature) / 240,
                  backgroundColor: adjustments.temperature > 0 ? '#fb923c' : '#3b82f6',
                }}
                className="absolute inset-0 pointer-events-none mix-blend-color z-4"
              />
            )}

            {/* E. Double Exposure Blend image overlay */}
            {adjustments.blendImage && (
              <img
                src={adjustments.blendImage}
                alt="Blend Overlay"
                referrerPolicy="no-referrer"
                style={{
                  mixBlendMode: adjustments.blendMode,
                  opacity: adjustments.blendOpacity / 100,
                }}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-5"
              />
            )}

            {/* MULTI DRAWING HAND-DRAWN CANVAS LAYER */}
            <canvas
              ref={drawingCanvasRef}
              width={viewportDims.width}
              height={viewportDims.height}
              className="absolute inset-0 pointer-events-none z-10"
            />

            {/* SHAPES VECTOR LAYER */}
            <svg
              className="absolute inset-0 pointer-events-none z-11 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {shapes.map((sh) => {
                const isSelected = activeTool === 'select';
                const isCurrentSelectedShape = selectedShapeLayer?.id === sh.id;
                const strokeWidthVal = sh.strokeWidth / 5.5;
                const opStyle = { opacity: (sh.opacity ?? 100) / 100 };

                return (
                  <g key={sh.id} className="pointer-events-auto">
                    {sh.type === 'rect' && (
                      <>
                        <rect
                          id={`shape-${sh.id}`}
                          x={sh.x}
                          y={sh.y}
                          width={sh.width}
                          height={sh.height}
                          fill="none"
                          stroke={sh.color}
                          strokeWidth={strokeWidthVal}
                          style={opStyle}
                          onClick={() => {
                            if (activeTool === 'select') {
                              setSelectedShapeLayer && setSelectedShapeLayer(sh);
                              setSelectedTextLayer(null);
                            } else {
                              handleElementClick(sh.id, 'shape');
                            }
                          }}
                          className={`${activeTool === 'eraser' ? 'hover:stroke-red-500 hover:scale-102 cursor-eraser' : isSelected ? 'cursor-move' : ''}`}
                        />
                        {isCurrentSelectedShape && isSelected && (
                          <rect
                            x={sh.x - 1}
                            y={sh.y - 1}
                            width={sh.width + 2}
                            height={sh.height + 2}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="1.2"
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                          />
                        )}
                      </>
                    )}

                    {sh.type === 'circle' && (
                      <>
                        <ellipse
                          id={`shape-${sh.id}`}
                          cx={sh.x + sh.width / 2}
                          cy={sh.y + sh.height / 2}
                          rx={Math.abs(sh.width / 2)}
                          ry={Math.abs(sh.height / 2)}
                          fill="none"
                          stroke={sh.color}
                          strokeWidth={strokeWidthVal}
                          style={opStyle}
                          onClick={() => {
                            if (activeTool === 'select') {
                              setSelectedShapeLayer && setSelectedShapeLayer(sh);
                              setSelectedTextLayer(null);
                            } else {
                              handleElementClick(sh.id, 'shape');
                            }
                          }}
                          className={`${activeTool === 'eraser' ? 'hover:stroke-red-500 hover:scale-102 cursor-eraser' : isSelected ? 'cursor-move' : ''}`}
                        />
                        {isCurrentSelectedShape && isSelected && (
                          <rect
                            x={sh.x - 1}
                            y={sh.y - 1}
                            width={sh.width + 2}
                            height={sh.height + 2}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="1.2"
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                          />
                        )}
                      </>
                    )}

                    {sh.type === 'arrow' && (
                      <g 
                        onClick={() => {
                          if (activeTool === 'select') {
                            setSelectedShapeLayer && setSelectedShapeLayer(sh);
                            setSelectedTextLayer(null);
                          } else {
                            handleElementClick(sh.id, 'shape');
                          }
                        }}
                      >
                        <line
                          x1={sh.x}
                          y1={sh.y}
                          x2={sh.x + sh.width}
                          y2={sh.y + sh.height}
                          stroke={sh.color}
                          strokeWidth={strokeWidthVal}
                          style={opStyle}
                          className={`${activeTool === 'eraser' ? 'hover:stroke-red-500 cursor-eraser animate-pulse' : isSelected ? 'cursor-move' : ''}`}
                        />
                        {/* Simple vector arrow head marker */}
                        <polygon
                          points={`${sh.x + sh.width},${sh.y + sh.height} ${sh.x + sh.width - 2},${sh.y + sh.height - 4} ${sh.x + sh.width - 4},${sh.y + sh.height - 2}`}
                          fill={sh.color}
                          style={opStyle}
                        />
                        {isCurrentSelectedShape && isSelected && (
                          <rect
                            x={Math.min(sh.x, sh.x + sh.width) - 1}
                            y={Math.min(sh.y, sh.y + sh.height) - 1}
                            width={Math.abs(sh.width) + 2}
                            height={Math.abs(sh.height) + 2}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="1.2"
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                          />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Temporary shape preview while drawing */}
              {tempShape && (
                <g>
                  {tempShape.type === 'rect' && (
                    <rect
                      x={tempShape.width < 0 ? tempShape.x + tempShape.width : tempShape.x}
                      y={tempShape.height < 0 ? tempShape.y + tempShape.height : tempShape.y}
                      width={Math.abs(tempShape.width)}
                      height={Math.abs(tempShape.height)}
                      fill="none"
                      stroke={tempShape.color}
                      strokeWidth={tempShape.strokeWidth / 5.5}
                    />
                  )}
                  {tempShape.type === 'circle' && (
                    <ellipse
                      cx={tempShape.x + tempShape.width / 2}
                      cy={tempShape.y + tempShape.height / 2}
                      rx={Math.abs(tempShape.width / 2)}
                      ry={Math.abs(tempShape.height / 2)}
                      fill="none"
                      stroke={tempShape.color}
                      strokeWidth={tempShape.strokeWidth / 5.5}
                    />
                  )}
                  {tempShape.type === 'arrow' && (
                    <line
                      x1={tempShape.x}
                      y1={tempShape.y}
                      x2={tempShape.x + tempShape.width}
                      y2={tempShape.y + tempShape.height}
                      stroke={tempShape.color}
                      strokeWidth={tempShape.strokeWidth / 5.5}
                    />
                  )}
                </g>
              )}
            </svg>

            {/* DYNAMIC COMPONENT TEXT ENGINE */}
            {texts.map((item) => {
              const isSelected = selectedTextLayer?.id === item.id;
              const wVal = item.width || 25;
              const hVal = item.height || 8;
              const rotVal = item.rotation || 0;
              const opVal = (item.opacity ?? 100) / 100;

              return (
                <div
                  id={`text-layer-${item.id}`}
                  key={item.id}
                  onClick={(e) => {
                    if (activeTool === 'select') {
                      setSelectedTextLayer(item);
                      setSelectedShapeLayer && setSelectedShapeLayer(null);
                    } else if (activeTool === 'eraser') {
                      handleElementClick(item.id, 'text');
                    }
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'select' && !isSelected) {
                      setSelectedTextLayer(item);
                      setSelectedShapeLayer && setSelectedShapeLayer(null);
                      const coords = getCoordinates(e);
                      setDraggedItem({
                        id: item.id,
                        type: 'text',
                        offset: { x: coords.x - item.x, y: coords.y - item.y },
                      });
                      e.stopPropagation();
                    }
                  }}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${wVal}%`,
                    height: `${hVal}%`,
                    transform: `rotate(${rotVal}deg)`,
                    opacity: opVal,
                    minWidth: '60px',
                    minHeight: '28px',
                    backgroundColor: item.bgColor || 'transparent',
                  }}
                  className={`absolute pointer-events-auto z-20 select-none border rounded flex flex-col items-stretch ${
                    activeTool === 'eraser'
                      ? 'border-transparent hover:line-through hover:border-red-500 cursor-eraser bg-red-950/20'
                      : isSelected
                      ? 'border-2 border-[#22c55e] shadow-lg shadow-black/60'
                      : 'border-transparent'
                  }`}
                >
                  {isSelected ? (
                    <textarea
                      value={item.text}
                      onChange={(e) => {
                        const newText = e.target.value;
                        const updatedList = texts.map((t) =>
                          t.id === item.id ? { ...t, text: newText } : t
                        );
                        setTexts(updatedList);
                        setSelectedTextLayer({ ...item, text: newText });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      autoFocus
                      style={{
                        fontFamily: item.fontFamily,
                        fontSize: `${item.fontSize / 3.8}px`,
                        color: item.color,
                        fontWeight: item.fontWeight,
                        fontStyle: item.fontStyle,
                        textDecoration: item.textDecoration,
                        textAlign: item.textAlign,
                        lineHeight: item.lineHeight !== undefined ? `${item.lineHeight}` : '1.2',
                        letterSpacing: item.letterSpacing !== undefined ? `${item.letterSpacing}px` : '0px',
                        WebkitTextStroke: item.textStroke || 'none',
                        textShadow: item.textShadow || 'none',
                        textTransform: item.textTransform || 'none',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        width: '100%',
                        height: '100%',
                      }}
                      className="cursor-text bg-transparent text-white outline-none ring-0 border-0 p-1 m-0 block focus:ring-0 focus:outline-none placeholder-zinc-500 overflow-hidden"
                      placeholder="Type text..."
                    />
                  ) : (
                    <div
                      style={{
                        fontFamily: item.fontFamily,
                        fontSize: `${item.fontSize / 3.8}px`,
                        color: item.color,
                        fontWeight: item.fontWeight,
                        fontStyle: item.fontStyle,
                        textDecoration: item.textDecoration,
                        textAlign: item.textAlign,
                        lineHeight: item.lineHeight !== undefined ? `${item.lineHeight}` : '1.2',
                        letterSpacing: item.letterSpacing !== undefined ? `${item.letterSpacing}px` : '0px',
                        WebkitTextStroke: item.textStroke || 'none',
                        textShadow: item.textShadow || 'none',
                        textTransform: item.textTransform || 'none',
                        width: '100%',
                        height: '100%',
                      }}
                      className="p-1 break-words overflow-hidden"
                    >
                      {item.text}
                    </div>
                  )}

                  {/* SELECTION OVERLAY WITH CIRCULAR CORNERS AND SIDE PILLS (ACCURATE EDITOR DESIGN) */}
                  {isSelected && activeTool === 'select' && (
                    <>
                      {/* Four Circular Corners */}
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'tl', item)}
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                        title="Resize"
                      />
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'tr', item)}
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                        title="Resize"
                      />
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'bl', item)}
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                        title="Resize"
                      />
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'br', item)}
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                        title="Resize"
                      />

                      {/* Side Pill drag guides */}
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'lm', item)}
                        className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-1.5 h-3 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                        title="Resize Width"
                      />
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e as any, 'rm', item)}
                        className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-1.5 h-3 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                        title="Resize Width"
                      />

                      {/* Tool Actions overlay centered horizontally underneath */}
                      <div
                        className="absolute -bottom-11 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2.5 py-1 bg-zinc-950/95 border border-zinc-800 rounded-full shadow-2xl z-50"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* Rotate Action Button (Drag to rotate at any angle) */}
                        <div
                          onMouseDown={(e) => handleRotateMouseDown(e as any, item)}
                          className={`w-6.5 h-6.5 rounded-full flex items-center justify-center cursor-alias transition active:scale-95 shadow ${
                            isRotating
                              ? 'bg-[#22c55e] border-[#22c55e] text-white'
                              : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]'
                          }`}
                          title="Drag to Rotate (any angle)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6m-9 10a9 9 0 1 1 12.36-4"/>
                          </svg>
                        </div>

                        {/* Move drag lever button */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsMoving(true);
                            setSelectedTextLayer(item);
                            setSelectedShapeLayer && setSelectedShapeLayer(null);
                            const coords = getCoordinates(e as any);
                            setDraggedItem({
                              id: item.id,
                              type: 'text',
                              offset: { x: coords.x - item.x, y: coords.y - item.y },
                            });
                          }}
                          className={`w-6.5 h-6.5 rounded-full flex items-center justify-center cursor-move transition active:scale-90 shadow ${
                            isMoving
                              ? 'bg-[#22c55e] border-[#22c55e] text-white'
                              : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]'
                          }`}
                          title="Drag to position"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 12 19"></polyline>
                            <polyline points="15 3 12 5 9 3"></polyline>
                            <polyline points="3 15 5 12 3 9"></polyline>
                            <polyline points="15 21 12 19 9 21"></polyline>
                            <polyline points="21 15 19 12 21 9"></polyline>
                          </svg>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

          </div>

        </div>

      </div>

      {/* FLOAT BEFORE-AFTER COMPASS NOTIFICATION */}
      {showBeforeAfter && (
        <div className="absolute top-4 bg-[#181822]/90 border border-[#2d2d3c] text-[10px] py-1 px-3 text-[#cbd5e0] rounded-full flex gap-1.5 items-center backdrop-blur shadow z-10 animate-fade-in">
          <Compass className="w-3.5 h-3.5 text-pink-500 animate-spin" />
          <span>Slide original separator or drag vector elements direct!</span>
        </div>
      )}

      {/* BOTTOM FLOAT CONTROLS BAR */}
      <div className="absolute bottom-5 bg-[#0f0f11]/90 border border-zinc-800/80 rounded-full px-5 py-2 flex items-center gap-4 text-xs z-10 backdrop-blur shadow-2xl">
        
        {/* Zoom Out */}
        <button
          onClick={() => setZoom(Math.max(50, zoom - 25))}
          title="Zoom Out"
          className="text-zinc-400 hover:text-white transition p-1"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom Indicator */}
        <span className="font-mono text-xs text-white font-semibold">
          {zoom}%
        </span>

        {/* Fit Screen Shortcut */}
        <button
          onClick={handleResetView}
          title="Fit Viewport Target"
          className="text-zinc-400 hover:text-white transition p-1"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          onClick={() => setZoom(Math.min(400, zoom + 25))}
          title="Zoom In"
          className="text-zinc-400 hover:text-white transition p-1"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-zinc-800 shrink-0" />

        {/* Reset Pan */}
        <button
          onClick={() => setPanOffset({ x: 0, y: 0 })}
          title="Reset Pan Alignment"
          className="text-zinc-400 hover:text-white transition text-[10px] font-semibold flex items-center gap-1 shrink-0 px-2 py-0.5 rounded hover:bg-zinc-800"
        >
          <RotateCcw className="w-3 h-3" />
          Center
        </button>

      </div>

    </div>
  );
}
