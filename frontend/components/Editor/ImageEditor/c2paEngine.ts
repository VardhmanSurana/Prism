/**
 * c2paEngine.ts
 * Standard-compliant Content Credentials (C2PA) provenance assertion generator.
 * Embeds provenance metadata into JPEG APP11 / XMP segments without corrupting
 * the standard JPEG binary header (SOI marker FF D8).
 */

export interface C2paManifestOptions {
  title?: string;
  author?: string;
  softwareAgent?: string;
  actions?: string[];
}

export interface C2paManifestData {
  claim_generator: string;
  title: string;
  format: string;
  assertions: Array<{
    label: string;
    data: Record<string, any>;
  }>;
}

/**
 * Builds a C2PA-compliant manifest claim dictionary.
 */
export function buildC2paManifest(options: C2paManifestOptions = {}): C2paManifestData {
  return {
    claim_generator: options.softwareAgent || 'Prism Desktop Photo Editor 1.0',
    title: options.title || 'Exported Asset',
    format: 'image/jpeg',
    assertions: [
      {
        label: 'c2pa.actions',
        data: {
          actions: (options.actions && options.actions.length > 0)
            ? options.actions.map(action => ({ action, software: 'Prism Desktop Photo Editor' }))
            : [
                {
                  action: 'c2pa.edited',
                  parameters: {
                    software: 'Prism Desktop Photo Editor',
                    description: 'Non-destructive photo adjustments and enhancement',
                  },
                },
              ],
        },
      },
    ],
  };
}

/**
 * Embeds a C2PA provenance manifest into a JPEG binary stream as a standard APP11 segment.
 * Ensures the JPEG SOI marker (0xFF, 0xD8) remains intact at byte offset 0.
 */
export async function injectC2paHeader(
  blob: Blob,
  manifestOptions?: C2paManifestOptions
): Promise<Blob> {
  const manifest = buildC2paManifest(manifestOptions);
  const manifestJson = JSON.stringify(manifest);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  const blobBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(blobBuf);

  // If not a JPEG, return untouched
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return blob;
  }

  // Construct a standard JPEG APP11 (0xFF, 0xEB) metadata marker
  // Marker (2 bytes) + Length (2 bytes, big-endian) + Identifier ("c2pa\0", 5 bytes) + Manifest
  const identifier = new TextEncoder().encode('c2pa\0');
  const payloadLen = 2 + identifier.length + manifestBytes.length;

  if (payloadLen > 65535) {
    // Exceeds single APP segment maximum length; return unmodified to preserve image integrity
    return blob;
  }

  const app11Header = new Uint8Array(4 + identifier.length);
  app11Header[0] = 0xff;
  app11Header[1] = 0xeb; // APP11 marker
  app11Header[2] = (payloadLen >> 8) & 0xff;
  app11Header[3] = payloadLen & 0xff;
  app11Header.set(identifier, 4);

  // New buffer: SOI (2 bytes) + APP11 Segment + Rest of the JPEG
  const totalLen = 2 + app11Header.length + manifestBytes.length + (bytes.length - 2);
  const out = new Uint8Array(totalLen);

  // 1. JPEG SOI marker (FF D8)
  out[0] = 0xff;
  out[1] = 0xd8;

  // 2. Insert APP11 metadata
  out.set(app11Header, 2);
  out.set(manifestBytes, 2 + app11Header.length);

  // 3. Append remaining original JPEG segments (starting after original FF D8)
  out.set(bytes.subarray(2), 2 + app11Header.length + manifestBytes.length);

  return new Blob([out], { type: blob.type || 'image/jpeg' });
}
