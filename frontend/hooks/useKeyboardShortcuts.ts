import { useEffect, useCallback } from 'react';
import { useEditorUIStore } from '../store/uiStore';

export function useKeyboardShortcuts() {
  const setZoom = useEditorUIStore((s) => s.setZoom);
  const resetZoom = useEditorUIStore((s) => s.resetZoom);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (!modifier) {
      if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }

      if (e.key === '1') {
        e.preventDefault();
        setZoom({ scale: 2, mode: 'custom' });
      }

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const currentScale = useEditorUIStore.getState().zoom.scale;
        setZoom({
          scale: Math.min(10, currentScale + 0.5),
          mode: 'custom',
        });
      }

      if (e.key === '-') {
        e.preventDefault();
        const currentScale = useEditorUIStore.getState().zoom.scale;
        setZoom({
          scale: Math.max(0.1, currentScale - 0.5),
          mode: 'custom',
        });
      }
    }
  }, [setZoom, resetZoom]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
