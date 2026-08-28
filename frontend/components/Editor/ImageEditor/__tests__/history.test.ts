import { describe, expect, it } from 'vitest';
import { appendBoundedHistory, createHistoryEntry, type HistoryEntry } from '../history';
import { recomputeActiveEditorState } from '../historyUtils';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

const entry = (id: string): HistoryEntry => ({
  id,
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

describe('createHistoryEntry & recomputeActiveEditorState', () => {
  it('creates an extensible history entry with customVariables and toolId', () => {
    const newEntry = createHistoryEntry(
      'exposure',
      'Exposure +0.50',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      0.5,
      [],
      { toolId: 'adjust', propertyKey: 'exposure' }
    );

    expect(newEntry.type).toBe('exposure');
    expect(newEntry.toolId).toBe('adjust');
    expect(newEntry.propertyKey).toBe('exposure');
    expect(newEntry.hidden).toBe(false);
  });

  it('recomputes active adjustments selectively bypassing hidden entries', () => {
    const entry1 = createHistoryEntry(
      'exposure',
      'Exposure +0.50',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      0.5,
      [],
      { propertyKey: 'exposure' }
    );
    const entry2 = createHistoryEntry(
      'contrast',
      'Contrast +20',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      20,
      [],
      { propertyKey: 'contrast' }
    );

    // Both active
    let state = recomputeActiveEditorState([entry1, entry2], DEFAULT_ADJUSTMENTS);
    expect(state.adjustments.exposure).toBe(0.5);
    expect(state.adjustments.contrast).toBe(20);

    // Hide exposure
    entry1.hidden = true;
    state = recomputeActiveEditorState([entry1, entry2], DEFAULT_ADJUSTMENTS);
    expect(state.adjustments.exposure).toBe(DEFAULT_ADJUSTMENTS.exposure);
    expect(state.adjustments.contrast).toBe(20);
  });

  it('folds customVariables for third-party plugins', () => {
    const pluginEntry = createHistoryEntry(
      'plugin:lut-grade',
      'Kodak 2383 LUT',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      'kodak-2383',
      [],
      {
        toolId: 'lut',
        propertyKey: 'customVariables.lutProfile',
        customVariables: { lutProfile: 'kodak-2383', intensity: 0.8 },
      }
    );

    const state = recomputeActiveEditorState([pluginEntry], DEFAULT_ADJUSTMENTS);
    expect(state.customVariables.lutProfile).toBe('kodak-2383');
    expect(state.customVariables.intensity).toBe(0.8);
  });
});
