declare module 'imagetracerjs' {
  interface TraceOptions {
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    blurradius?: number;
    blurdelta?: number;
    pathomit?: number;
    scale?: number;
    ltres?: number;
    qtres?: number;
    [key: string]: unknown;
  }

  interface ImageTracerInstance {
    imageToSVG(img: string | HTMLImageElement, options?: TraceOptions): string;
    imagedataToSVG(imgd: ImageData, options?: TraceOptions): string;
  }

  const ImageTracer: ImageTracerInstance;
  export default ImageTracer;
}
