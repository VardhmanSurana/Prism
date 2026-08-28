import { describe, expect, it } from 'vitest';
import { appendBoundedHistory, type HistoryEntry } from '../history';

const entry = (id: string): HistoryEntry => ({
  id,
  timestamp: 0,
  type: 'inpaint',
  description: id,
  imageSrc: `blob:${id}`,
  adjustments: {} as HistoryEntry['adjustments'],
  rotation: 0,
  flipH: false,
  flipV: false,
  straightenAngle: 0,
});

describe('appendBoundedHistory', () => {
  it('evicts oldest entries while retaining the newest undo states', () => {
    const result = appendBoundedHistory([entry('original'), entry('one')], 1, entry('two'), 2);

    expect(result.history.map(({ id }) => id)).toEqual(['one', 'two']);
    expect(result.currentHistoryIndex).toBe(1);
    expect(result.evicted.map(({ id }) => id)).toEqual(['original']);
  });

  it('returns abandoned redo states for blob URL cleanup', () => {
    const result = appendBoundedHistory([entry('original'), entry('one'), entry('redo')], 1, entry('two'));

    expect(result.history.map(({ id }) => id)).toEqual(['original', 'one', 'two']);
    expect(result.evicted.map(({ id }) => id)).toEqual(['redo']);
  });
});
