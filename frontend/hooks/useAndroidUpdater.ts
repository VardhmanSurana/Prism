import { useCallback, useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { appDataDir, join } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-shell';

const ANDROID_MANIFEST_URL =
  'https://github.com/VardhmanSurana/Prism/releases/latest/download/android-latest.json';

export interface AndroidUpdateInfo {
  version: string;
  apk: string;
  notes?: string;
}

/** Compare dotted versions: returns true when remote > local. */
export function isNewerVersion(remote: string, local: string): boolean {
  const a = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const b = local.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Android sideload self-update: fetches the manifest from GitHub Releases,
 * downloads the new APK into the app data dir, then triggers the Android
 * package installer via an ACTION_VIEW intent (shell.open on Android).
 */
export function useAndroidUpdater() {
  const [update, setUpdate] = useState<AndroidUpdateInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async (manifestUrlOverride?: string) => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    if (!/Android/i.test(navigator.userAgent)) return;
    setStatus('checking');
    setError(null);
    try {
      const [remote, current] = await Promise.all([
        fetch(manifestUrlOverride ?? ANDROID_MANIFEST_URL, { cache: 'no-store' }).then((r) =>
          r.ok ? (r.json() as Promise<AndroidUpdateInfo>) : null
        ),
        getVersion(),
      ]);
      if (remote && isNewerVersion(remote.version, current)) {
        setUpdate(remote);
      } else {
        setUpdate(null);
      }
    } catch (e) {
      console.warn('[android-updater] check failed:', e);
      setUpdate(null);
    } finally {
      setStatus('idle');
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;
    setError(null);
    setStatus('downloading');
    try {
      const response = await fetch(update.apk);
      if (!response.ok) throw new Error(`APK download failed: HTTP ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total > 0) setProgress(Math.round((received / total) * 100));
          }
        }
      }
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const dir = await appDataDir();
      const fileName = `prism-${update.version}.apk`;
      const filePath = await join(dir, fileName);
      await writeFile(filePath, bytes);
      setStatus('ready');
      setProgress(100);
      // Opens the APK with an ACTION_VIEW intent → Android package installer.
      try {
        await open(filePath);
      } catch {
        // Fallback (Android 7+ FileProvider restrictions): open the download
        // URL in the browser so the user can install from the notification.
        await open(update.apk);
      }
    } catch (e) {
      console.error('[android-updater] install failed:', e);
      setError(String(e));
      setStatus('idle');
    }
  }, [update]);

  return { update, status, progress, error, dismissed, checkForUpdate, downloadAndInstall, dismiss: () => setDismissed(true) };
}
