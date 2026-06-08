export type ConfirmOptions = {
  message: string;
  title?: string;
  resolve: (value: boolean) => void;
};

let showConfirmCallback: ((options: ConfirmOptions) => void) | null = null;

export const registerConfirmCallback = (callback: (options: ConfirmOptions) => void) => {
  showConfirmCallback = callback;
};

export const unregisterConfirmCallback = () => {
  showConfirmCallback = null;
};

export async function customConfirm(message: string, title?: string): Promise<boolean> {
  // If the global confirm callback is registered (the React modal provider is active), use it!
  if (showConfirmCallback) {
    return new Promise<boolean>((resolve) => {
      showConfirmCallback!({
        message,
        title,
        resolve,
      });
    });
  }
  
  // Fallback to browser confirm in case it's called before mounting
  return window.confirm(message);
}
