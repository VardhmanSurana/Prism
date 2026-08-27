/**
 * canvasToBlob - Performs canvas to blob.
 */
export const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export returned an empty blob.'))), mimeType, quality);
  });

