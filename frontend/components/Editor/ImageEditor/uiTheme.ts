/**
 * uiTheme.ts
 * Single source of truth helper for Image Editor UI button and container styling.
 * Modifying `image-editor.css` CSS variables or this file will uniformly change
 * the behavior and colors of all buttons across the entire Image Editor.
 */

/**
 * Returns the unified class names for any button in the Image Editor.
 * @param isActive Whether the button is currently selected/active.
 * @param variant 'chip' (rounded-lg), 'pill' (rounded-full), 'card' (rounded-xl), or 'raw' (no radius).
 * @param extra Custom layout/dimension classes (e.g. 'w-full', 'h-10', 'py-2 px-3').
 */
export const getEditorBtnClass = (
  isActive: boolean,
  variant: 'chip' | 'pill' | 'card' | 'raw' = 'chip',
  extra = ''
): string => {
  const variantClass =
    variant === 'pill'
      ? 'editor-pill-btn'
      : variant === 'card'
      ? 'editor-card-btn'
      : variant === 'chip'
      ? 'editor-chip-btn'
      : '';

  return `editor-btn ${variantClass} ${isActive ? 'active' : ''} ${extra}`.trim();
};
