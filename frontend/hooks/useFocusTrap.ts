import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * getFocusableElements - Retrieves all visible focusable elements within container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    return true;
  });
}

/**
 * useFocusTrap - Accessible focus trap hook for dialogs, modals, and palettes.
 *
 * - Stores previously active element on open and restores on close/unmount.
 * - Automatically moves focus to first focusable child or container.
 * - Traps Tab and Shift+Tab cycles strictly within the container.
 * - Catches Escape key to invoke onClose.
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose?: () => void
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      previouslyFocusedRef.current = document.activeElement;
    }

    const focusInitialElement = () => {
      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      // Avoid stealing focus if already focused on an element inside the container
      if (
        document.activeElement &&
        currentContainer.contains(document.activeElement) &&
        document.activeElement !== currentContainer
      ) {
        return;
      }

      const focusables = getFocusableElements(currentContainer);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        if (!currentContainer.hasAttribute('tabindex')) {
          currentContainer.setAttribute('tabindex', '-1');
        }
        currentContainer.focus();
      }
    };

    focusInitialElement();
    const rafId = requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key !== 'Tab') return;

      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      const focusables = getFocusableElements(currentContainer);
      if (focusables.length === 0) {
        e.preventDefault();
        currentContainer.focus();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab: Wrap from first element to last
        if (activeElement === firstElement || !currentContainer.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Wrap from last element to first
        if (activeElement === lastElement || !currentContainer.contains(activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);

      if (
        previouslyFocusedRef.current &&
        typeof previouslyFocusedRef.current.focus === 'function' &&
        document.body.contains(previouslyFocusedRef.current)
      ) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, containerRef, onClose]);
}
