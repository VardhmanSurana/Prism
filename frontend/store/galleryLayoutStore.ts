import { create } from 'zustand';

const STORAGE_KEY = 'prism_gallery_layout';
const STORAGE_VERSION = 2;

export type RowHeight = 'compact' | 'default' | 'spacious';
export type PhotoDensity = 'relaxed' | 'default' | 'compact';
export type GalleryStyle = 'prism' | 'google' | 'apple';
export type ImageGrouping = 'none' | 'months' | 'years';

export interface GalleryLayoutSettings {
  version: number;
  rowHeight: RowHeight;
  photoDensity: PhotoDensity;
  galleryStyle: GalleryStyle;
  imageGrouping: ImageGrouping;
  cornerRadius: number; // 0-24px, 0 = sharp
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

const GALLERY_STYLE_MAP: Record<GalleryStyle, string> = {
  prism: 'Prism',
  google: 'Google Photos',
  apple: 'Apple Photos',
};

function loadSettings(): GalleryLayoutSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GalleryLayoutSettings>;
      if (parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
      return { version: STORAGE_VERSION, rowHeight: 'default', photoDensity: 'default', galleryStyle: 'prism', imageGrouping: 'none', cornerRadius: 0 };
    }
    return {
      version: STORAGE_VERSION,
      rowHeight: parsed.rowHeight && ROW_HEIGHT_MAP[parsed.rowHeight] !== undefined ? parsed.rowHeight : 'default',
      photoDensity: parsed.photoDensity && DENSITY_MAP[parsed.photoDensity] !== undefined ? parsed.photoDensity : 'default',
      galleryStyle: parsed.galleryStyle && GALLERY_STYLE_MAP[parsed.galleryStyle] !== undefined ? parsed.galleryStyle : 'prism',
      imageGrouping: parsed.imageGrouping || 'none',
      cornerRadius: typeof parsed.cornerRadius === 'number' ? parsed.cornerRadius : 0,
    };
    }
  } catch {}
  return { version: STORAGE_VERSION, rowHeight: 'default', photoDensity: 'default', galleryStyle: 'prism', imageGrouping: 'none', cornerRadius: 0 };
}

function saveSettings(settings: GalleryLayoutSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface GalleryLayoutState {
  settings: GalleryLayoutSettings;
  rowHeightPx: number;
  maxRowWidth: number;
  galleryStyle: GalleryStyle;
  setRowHeight: (rowHeight: RowHeight) => void;
  setPhotoDensity: (photoDensity: PhotoDensity) => void;
  setGalleryStyle: (galleryStyle: GalleryStyle) => void;
  setImageGrouping: (imageGrouping: ImageGrouping) => void;
  setCornerRadius: (cornerRadius: number) => void;
}

export const useGalleryLayoutStore = create<GalleryLayoutState>((set) => ({
  settings: loadSettings(),
  rowHeightPx: ROW_HEIGHT_MAP[loadSettings().rowHeight],
  maxRowWidth: DENSITY_MAP[loadSettings().photoDensity],
  galleryStyle: loadSettings().galleryStyle,

  setRowHeight: (rowHeight) =>
    set((state) => {
      const next = { ...state.settings, rowHeight };
      saveSettings(next);
      return {
        settings: next,
        rowHeightPx: ROW_HEIGHT_MAP[rowHeight],
      };
    }),

  setPhotoDensity: (photoDensity) =>
    set((state) => {
      const next = { ...state.settings, photoDensity };
      saveSettings(next);
      return {
        settings: next,
        maxRowWidth: DENSITY_MAP[photoDensity],
      };
    }),

  setGalleryStyle: (galleryStyle) =>
    set((state) => {
      const next = { ...state.settings, galleryStyle };
      saveSettings(next);
      return {
        settings: next,
        galleryStyle,
      };
    }),

  setImageGrouping: (imageGrouping) =>
    set((state) => {
      const next = { ...state.settings, imageGrouping };
      saveSettings(next);
      return { settings: next };
    }),

  setCornerRadius: (cornerRadius) =>
    set((state) => {
      const next = { ...state.settings, cornerRadius };
      saveSettings(next);
      return { settings: next };
    }),
}));

export function getRowHeightPx(setting: RowHeight): number {
  return ROW_HEIGHT_MAP[setting];
}

export function getMaxRowWidth(setting: PhotoDensity): number {
  return DENSITY_MAP[setting];
}
