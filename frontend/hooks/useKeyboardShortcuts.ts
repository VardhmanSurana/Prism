import { useEffect, useCallback, useRef } from 'react';

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  /** If true, prevent default even when in an input field */
  always?: boolean;
  /** Disable this shortcut entirely */
  disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutBinding[];
  enabled?: boolean;
}

/**
 * Centralized keyboard shortcut handler.
 *
 * Registers a single global keydown listener and dispatches to the
 * matching binding. Shortcuts are disabled when focus is inside an
 * input/textarea/contenteditable unless `always: true`.
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't capture when typing in inputs (unless always: true)
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.disabled) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (isEditable && !shortcut.always) continue;

          e.preventDefault();
          e.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handler]);
}

// ─── Built-in shortcut presets ────────────────────────────────────────────────

/** Standard Prism desktop shortcuts (non-editor). */
export function usePrismShortcuts(actions: {
  onCommandPalette: () => void;
  onNavigate: (view: string) => void;
  onUpload: () => void;
  onToggleLock: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}) {
  useKeyboardShortcuts({
    enabled: actions.enabled !== false,
    shortcuts: [
      // Command Palette
      {
        key: 'k',
        meta: true,
        description: 'Open Command Palette',
        action: actions.onCommandPalette,
        always: true,
      },
      // View navigation
      { key: '1', description: 'Gallery', action: () => actions.onNavigate('gallery') },
      { key: '2', description: 'Albums', action: () => actions.onNavigate('albums') },
      { key: '3', description: 'People', action: () => actions.onNavigate('people') },
      { key: '4', description: 'Map', action: () => actions.onNavigate('map') },
      { key: '5', description: 'Favorites', action: () => actions.onNavigate('favorites') },
      { key: '6', description: 'Trash', action: () => actions.onNavigate('trash') },
      { key: '7', description: 'AI Agent', action: () => actions.onNavigate('agent') },
      // Actions
      { key: 'u', description: 'Upload', action: actions.onUpload },
      { key: 'l', description: 'Lock Toggle', action: actions.onToggleLock },
      { key: ',', description: 'Settings', action: () => actions.onNavigate('utilities') },
      // Lightbox
      ...(actions.onNext ? [{ key: 'ArrowRight', description: 'Next Photo', action: actions.onNext }] : []),
      ...(actions.onPrev ? [{ key: 'ArrowLeft', description: 'Previous Photo', action: actions.onPrev }] : []),
      ...(actions.onToggleFavorite ? [{ key: 'f', description: 'Toggle Favorite', action: actions.onToggleFavorite }] : []),
      ...(actions.onDelete ? [{ key: 'Delete', description: 'Delete', action: actions.onDelete }] : []),
      // Escape
      ...(actions.onEscape ? [{ key: 'Escape', description: 'Close/Back', action: actions.onEscape, always: true }] : []),
    ],
  });
}
