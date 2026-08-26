import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Type,
  X,
  Copy,
  Check,
  Loader2,
  FileText,
  Shield,
  ShieldCheck,
  WrapText,
  Table as TableIcon,
  Sparkles,
} from 'lucide-react';
import { Photo, OcrBbox, OcrBboxesResponse } from '@/types';
import { API_BASE } from '@/constants';
import { useImageBounds } from './useImageBounds';

interface TextActionsOverlayProps {
  photo: Photo;
  onClose: () => void;
  zoomScale?: number;
  offset?: { x: number; y: number };
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

function applyQuickRedact(text: string): string {
  // Redact emails
  let result = text.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED EMAIL]');
  // Redact phone numbers
  result = result.replace(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g, '[REDACTED PHONE]');
  // Redact credit cards
  result = result.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[REDACTED CARD]');
  return result;
}

function formatAsTable(selectedLines: OcrBbox[]): string {
  if (selectedLines.length === 0) return '';
  const sorted = [...selectedLines].sort((a, b) => {
    const yA = Math.min(a.bbox[0][1], a.bbox[1][1]);
    const yB = Math.min(b.bbox[0][1], b.bbox[1][1]);
    if (Math.abs(yA - yB) < 0.02) {
      const xA = Math.min(a.bbox[0][0], a.bbox[3][0]);
      const xB = Math.min(b.bbox[0][0], b.bbox[3][0]);
      return xA - xB;
    }
    return yA - yB;
  });

  const rows: OcrBbox[][] = [];
  let currentRow: OcrBbox[] = [];
  let lastY = -1;

  for (const line of sorted) {
    const y = Math.min(line.bbox[0][1], line.bbox[1][1]);
    if (lastY === -1 || Math.abs(y - lastY) < 0.025) {
      currentRow.push(line);
      lastY = y;
    } else {
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => Math.min(a.bbox[0][0], a.bbox[3][0]) - Math.min(b.bbox[0][0], b.bbox[3][0]));
        rows.push(currentRow);
      }
      currentRow = [line];
      lastY = y;
    }
  }
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => Math.min(a.bbox[0][0], a.bbox[3][0]) - Math.min(b.bbox[0][0], b.bbox[3][0]));
    rows.push(currentRow);
  }

  return rows.map(r => r.map(c => c.text).join('\t')).join('\n');
}

export const TextActionsOverlay: React.FC<TextActionsOverlayProps> = ({
  photo,
  onClose,
  zoomScale = 1,
  offset = { x: 0, y: 0 },
  containerRef,
}) => {
  const [lines, setLines] = useState<OcrBbox[]>([]);
  const [fullText, setFullText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSelected, setCopiedSelected] = useState(false);
  const [quickRedact, setQuickRedact] = useState(false);
  const [removeLineBreaks, setRemoveLineBreaks] = useState(false);

  // Drag-select state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageOverlayRef = useRef<HTMLDivElement>(null);

  const imageBounds = useImageBounds(photo, containerRef, rootRef, zoomScale, offset);

  // Fetch OCR bboxes on mount
  useEffect(() => {
    let cancelled = false;

    const fetchBboxes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/ocr-bboxes`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: OcrBboxesResponse = await res.json();
        if (!cancelled) {
          if (data.status === 'error') {
            setError(data.error || 'OCR failed');
          } else {
            setLines(data.lines || []);
            setFullText(data.ocr_text || '');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to extract text');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchBboxes();
    return () => { cancelled = true; };
  }, [photo.id]);

  // Format processed text based on user toggles (Quick Redact, Remove Line Breaks)
  const processOutputText = useCallback((raw: string): string => {
    let out = raw;
    if (quickRedact) {
      out = applyQuickRedact(out);
    }
    if (removeLineBreaks) {
      out = out.replace(/\r?\n+/g, ' ').trim();
    }
    return out;
  }, [quickRedact, removeLineBreaks]);

  // Copy all text
  const handleCopyAll = useCallback(async () => {
    if (!fullText) return;
    const textToCopy = processOutputText(fullText);
    await navigator.clipboard.writeText(textToCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [fullText, processOutputText]);

  // Copy selected text
  const handleCopySelected = useCallback(async () => {
    if (selectedIndices.size === 0) return;
    const selectedLines = lines.filter((_, i) => selectedIndices.has(i));
    const rawSelected = selectedLines.map(l => l.text).join('\n');
    const textToCopy = processOutputText(rawSelected);
    await navigator.clipboard.writeText(textToCopy);
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
  }, [lines, selectedIndices, processOutputText]);

  // Copy as structured table
  const handleCopyTable = useCallback(async () => {
    const targetLines = selectedIndices.size > 0
      ? lines.filter((_, i) => selectedIndices.has(i))
      : lines;
    if (targetLines.length === 0) return;
    let table = formatAsTable(targetLines);
    if (quickRedact) {
      table = applyQuickRedact(table);
    }
    await navigator.clipboard.writeText(table);
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
  }, [lines, selectedIndices, quickRedact]);

  // Toggle selection of a single line
  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Select all lines
  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(lines.map((_, i) => i)));
  }, [lines]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  // Keyboard shortcut listener inside overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAll();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (selectedIndices.size > 0) {
          void handleCopySelected();
        } else {
          void handleCopyAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, handleCopySelected, handleCopyAll, selectedIndices.size]);

  // Drag-select: find lines intersecting the selection rectangle
  const getSelectionRect = useCallback(() => {
    if (!dragStart || !dragEnd || !imageOverlayRef.current) return null;
    const rect = imageOverlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x1 = Math.max(0, Math.min(rect.width, Math.min(dragStart.x, dragEnd.x) - rect.left)) / rect.width;
    const y1 = Math.max(0, Math.min(rect.height, Math.min(dragStart.y, dragEnd.y) - rect.top)) / rect.height;
    const x2 = Math.max(0, Math.min(rect.width, Math.max(dragStart.x, dragEnd.x) - rect.left)) / rect.width;
    const y2 = Math.max(0, Math.min(rect.height, Math.max(dragStart.y, dragEnd.y) - rect.top)) / rect.height;

    return { x1, y1, x2, y2 };
  }, [dragStart, dragEnd]);

  const selectionRect = getSelectionRect();

  // Check if a bbox intersects with the selection rectangle
  const bboxIntersectsSelection = useCallback(
    (bbox: OcrBbox['bbox'], sel: { x1: number; y1: number; x2: number; y2: number }) => {
      const [tl, tr, br, bl] = bbox;
      const bx1 = Math.min(tl[0], bl[0]);
      const by1 = Math.min(tl[1], tr[1]);
      const bx2 = Math.max(tr[0], br[0]);
      const by2 = Math.max(bl[1], br[1]);

      return bx1 < sel.x2 && bx2 > sel.x1 && by1 < sel.y2 && by2 > sel.y1;
    },
    []
  );

  // Handle pointer events for drag-select
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragEnd({ x: e.clientX, y: e.clientY });
    setSelectedIndices(new Set());
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragEnd({ x: e.clientX, y: e.clientY });

    const rect = imageOverlayRef.current?.getBoundingClientRect();
    if (!rect || !dragStart || rect.width <= 0 || rect.height <= 0) return;

    const minX = Math.min(dragStart.x, e.clientX) - rect.left;
    const minY = Math.min(dragStart.y, e.clientY) - rect.top;
    const maxX = Math.max(dragStart.x, e.clientX) - rect.left;
    const maxY = Math.max(dragStart.y, e.clientY) - rect.top;

    const x1 = Math.max(0, Math.min(1, minX / rect.width));
    const y1 = Math.max(0, Math.min(1, minY / rect.height));
    const x2 = Math.max(0, Math.min(1, maxX / rect.width));
    const y2 = Math.max(0, Math.min(1, maxY / rect.height));

    const sel = { x1, y1, x2, y2 };
    const newSelected = new Set<number>();
    lines.forEach((line, i) => {
      if (bboxIntersectsSelection(line.bbox, sel)) {
        newSelected.add(i);
      }
    });
    setSelectedIndices(newSelected);
  }, [isDragging, dragStart, lines, bboxIntersectsSelection]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  // Render bounding box overlay for a single line
  const renderBbox = (line: OcrBbox, index: number) => {
    const [tl, tr, br, bl] = line.bbox;
    const left = Math.min(tl[0], bl[0]) * 100;
    const top = Math.min(tl[1], tr[1]) * 100;
    const width = (Math.max(tr[0], br[0]) - Math.min(tl[0], bl[0])) * 100;
    const height = (Math.max(bl[1], br[1]) - Math.min(tl[1], tr[1])) * 100;

    const isSelected = selectedIndices.has(index);
    const isHovered = hoveredIndex === index;
    const isRedactedLine = quickRedact && (
      /@/.test(line.text) ||
      /\d{3}[-.\s]?\d{4}/.test(line.text) ||
      /\b\d{4}[-\s]?\d{4}\b/.test(line.text)
    );

    return (
      <div
        key={index}
        className="absolute transition-all duration-150 group"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          toggleSelection(index);
        }}
        onPointerEnter={() => setHoveredIndex(index)}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        {/* Highlight background & border */}
        <div
          className={`absolute inset-0 rounded-sm transition-all duration-150 ${
            isRedactedLine
              ? 'bg-black/90 border-2 border-red-500/80 shadow-md'
              : isSelected
              ? 'bg-blue-500/35 border-2 border-blue-400 shadow-lg'
              : isHovered
              ? 'bg-blue-500/25 border-2 border-blue-400/60'
              : 'bg-blue-500/10 border border-blue-400/25 hover:border-blue-400/50'
          }`}
        />

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center z-10 shadow-md">
            <Check size={10} className="text-white" />
          </div>
        )}

        {/* Text tooltip on hover */}
        {isHovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 px-3 py-1.5 rounded-lg bg-black/90 backdrop-blur-md border border-white/20 shadow-2xl whitespace-nowrap max-w-[320px] pointer-events-none">
            <p className="text-xs text-white font-mono truncate">
              {isRedactedLine ? applyQuickRedact(line.text) : line.text}
            </p>
            <div className="flex items-center justify-between gap-3 text-[9px] text-white/50 mt-0.5 font-mono">
              <span>{Math.round(line.confidence * 100)}% accuracy</span>
              {isRedactedLine && <span className="text-red-400 font-bold uppercase">Redacted</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none" ref={rootRef}>
      {/* Top Banner (Snipping Tool & PowerToys Text Actions Command Bar) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-xs text-white font-medium flex items-center gap-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
            <Type size={14} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">Text Actions</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/60 font-mono">
                PP-OCRv4
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-white/15 mx-0.5" />

        {isLoading ? (
          <span className="flex items-center gap-2 text-blue-300 text-[11px]">
            <Loader2 size={12} className="animate-spin text-blue-400" />
            Recognizing text...
          </span>
        ) : error ? (
          <span className="text-red-400 text-[11px]">{error}</span>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="font-mono">{lines.length} region{lines.length !== 1 ? 's' : ''}</span>
            {selectedIndices.size > 0 && (
              <>
                <span>·</span>
                <span className="text-blue-400 font-mono font-bold">
                  {selectedIndices.size} selected
                </span>
              </>
            )}
          </div>
        )}

        {/* Action Buttons & Toggles */}
        {!isLoading && !error && lines.length > 0 && (
          <>
            <div className="h-4 w-px bg-white/15 mx-0.5" />

            <div className="flex items-center gap-1.5">
              {/* Select All / Deselect */}
              <button
                onClick={selectedIndices.size === lines.length ? deselectAll : selectAll}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Select/Deselect All (Ctrl+A)"
              >
                {selectedIndices.size === lines.length ? 'Deselect All' : 'Select All'}
              </button>

              {/* Copy Selected Button */}
              {selectedIndices.size > 0 && (
                <button
                  onClick={handleCopySelected}
                  className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-500 hover:bg-blue-600 text-white shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copy Selected Text (Ctrl+C)"
                >
                  {copiedSelected ? <Check size={12} className="text-white" /> : <Copy size={12} />}
                  <span>{copiedSelected ? 'Copied!' : 'Copy Selected'}</span>
                </button>
              )}

              {/* Copy All Button */}
              <button
                onClick={handleCopyAll}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedIndices.size > 0
                    ? 'bg-white/10 hover:bg-white/20 text-white/80'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow'
                }`}
                title="Copy All Text"
              >
                {copiedAll ? <Check size={12} className="text-white" /> : <Copy size={12} />}
                <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
              </button>

              {/* Copy As Table */}
              <button
                onClick={handleCopyTable}
                className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy structured text as table (TSV / Columns)"
              >
                <TableIcon size={12} />
                <span className="hidden sm:inline">Table</span>
              </button>

              {/* Quick Redact Toggle */}
              <button
                onClick={() => setQuickRedact(prev => !prev)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  quickRedact
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                }`}
                title="Quick Redact: Mask emails, phone numbers and card data before copying"
              >
                {quickRedact ? <ShieldCheck size={12} className="text-red-400" /> : <Shield size={12} />}
                <span className="hidden sm:inline">Redact</span>
              </button>

              {/* Remove Line Breaks Toggle */}
              <button
                onClick={() => setRemoveLineBreaks(prev => !prev)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  removeLineBreaks
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                }`}
                title="Remove line breaks to copy continuous sentences"
              >
                <WrapText size={12} />
              </button>
            </div>
          </>
        )}

        <div className="h-4 w-px bg-white/15 mx-0.5" />

        {/* Close Overlay Button */}
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X size={15} />
        </button>
      </div>

      {/* Exact Image Bitmap Frame (Pixel-Perfect Alignment with Photo) */}
      <div
        ref={imageOverlayRef}
        className="absolute pointer-events-auto select-none"
        style={{
          left: `${imageBounds.left}px`,
          top: `${imageBounds.top}px`,
          width: `${imageBounds.width}px`,
          height: `${imageBounds.height}px`,
          cursor: isDragging ? 'crosshair' : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Render bounding boxes */}
        {!isLoading && !error && lines.map((line, index) => renderBbox(line, index))}

        {/* Drag selection rectangle */}
        {isDragging && selectionRect && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-500/20 pointer-events-none z-10 rounded-sm"
            style={{
              left: `${selectionRect.x1 * 100}%`,
              top: `${selectionRect.y1 * 100}%`,
              width: `${(selectionRect.x2 - selectionRect.x1) * 100}%`,
              height: `${(selectionRect.y2 - selectionRect.y1) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Empty state */}
      {!isLoading && !error && lines.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-5 py-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 text-center shadow-2xl">
            <FileText size={28} className="text-white/30 mx-auto mb-2" />
            <p className="text-xs font-semibold text-white/80">No Text Detected</p>
            <p className="text-[10px] text-white/40 mt-1">PP-OCRv4 did not find legible text in this image</p>
          </div>
        </div>
      )}
    </div>
  );
};
