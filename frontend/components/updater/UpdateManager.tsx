import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';
import { API_BASE } from '../../constants';
import { useDesktopUpdater } from '../../hooks/useAppUpdater';
import { useAndroidUpdater } from '../../hooks/useAndroidUpdater';

interface UpdaterPrefs {
  updater_enabled: boolean;
  updater_check_interval_minutes: number;
  updater_android_manifest_url: string | null;
}

const DEFAULT_PREFS: UpdaterPrefs = {
  updater_enabled: true,
  updater_check_interval_minutes: 720,
  updater_android_manifest_url: null,
};

/**
 * UpdateManager - Checks for app updates (desktop via Tauri updater,
 * Android via sideload manifest) and shows an in-app update prompt.
 * Behaviour (enabled/interval/manifest override) is configured in the
 * Advanced Settings tab and persisted in the backend database.
 */
export function UpdateManager() {
  const desktop = useDesktopUpdater();
  const android = useAndroidUpdater();
  const [prefs, setPrefs] = useState<UpdaterPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const active = isAndroid ? android : desktop;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/settings/advanced`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPrefs({
          updater_enabled: data.config?.updater_enabled ?? true,
          updater_check_interval_minutes: data.config?.updater_check_interval_minutes ?? 720,
          updater_android_manifest_url: data.config?.updater_android_manifest_url ?? null,
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setPrefsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsLoaded || !prefs.updater_enabled) return;
    desktop.checkForUpdate();
    android.checkForUpdate(prefs.updater_android_manifest_url ?? undefined);
    const interval = setInterval(
      () => {
        desktop.checkForUpdate();
        android.checkForUpdate(prefs.updater_android_manifest_url ?? undefined);
      },
      Math.max(1, prefs.updater_check_interval_minutes) * 60 * 1000
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, prefs.updater_enabled, prefs.updater_check_interval_minutes, prefs.updater_android_manifest_url]);

  if (!prefs.updater_enabled) return null;

  const update = isAndroid ? android.update : desktop.update;
  const busy = active.status === 'downloading' || active.status === 'installing';

  const handlePrimary = () => {
    if (isAndroid) void android.downloadAndInstall();
    else void desktop.install();
  };

  return (
    <AnimatePresence>
      {update && !active.dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-20 right-4 z-[9999] md:bottom-4"
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/95 px-4 py-3 shadow-2xl backdrop-blur">
            <Download className="h-5 w-5 shrink-0 text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-100">
                Update {update.version} available
              </p>
              {busy ? (
                <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${active.progress}%` }}
                  />
                </div>
              ) : (
                active.error && (
                  <p className="mt-0.5 truncate text-xs text-red-400">{active.error}</p>
                )
              )}
            </div>
            {!busy && (
              <>
                <button
                  onClick={handlePrimary}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isAndroid ? 'Install' : 'Restart to update'}
                </button>
                <button
                  onClick={active.dismiss}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-gray-200"
                  aria-label="Dismiss update"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
