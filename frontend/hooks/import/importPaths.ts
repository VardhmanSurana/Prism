import { API_BASE } from '../../constants';

/** Image/video extensions accepted for direct file import (aligned with backend support). */
export const IMPORTABLE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.heic',
  '.heif',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
  '.3gp',
] as const;

const EXT_RE = new RegExp(
  `\\.(${IMPORTABLE_EXTENSIONS.map((e) => e.slice(1)).join('|')})$`,
  'i'
);

export function isImportableMediaPath(path: string): boolean {
  return EXT_RE.test(path);
}

export interface ImportProgressStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

/**
 * Classify dropped OS paths into media files and directories.
 * Directories are expanded via the photos expand-directory API.
 */
export async function resolveDroppedPaths(
  paths: string[],
  onProgress?: (status: ImportProgressStatus) => void
): Promise<string[]> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const directFiles: string[] = [];
  const maybeDirs: string[] = [];

  for (const p of unique) {
    if (isImportableMediaPath(p)) {
      directFiles.push(p);
    } else {
      maybeDirs.push(p);
    }
  }

  const expanded: string[] = [];
  const total = maybeDirs.length;

  if (total > 0 && onProgress) {
    onProgress({
      is_scanning: true,
      total_files: total,
      processed_files: 0,
      progress: 0,
    });
  }

  for (let i = 0; i < maybeDirs.length; i++) {
    const dirPath = maybeDirs[i];
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/expand-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: dirPath }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files) && data.files.length > 0) {
          expanded.push(...data.files);
        }
      }
      // Non-directory / unsupported paths are silently skipped
    } catch (e) {
      console.error('[drag-drop] Failed to expand path:', dirPath, e);
    }

    if (onProgress && total > 0) {
      onProgress({
        is_scanning: true,
        total_files: total,
        processed_files: i + 1,
        progress: Math.round(((i + 1) / total) * 100),
      });
    }
  }

  // Preserve order: direct files first, then expanded (deduped)
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of [...directFiles, ...expanded]) {
    if (!seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}
