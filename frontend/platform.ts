/**
 * Universal Platform Abstraction Layer (ADR-0001)
 *
 * Wraps Tauri v2 APIs when window.__TAURI__ is available,
 * and falls back seamlessly to Web Browser APIs on Web/Mobile.
 */

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI__);
};

export interface FileDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}

/**
 * Open native OS file/folder picker in Tauri, or fallback to browser <input type="file">
 */
export async function openFileDialog(options: FileDialogOptions = {}): Promise<string[] | null> {
  if (isTauriEnvironment()) {
    try {
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selected = await dialog.open({
        directory: options.directory,
        multiple: options.multiple,
        filters: options.filters,
      });
      if (!selected) return null;
      return Array.isArray(selected) ? selected : [selected];
    } catch (e) {
      console.warn('[Platform] Tauri dialog failed, falling back to Web API:', e);
    }
  }

  // Web Browser Fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = Boolean(options.multiple);
    if (options.directory) {
      input.setAttribute('webkitdirectory', 'true');
    }
    input.onchange = () => {
      if (!input.files || input.files.length === 0) {
        resolve(null);
        return;
      }
      const paths = Array.from(input.files).map((f) => f.name);
      resolve(paths);
    };
    input.click();
  });
}

/**
 * Fetch helper that resolves relative API endpoints against current origin or API_BASE
 */
export async function platformFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}
