import { describe, it, expect } from 'vitest';
import { buildC2paManifest, injectC2paHeader } from '../c2paEngine';

describe('c2paEngine', () => {
  it('builds a valid manifest structure', () => {
    const manifest = buildC2paManifest({ title: 'Sample Photo', author: 'Jane Doe' });
    expect(manifest.title).toBe('Sample Photo');
    expect(manifest.format).toBe('image/jpeg');
    expect(manifest.claim_generator).toContain('Prism');
    expect(manifest.assertions[0].label).toBe('c2pa.actions');
  });

  it('preserves non-jpeg blobs intact', async () => {
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const result = await injectC2paHeader(pngBlob);
    const buf = new Uint8Array(await result.arrayBuffer());
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it('injects standard APP11 marker after SOI into JPEG without corrupting FF D8', async () => {
    // Minimal mock JPEG with SOI (FF D8) + EOI (FF D9)
    const mockJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const jpegBlob = new Blob([mockJpegBytes], { type: 'image/jpeg' });

    const result = await injectC2paHeader(jpegBlob, { title: 'Test Asset' });
    const buf = new Uint8Array(await result.arrayBuffer());

    // Byte 0 & 1 must be JPEG SOI (0xFF, 0xD8)
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);

    // Byte 2 & 3 must be JPEG APP11 marker (0xFF, 0xEB)
    expect(buf[2]).toBe(0xff);
    expect(buf[3]).toBe(0xeb);

    // Byte 6-10 should contain "c2pa\0" identifier
    const identifier = new TextDecoder().decode(buf.subarray(6, 11));
    expect(identifier).toBe('c2pa\0');

    // Last 2 bytes should still be EOI (0xFF, 0xD9)
    expect(buf[buf.length - 2]).toBe(0xff);
    expect(buf[buf.length - 1]).toBe(0xd9);
  });
});

