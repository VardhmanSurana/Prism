/**
 * exifPreserver.ts
 * Utility to extract original camera EXIF metadata from source images and inject
 * it into exported JPEG blobs so photographic metadata is preserved across edits.
 */

import piexif from 'piexifjs';

/**
 * Converts a Blob to a base64 Data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a base64 Data URL string to a Blob.
 */
function dataUrlToBlob(dataUrl: string, mimeType = 'image/jpeg'): Blob {
  const parts = dataUrl.split(',');
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

/**
 * Attempts to preserve original EXIF metadata from the source image in the exported JPEG blob.
 * If source has no EXIF or operation fails, returns the exported blob unmodified.
 *
 * @param sourceSrc - URL or Data URL of the original source image
 * @param exportedBlob - The new exported image Blob
 * @param outputWidth - Optional target image pixel width
 * @param outputHeight - Optional target image pixel height
 */
export async function preserveExifMetadata(
  sourceSrc: string,
  exportedBlob: Blob,
  outputWidth?: number,
  outputHeight?: number
): Promise<Blob> {
  if (!exportedBlob.type.includes('jpeg') && !exportedBlob.type.includes('jpg')) {
    return exportedBlob;
  }

  try {
    let sourceDataUrl = sourceSrc;

    // If source is a remote or blob URL, fetch as blob first
    if (sourceSrc.startsWith('http') || sourceSrc.startsWith('blob:') || sourceSrc.startsWith('/')) {
      const resp = await fetch(sourceSrc);
      const srcBlob = await resp.blob();
      sourceDataUrl = await blobToDataUrl(srcBlob);
    }

    if (!sourceDataUrl.startsWith('data:image/jpeg') && !sourceDataUrl.startsWith('data:image/jpg')) {
      return exportedBlob;
    }

    // Extract EXIF dictionary from source image
    const exifObj = piexif.load(sourceDataUrl);
    if (!exifObj || (!exifObj['0th'] && !exifObj['Exif'])) {
      return exportedBlob;
    }

    // Ensure 0th IFD exists and update dimensions / software tag
    if (!exifObj['0th']) exifObj['0th'] = {};
    if (outputWidth && outputHeight) {
      exifObj['0th'][piexif.ImageIFD.ImageWidth] = outputWidth;
      exifObj['0th'][piexif.ImageIFD.ImageLength] = outputHeight;
    }
    exifObj['0th'][piexif.ImageIFD.Software] = 'Prism Desktop Photo Editor';

    // Remove thumbnail to keep exported file size lean
    delete exifObj['thumbnail'];

    const exifBytes = piexif.dump(exifObj);
    const exportedDataUrl = await blobToDataUrl(exportedBlob);

    // Insert original EXIF into new exported JPEG
    const withExifDataUrl = piexif.insert(exifBytes, exportedDataUrl);
    return dataUrlToBlob(withExifDataUrl, exportedBlob.type);
  } catch (err) {
    console.warn('[exifPreserver] Could not transfer EXIF metadata to exported JPEG:', err);
    return exportedBlob;
  }
}

