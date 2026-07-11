import { useCallback, useEffect, useRef, useState } from 'react';
import { Photo } from '../../types';
import { useImportProcess } from './useImportProcess';
import { isTauriRuntime, resolveDroppedPaths, ImportProgressStatus } from './importPaths';

interface UseDragDropImportProps {
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: ImportProgressStatus) => void;
  /** When true, drops are ignored (e.g. already importing) */
  isImporting?: boolean;
  /** Disable listening entirely */
  enabled?: boolean;
}

export type DragDropPhase = 'idle' | 'hover' | 'processing';

/**
 * Global OS file/folder drag-and-drop import via Tauri webview events.
 * Falls back to no-op listeners outside the Tauri shell (browser dev).
 */
export function useDragDropImport({
  onUpload,
  onImportProgress,
  isImporting = false,
  enabled = true,
}: UseDragDropImportProps) {
  const [phase, setPhase] = useState<DragDropPhase>('idle');
  const [lastDropCount, setLastDropCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isImportingRef = useRef(isImporting);
  isImportingRef.current = isImporting;
  const processingRef = useRef(false);

  const { startImport } = useImportProcess({ onUpload, onImportProgress });

  const handlePaths = useCallback(
    async (paths: string[]) => {
      if (processingRef.current || isImportingRef.current) {
        setError('An import is already in progress');
        return;
      }
      if (!paths.length) return;

      processingRef.current = true;
      setPhase('processing');
      setError(null);
      setLastDropCount(paths.length);

      try {
        const files = await resolveDroppedPaths(paths, onImportProgress);
        if (files.length === 0) {
          setError('No supported images or videos found in the dropped items.');
          onImportProgress({
            is_scanning: false,
            total_files: 0,
            processed_files: 0,
            progress: 0,
          });
          return;
        }
        await startImport(files);
      } catch (e) {
        console.error('[drag-drop] Import failed', e);
        setError('Failed to import dropped files');
        onImportProgress({
          is_scanning: false,
          total_files: 0,
          processed_files: 0,
          progress: 0,
        });
      } finally {
        processingRef.current = false;
        setPhase('idle');
      }
    },
    [onImportProgress, startImport]
  );

  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (cancelled) return;
          const { type } = event.payload;

          if (type === 'enter' || type === 'over') {
            if (!processingRef.current && !isImportingRef.current) {
              setPhase('hover');
              setError(null);
            }
            return;
          }

          if (type === 'leave') {
            if (!processingRef.current) {
              setPhase('idle');
            }
            return;
          }

          if (type === 'drop') {
            const paths = event.payload.paths || [];
            void handlePaths(paths);
          }
        });
      } catch (e) {
        console.warn('[drag-drop] Tauri drag-drop unavailable', e);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, handlePaths]);

  const clearError = useCallback(() => setError(null), []);

  return {
    phase,
    isHovering: phase === 'hover',
    isProcessing: phase === 'processing',
    lastDropCount,
    error,
    clearError,
    /** Manual entry point for tests / secondary UI */
    importDroppedPaths: handlePaths,
  };
}
