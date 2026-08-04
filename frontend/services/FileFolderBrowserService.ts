export type BrowseResult = {
  paths: string[];
  resizeWidth?: number;
};

export type BrowseOptions = {
  title?: string;
  directoryOnly?: boolean;
  multiple?: boolean;
  allowedExtensions?: string[];
  resolve: (value: BrowseResult | null) => void;
};

let showBrowserCallback: ((options: BrowseOptions) => void) | null = null;

export const registerBrowserCallback = (callback: (options: BrowseOptions) => void) => {
  showBrowserCallback = callback;
};

export const unregisterBrowserCallback = () => {
  showBrowserCallback = null;
};

export async function openFileFolderBrowser(options: Omit<BrowseOptions, 'resolve'>): Promise<BrowseResult | null> {
  if (showBrowserCallback) {
    return new Promise<BrowseResult | null>((resolve) => {
      showBrowserCallback!({
        ...options,
        resolve,
      });
    });
  }
  
  console.warn('FileFolderBrowser dialog not mounted');
  return null;
}
