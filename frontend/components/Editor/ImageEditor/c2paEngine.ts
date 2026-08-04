export interface C2paManifestOptions {
  title?: string;
  author?: string;
  softwareAgent?: string;
}

export function buildC2paManifest(options: C2paManifestOptions = {}): ArrayBuffer {
  const manifest = {
    claim_generator: options.softwareAgent || 'Prism Image Editor 1.0',
    title: options.title || 'Exported Asset',
    assertions: [
      {
        label: 'stref.actions',
        data: {
          actions: [
            {
              action: 'c2pa.edited',
              parameters: {
                software: 'Prism Desktop Image Editor',
              },
            },
          ],
        },
      },
    ],
  };

  const str = JSON.stringify(manifest);
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

export async function injectC2paHeader(blob: Blob, manifestOptions?: C2paManifestOptions): Promise<Blob> {
  // Append C2PA manifest header block
  const manifestBuf = buildC2paManifest(manifestOptions);
  const blobBuf = await blob.arrayBuffer();

  const combined = new Uint8Array(blobBuf.byteLength + manifestBuf.byteLength + 16);
  const header = new TextEncoder().encode('C2PA_MANIFEST:');

  combined.set(header, 0);
  combined.set(new Uint8Array(manifestBuf), 14);
  combined.set(new Uint8Array(blobBuf), 14 + manifestBuf.byteLength);

  return new Blob([combined], { type: blob.type });
}
