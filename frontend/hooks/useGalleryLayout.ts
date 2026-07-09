import { useState, useCallback } from 'react';

const STORAGE_KEY = 'prism_gallery_layout';
const STORAGE_VERSION = 1;

export type RowHeight = 'compact' | 'default' | 'spacious';
export type PhotoDensity = 'relaxed' | 'default' | 'compact';

export interface GalleryLayoutSettings {
  version: number;
  rowHeight: RowHeight;
  photoDensity: PhotoDensity;
}

const ROW_HEIGHT_MAP: Record<RowHeight, number> = {
  compact: 200,
  default: 280,
  spacious: 360,
};

const DENSITY_MAP: Record<PhotoDensity, number> = {
  relaxed: 3,
  default: 4,
  compact: 5,
};

function loadSettings(): GalleryLayoutSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GalleryLayoutSettings>;
      if (parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        return { version: STORAGE_VERSION, rowHeight: 'default', photoDensity: 'default' };
      }
      return {
        version: STORAGE_VERSION,
        rowHeight: parsed.rowHeight && ROW_HEIGHT_MAP[parsed.rowHeight] !== undefined ? parsed.rowHeight : 'default',
        photoDensity: parsed.photoDensity && DENSITY_MAP[parsed.photoDensity] !== undefined ? parsed.photoDensity : 'default',
      };
    }
  } catch {}
  return { version: STORAGE_VERSION, rowHeight: 'default', photoDensity: 'default' };
}

function saveSettings(settings: GalleryLayoutSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getRowHeightPx(setting: RowHeight): number {
  return ROW_HEIGHT_MAP[setting];
}

function getMaxRowWidth(setting: PhotoDensity): number {
  return DENSITY_MAP[setting];
}

export function useGalleryLayout() {
  const [settings, setSettings] = useState<GalleryLayoutSettings>(loadSettings);

  const setRowHeight = useCallback((rowHeight: RowHeight) => {
    setSettings(prev => {
      const next = { ...prev, rowHeight };
      saveSettings(next);
      return next;
    });
  }, []);

  const setPhotoDensity = useCallback((photoDensity: PhotoDensity) => {
    setSettings(prev => {
      const next = { ...prev, photoDensity };
      saveSettings(next);
      return next;
    });
  }, []);

  return {
    settings,
    rowHeightPx: ROW_HEIGHT_MAP[settings.rowHeight],
    maxRowWidth: DENSITY_MAP[settings.photoDensity],
    setRowHeight,
    setPhotoDensity,
  };
}
