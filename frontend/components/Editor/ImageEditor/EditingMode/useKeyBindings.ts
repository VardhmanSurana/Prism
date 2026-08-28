/**
 * useKeyBindings.ts
 * Custom React hook establishing global keydown/keyup event listeners for image editor shortcuts
 * (Undo/Redo, Hold-to-Compare, Zooming, and Brush resizing).
 * ponytail: simplified by routing directly to handleUndo / handleRedo.
 */

import { useEffect } from 'react';
import { ToolId } from '../Sidebar';
import type { InpaintMode, InpaintSettings } from '@plugins/ai-vision-studio';

interface UseKeyBindingsProps {
  activeTool: ToolId | null;
  undoAnnotations: () => void;
  redoAnnotations: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  setIsComparing: (compare: boolean | ((prev: boolean) => boolean)) => void;
  cropperRef: React.RefObject<any>;
  inpaintMode: InpaintMode;
  setInpaintSettings: React.Dispatch<React.SetStateAction<InpaintSettings>>;
  onAutoEnhance?: () => void;
  onToggleHistory?: () => void;
}

export const useKeyBindings = ({
  activeTool,
  undoAnnotations,
  redoAnnotations,
  handleUndo,
  handleRedo,
  setIsComparing,
  cropperRef,
  inpaintMode,
  setInpaintSettings,
  onAutoEnhance,
  onToggleHistory,
}: UseKeyBindingsProps) => {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ── Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: Undo / Redo ──────────────────────────────
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (activeTool === 'annotations') {
          undoAnnotations();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        if (activeTool === 'annotations') {
          redoAnnotations();
        } else {
          handleRedo();
        }
        return;
      }

      // ── Ctrl+L / Cmd+L: Auto Enhance ─────────────────────────────────────────
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        onAutoEnhance?.();
        return;
      }

      // ── Backslash: toggle compare mode ────────────────────────────────────────
      if (e.key === '\\' && !e.repeat) {
        setIsComparing(c => !c);
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
          const imageData = cropper.getImageData();
          const scale = Math.min(
            (containerData.width * 0.95) / imageData.naturalWidth,
            (containerData.height * 0.95) / imageData.naturalHeight
          );
          cropper.zoomTo(scale);
        }
        return;
      }

      // ── H: Toggle History Panel ─────────────────────────────────────────
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;
      if (!isInput && (e.key === 'h' || e.key === 'H') && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onToggleHistory?.();
        return;
      }

      // ── Brush size shortcuts (inpaint) ───────────────────────────────────
      if (activeTool === 'inpaint' && (inpaintMode === 'brush' || inpaintMode === 'erase')) {
        if (e.key === '[') {
          setInpaintSettings((prev: InpaintSettings) => ({
            ...prev,
            brushSize: Math.max(5, prev.brushSize - 5),
          }));
        } else if (e.key === ']') {
          setInpaintSettings((prev: InpaintSettings) => ({
            ...prev,
            brushSize: Math.min(200, prev.brushSize + 5),
          }));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    activeTool,
    inpaintMode,
    handleUndo,
    handleRedo,
    undoAnnotations,
    redoAnnotations,
    setIsComparing,
    cropperRef,
    setInpaintSettings,
    onAutoEnhance,
    onToggleHistory,
  ]);
};
