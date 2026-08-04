import { describe, it, expect } from 'vitest';
import { isImportableMediaPath } from '../importPaths';

describe('isImportableMediaPath', () => {
  it('accepts common image paths', () => {
    expect(isImportableMediaPath('/home/u/Pictures/a.JPG')).toBe(true);
    expect(isImportableMediaPath('/tmp/photo.webp')).toBe(true);
    expect(isImportableMediaPath('/tmp/scan.heic')).toBe(true);
  });

  it('accepts video paths', () => {
    expect(isImportableMediaPath('/media/clip.mp4')).toBe(true);
    expect(isImportableMediaPath('/media/clip.MOV')).toBe(true);
  });

  it('rejects non-media and bare dirs', () => {
    expect(isImportableMediaPath('/home/u/Pictures')).toBe(false);
    expect(isImportableMediaPath('/tmp/notes.txt')).toBe(false);
    expect(isImportableMediaPath('/tmp/archive.zip')).toBe(false);
  });
});
