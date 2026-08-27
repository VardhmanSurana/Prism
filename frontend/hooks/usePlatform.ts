import { useState, useEffect, useCallback } from 'react';

export type PlatformMode = 'auto' | 'desktop' | 'mobile';

export interface PlatformInfo {
  platform: 'desktop' | 'tablet' | 'mobile';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTauri: boolean;
  preference: PlatformMode;
  setPreference: (pref: PlatformMode) => void;
}

const STORAGE_KEY = 'prism_platform_mode';

/**
 * usePlatform - Hook managing platform.
 */
export function usePlatform(): PlatformInfo {
  const [preference, setPreferenceState] = useState<PlatformMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'desktop' || saved === 'mobile') return saved;
    return 'auto';
  });

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    /**
     * handleResize - Handles resize.
     */
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * setPreference - Performs set preference.
   */
  const setPreference = useCallback((pref: PlatformMode) => {
    localStorage.setItem(STORAGE_KEY, pref);
    setPreferenceState(pref);
  }, []);

  // Is running in Tauri desktop shell?
  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI__);

  // Determine platform type based on priority: Preference > Touch/Width
  let platform: 'desktop' | 'tablet' | 'mobile' = 'desktop';

  if (preference === 'mobile') {
    platform = 'mobile';
  } else if (preference === 'desktop') {
    platform = 'desktop';
  } else {
    // Auto detection
    const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    if (windowWidth < 768) {
      platform = 'mobile';
    } else if (windowWidth < 1024) {
      platform = isTouchDevice ? 'mobile' : 'tablet';
    } else {
      platform = 'desktop';
    }
  }

  return {
    platform,
    isMobile: platform === 'mobile',
    isTablet: platform === 'tablet',
    isDesktop: platform === 'desktop',
    isTauri,
    preference,
    setPreference,
  };
}
