import type { AnyColor } from 'colord';

declare module 'colord' {
  interface Colord {
    /**
     * Returns the relative luminance of a color,
     * normalized to 0 for darkest black and 1 for lightest white.
     */
    luminance(): number;

    /**
     * Calculates a contrast ratio for a color pair (1 to 21).
     */
    contrast(color2?: AnyColor | Colord): number;

    /**
     * Checks that a background and text color pair conforms to WCAG 2.0 requirements.
     */
    isReadable(color2?: AnyColor | Colord, options?: any): boolean;

    /**
     * Returns an array of harmony colors as Colord instances.
     */
    harmonies(
      type?:
        | 'analogous'
        | 'complementary'
        | 'double-split-complementary'
        | 'rectangle'
        | 'split-complementary'
        | 'tetradic'
        | 'triadic'
    ): Colord[];
  }
}

