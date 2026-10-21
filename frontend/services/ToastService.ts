/**
 * Lightweight global toast notifications.
 *
 * Follows the ConfirmService pattern: a module-level service that any code
 * (hooks, plain fetch wrappers) can call, with a React host component
 * (`ToastHost`) registered at app root that renders the actual UI. No
 * provider or store required.
 */

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastOptions {
  id?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms (default 5000). */
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

type ShowToastCallback = (toast: ToastItem) => void;

let showToastCallback: ShowToastCallback | null = null;

/**
 * registerToastCallback - Registers the React host that renders toasts.
 * Called by `ToastHost` on mount; must be unregistered on unmount.
 */
export const registerToastCallback = (callback: ShowToastCallback | null) => {
  showToastCallback = callback;
};

/**
 * showToast - Fires a global toast notification.
 * Safe to call before the host mounts (message is dropped with a console
 * warning) and safe to call outside React (event handlers, fetch wrappers).
 */
export function showToast(message: string, options: ToastOptions = {}): string {
  const toast: ToastItem = {
    id: options.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    message,
    variant: options.variant ?? 'info',
    durationMs: options.durationMs ?? 5000,
  };

  if (showToastCallback) {
    showToastCallback(toast);
  } else {
    console.warn('[ToastService] No ToastHost registered; dropped toast:', message);
  }
  return toast.id;
}

/**
 * dismissToast - Removes a toast by id (host renders the dismiss affordance).
 * The service simply forwards; unknown ids are ignored by the host.
 */
export type DismissToastCallback = (id: string) => void;

let dismissToastCallback: DismissToastCallback | null = null;

/**
 * registerDismissCallback - Registers the host's dismiss handler.
 */
export const registerDismissCallback = (callback: DismissToastCallback | null) => {
  dismissToastCallback = callback;
};

/**
 * dismissToast - Requests dismissal of a toast by id.
 */
export function dismissToast(id: string) {
  dismissToastCallback?.(id);
}
