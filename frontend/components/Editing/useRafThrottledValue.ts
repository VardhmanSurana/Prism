import { useCallback, useEffect, useRef, useState } from 'react';

export function useRafThrottledValue<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  const rafIdRef = useRef<number | null>(null);
  const nextValueRef = useRef<T>(initialValue);

  useEffect(() => {
    setValue(initialValue);
    nextValueRef.current = initialValue;
  }, [initialValue]);

  const setRafValue = useCallback((next: T) => {
    nextValueRef.current = next;

    if (rafIdRef.current !== null) return;

    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      setValue(nextValueRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { value, setRafValue };
}
