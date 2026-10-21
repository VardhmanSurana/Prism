import { useCallback, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Checks the Tauri updater endpoint for a desktop update.
 * Returns null when running outside Tauri or on mobile (updater is desktop-only).
 */
export function useDesktopUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'downloading' | 'installing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (checkingRef.current) return;
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    // The updater plugin is desktop-only; skip on Android/iOS.
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) return;

    checkingRef.current = true;
    setStatus('checking');
    setError(null);
    try {
      const result = await check();
      setUpdate(result);
    } catch (e) {
      // Non-fatal: offline, no manifest published yet, etc.
      console.warn('[updater] check failed:', e);
      setError(String(e));
      setUpdate(null);
    } finally {
      checkingRef.current = false;
      setStatus('idle');
    }
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setError(null);
    try {
      setStatus('downloading');
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) setProgress(Math.min(99, Math.round((downloaded / total) * 100)));
            break;
          case 'Finished':
            setStatus('installing');
            setProgress(100);
            break;
        }
      });
      // App relaunches into the new version; the local backend sidecar is respawned on startup.
      await relaunch();
    } catch (e) {
      console.error('[updater] install failed:', e);
      setError(String(e));
      setStatus('idle');
    }
  }, [update]);

  return { update, status, progress, error, dismissed, checkForUpdate, install, dismiss: () => setDismissed(true) };
}
