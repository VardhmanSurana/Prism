/**
 * Client-side rename pattern expansion (mirrors backend batch-rename tokens).
 * Tokens: {n}/{nn}/{nnn}/{nnnn}, {name}, {ext}, {date}, {yyyy}, {mm}, {dd}
 */

const TOKEN_RE = /\{(n{1,4}|name|ext|date|yyyy|mm|dd)\}/gi;
const INVALID_NAME = /[/\\]|[\x00-\x1f]/;

export interface RenamePreviewItem {
  sourcePath: string;
  sourceName: string;
  index: number;
  destName: string;
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

export function applyRenamePattern(
  originalName: string,
  pattern: string,
  index: number,
  preserveExtension = true
): string {
  const lastDot = originalName.lastIndexOf('.');
  const hasExt = lastDot > 0;
  const stem = hasExt ? originalName.slice(0, lastDot) : originalName;
  const ext = hasExt ? originalName.slice(lastDot + 1) : '';
  const now = new Date();

  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const yyyy = String(now.getFullYear());
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);

  const newName = pattern.replace(TOKEN_RE, (match, token: string) => {
    const t = token.toLowerCase();
    if (t === 'name') return stem;
    if (t === 'ext') return ext;
    if (t === 'date') return `${yyyy}-${mm}-${dd}`;
    if (t === 'yyyy') return yyyy;
    if (t === 'mm') return mm;
    if (t === 'dd') return dd;
    // n, nn, nnn, nnnn
    return pad(index, t.length);
  });

  if (
    preserveExtension &&
    ext &&
    !/\{ext\}/i.test(pattern) &&
    !newName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)
  ) {
    return `${newName}.${ext}`;
  }

  return newName;
}

function validateBasename(name: string): string | null {
  if (!name || !name.trim()) return 'New name is empty';
  if (name === '.' || name === '..') return 'Invalid name';
  if (INVALID_NAME.test(name)) return 'Name contains invalid characters';
  return null;
}

export function buildRenamePreview(
  paths: string[],
  pattern: string,
  startIndex = 1,
  preserveExtension = true
): RenamePreviewItem[] {
  const destSeen = new Map<string, number>();
  const items: RenamePreviewItem[] = [];

  paths.forEach((sourcePath, i) => {
    const index = startIndex + i;
    const sourceName = sourcePath.split('/').pop() || sourcePath;
    const destName = applyRenamePattern(sourceName, pattern, index, preserveExtension);
    const err = validateBasename(destName);

    const item: RenamePreviewItem = {
      sourcePath,
      sourceName,
      index,
      destName,
      ok: !err,
      error: err || undefined,
      skipped: !err && destName === sourceName,
    };

    if (item.ok) {
      const key = destName.toLowerCase();
      if (destSeen.has(key)) {
        item.ok = false;
        item.skipped = false;
        item.error = 'Duplicate destination name in this batch';
      } else {
        destSeen.set(key, i);
      }
    }

    items.push(item);
  });

  return items;
}

export const PATTERN_HELP = [
  { token: '{n}', meaning: 'Sequence (1, 2, 3…)' },
  { token: '{nn}', meaning: 'Padded 2 digits (01, 02…)' },
  { token: '{nnn}', meaning: 'Padded 3 digits (001…)' },
  { token: '{name}', meaning: 'Original name without extension' },
  { token: '{ext}', meaning: 'Original extension' },
  { token: '{date}', meaning: 'Today as YYYY-MM-DD' },
] as const;
