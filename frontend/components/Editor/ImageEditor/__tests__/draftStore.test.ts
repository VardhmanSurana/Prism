import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveEditDraft,
  getEditDraft,
  clearEditDraft,
  hasEditDraft,
  getDraftStorageKey,
} from '@/store/editDraftStore';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

describe('editDraftStore', () => {
  const photoId = 'test-photo-100';

  const mockStorage: Record<string, string> = {};
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
        clear: () => {
          for (const k in mockStorage) delete mockStorage[k];
        },
      },
      configurable: true,
      writable: true,
    });
    localStorage.clear();
  });

  it('saves and retrieves an edit draft', () => {
    expect(hasEditDraft(photoId)).toBe(false);
    expect(getEditDraft(photoId)).toBeNull();

    const adjustments = { ...DEFAULT_ADJUSTMENTS, exposure: 25, contrast: 10 };
    saveEditDraft(photoId, {
      adjustments,
      totalRotation: 90,
      straightenAngle: 0,
      flipH: true,
      flipV: false,
      annotations: [],
    });

    expect(hasEditDraft(photoId)).toBe(true);
    const draft = getEditDraft(photoId);
    expect(draft).not.toBeNull();
    expect(draft?.photoId).toBe(photoId);
    expect(draft?.adjustments.exposure).toBe(25);
    expect(draft?.adjustments.contrast).toBe(10);
    expect(draft?.totalRotation).toBe(90);
    expect(draft?.flipH).toBe(true);
  });

  it('clears an existing draft', () => {
    saveEditDraft(photoId, {
      adjustments: DEFAULT_ADJUSTMENTS,
      totalRotation: 0,
      straightenAngle: 0,
      flipH: false,
      flipV: false,
      annotations: [],
    });
    expect(hasEditDraft(photoId)).toBe(true);

    clearEditDraft(photoId);
    expect(hasEditDraft(photoId)).toBe(false);
    expect(getEditDraft(photoId)).toBeNull();
  });

  it('handles invalid json safely', () => {
    localStorage.setItem(getDraftStorageKey(photoId), 'invalid-json');
    expect(getEditDraft(photoId)).toBeNull();
  });
});

