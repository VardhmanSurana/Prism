/**
 * useKeyBindings.ts
 * Custom React hook establishing global keydown/keyup event listeners for image editor shortcuts (Undo/Redo, Hold-to-Compare, Zooming, and Brush resizing).
 */

import { useEffect } from 'react';
import { ToolId } from '../Sidebar';
import { HistoryEntry } from '../history';
import { InpaintMode, InpaintSettings } from '../InpaintPanel';

interface UseKeyBindingsProps {
  activeTool: ToolId | null;
  undoAnnotations: () => void;
  redoAnnotations: () => void;
  currentHistoryIndex: number;
  history: HistoryEntry[];
  handleJumpToHistory: (index: number) => void;
  setIsComparing: (compare: boolean) => void;
  cropperRef: React.RefObject<any>;
  inpaintMode: InpaintMode;
  setInpaintSettings: React.Dispatch<React.SetStateAction<InpaintSettings>>;
}

export const useKeyBindings = ({
  activeTool,
  undoAnnotations,
  redoAnnotations,
  currentHistoryIndex,
  history,
  handleJumpToHistory,
  setIsComparing,
  cropperRef,
  inpaintMode,
  setInpaintSettings,
}: UseKeyBindingsProps) => {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ── Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: Undo / Redo ──────────────────────────────
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (activeTool === 'annotations') {
          undoAnnotations();
        } else {
          const prevIndex = currentHistoryIndex - 1;
          if (prevIndex >= 0) handleJumpToHistory(prevIndex);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (activeTool === 'annotations') {
          redoAnnotations();
        } else {
          const nextIndex = currentHistoryIndex + 1;
          if (nextIndex < history.length) handleJumpToHistory(nextIndex);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        if (activeTool === 'annotations') {
          redoAnnotations();
        } else {
          const nextIndex = currentHistoryIndex + 1;
          if (nextIndex < history.length) handleJumpToHistory(nextIndex);
        }
        return;
      }

      // ── Backslash: hold-to-compare (keydown fires repeatedly, guard with isComparing) ──
      if (e.key === '\\' && !e.repeat) {
        setIsComparing(true);
        return;
      }

      // ── Ctrl+= / Ctrl+- / Ctrl+0: Zoom ─────────────────────────────────
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        cropperRef.current?.zoom(0.1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        cropperRef.current?.zoom(-0.1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        const cropper = cropperRef.current;
        if (cropper) {
          const containerData = cropper.getContainerData();
          const imageData     = cropper.getImageData();
          const scale = Math.min(
            (containerData.width  * 0.95) / imageData.naturalWidth,
            (containerData.height * 0.95) / imageData.naturalHeight,
          );
          cropper.zoomTo(scale);
        }
        return;
      }

      // ── Brush size shortcuts (inpaint) ───────────────────────────────────
      if (activeTool === 'inpaint' && (inpaintMode === 'brush' || inpaintMode === 'erase')) {
        if (e.key === '[') {
          setInpaintSettings(prev => ({
            ...prev,
            brushSize: Math.max(5, prev.brushSize - 5)
          }));
        } else if (e.key === ']') {
          setInpaintSettings(prev => ({
            ...prev,
            brushSize: Math.min(200, prev.brushSize + 5)
          }));
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\') {
        setIsComparing(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [
    activeTool,
    inpaintMode,
    currentHistoryIndex,
    history,
    handleJumpToHistory,
    undoAnnotations,
    redoAnnotations,
    setIsComparing,
    cropperRef,
    setInpaintSettings,
  ]);
};
