/**
 * useToast.ts
 * Floating toast message state + auto-dismiss timer.
 */
import { useCallback, useRef, useState } from 'react';

export interface ToastMessage {
  text: string;
  isError?: boolean;
}

export function useToast() {
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, isError });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  return { toastMessage, showToast };
}
