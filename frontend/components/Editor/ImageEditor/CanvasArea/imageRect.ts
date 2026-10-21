/**
 * imageRect.ts
 * Shared image-rectangle type and absolute-position style helper.
 */
export interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function overlayStyle(rect: ImageRect, extra?: React.CSSProperties): React.CSSProperties {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    ...extra,
  };
}
