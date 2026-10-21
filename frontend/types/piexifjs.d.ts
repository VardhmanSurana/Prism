declare module 'piexifjs' {
  export function load(data: string): Record<string, any>;
  export function dump(exifObj: Record<string, any>): string;
  export function insert(exifStr: string, jpegData: string): string;
  export function remove(jpegData: string): string;
  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export const GPSIFD: Record<string, number>;
}

