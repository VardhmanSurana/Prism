import { describe, it, expect } from 'vitest';
import { preserveExifMetadata } from '../utils/exifPreserver';

describe('exifPreserver', () => {
  it('returns non-jpeg blobs unmodified', async () => {
    const pngBlob = new Blob(['png data'], { type: 'image/png' });
    const result = await preserveExifMetadata('test.jpg', pngBlob);
    expect(result).toBe(pngBlob);
  });

  it('handles source with no EXIF gracefully without throwing', async () => {
    const jpegBlob = new Blob(['mock jpeg'], { type: 'image/jpeg' });
    const result = await preserveExifMetadata('data:image/jpeg;base64,/9j/4AAQSkZJRg==', jpegBlob);
    expect(result).toBeDefined();
    expect(result.type).toBe('image/jpeg');
  });
});

