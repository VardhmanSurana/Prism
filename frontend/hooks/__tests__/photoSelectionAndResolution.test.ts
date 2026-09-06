import { describe, it, expect } from 'vitest';
import { resolveUrl } from '../../constants';

describe('resolveUrl for Image Editor loading', () => {
  it('correctly resolves local:// URIs to the backend local file endpoint', () => {
    const localUri = 'local:///home/chotaxdon/Pictures/Camera/papa.png';
    const resolved = resolveUrl(localUri);

    expect(resolved).not.toContain('local://');
    expect(resolved).toContain('/local?path=');
    expect(resolved).toContain(encodeURIComponent('/home/chotaxdon/Pictures/Camera/papa.png'));
  });

  it('correctly resolves absolute filesystem paths', () => {
    const rawPath = '/home/chotaxdon/Pictures/Camera/papa.png';
    const resolved = resolveUrl(rawPath);

    expect(resolved).toContain('/local?path=');
    expect(resolved).toContain(encodeURIComponent(rawPath));
  });

  it('leaves blob: and data: URIs untouched', () => {
    const blobUri = 'blob:http://localhost:3005/some-uuid';
    const dataUri = 'data:image/png;base64,iVBORw0KGgo';

    expect(resolveUrl(blobUri)).toBe(blobUri);
    expect(resolveUrl(dataUri)).toBe(dataUri);
  });

  it('leaves already resolved http(s) URLs untouched', () => {
    const httpUrl = 'http://127.0.0.1:8269/local?path=%2Fhome%2Fuser%2Fphoto.jpg';
    expect(resolveUrl(httpUrl)).toBe(httpUrl);
  });

  it('correctly resolves relative api/v1 paths', () => {
    const apiPath = '/api/v1/photos/8225/file';
    const resolved = resolveUrl(apiPath);

    expect(resolved).toContain('/api/v1/photos/8225/file');
    expect(resolved).toMatch(/^http:\/\//);
  });

  it('preserves query parameters when resolving local paths', () => {
    const resolved = resolveUrl('local:///home/photo.jpg?nocache=8225');
    expect(resolved).toContain('/local?path=');
    expect(resolved).toContain('nocache=8225');
    expect(resolved.startsWith('http')).toBe(true);
  });
});

