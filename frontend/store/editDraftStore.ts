/**
 * editDraftStore.ts
 * Manages local persistence of non-destructive image editor drafts.
 * Enables work-in-progress recovery across browser reloads, tab closes, or app restarts.
 */

import { Adjustments } from '@/components/Editor/ImageEditor/filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

export interface EditDraft {
  version: number;
  photoId: string | number;
  lastModified: number;
  adjustments: Adjustments;
  totalRotation: number;
  straightenAngle: number;
  flipH: boolean;
  flipV: boolean;
  cropBoxData?: any;
  annotations: Annotation[];
  rawSettings?: any;
  liquifySettings?: any;
}

const STORAGE_PREFIX = 'prism_edit_draft_';

export function getDraftStorageKey(photoId: string | number): string {
  return `${STORAGE_PREFIX}${photoId}`;
}

export function saveEditDraft(photoId: string | number, draftData: Omit<EditDraft, 'version' | 'photoId' | 'lastModified'>): void {
  if (!photoId) return;
  try {
    const draft: EditDraft = {
      version: 1,
      photoId,
      lastModified: Date.now(),
      ...draftData,
    };
    localStorage.setItem(getDraftStorageKey(photoId), JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save edit draft to localStorage:', e);
  }
}

export function getEditDraft(photoId: string | number): EditDraft | null {
  if (!photoId) return null;
  try {
    const raw = localStorage.getItem(getDraftStorageKey(photoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditDraft;
    if (parsed && parsed.version === 1 && parsed.adjustments) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load edit draft from localStorage:', e);
  }
  return null;
}

export function clearEditDraft(photoId: string | number): void {
  if (!photoId) return;
  try {
    localStorage.removeItem(getDraftStorageKey(photoId));
  } catch (e) {
    console.warn('Failed to clear edit draft from localStorage:', e);
  }
}

export function hasEditDraft(photoId: string | number): boolean {
  if (!photoId) return false;
  return Boolean(localStorage.getItem(getDraftStorageKey(photoId)));
}
