/**
 * Minimal performance profiling utilities for Prism.
 * Only active in development — all calls are no-ops in production.
 */

const isDev = import.meta.env.DEV;

function mark(name: string) {
  if (isDev) performance.mark(`prism:${name}`);
}

function measure(name: string, startMark: string, endMark?: string) {
  if (!isDev) return;
  const end = endMark || `prism:${name}:end`;
  performance.mark(end);
  try {
    const entry = performance.measure(`prism:${name}`, `prism:${startMark}`, end);
    const duration = (entry as any).duration ?? 0;
    if (duration > 16) {
      console.log(`[perf] ${name}: ${duration.toFixed(1)}ms`);
    }
  } catch {}
  performance.clearMarks(`prism:${startMark}`);
  performance.clearMarks(end);
  performance.clearMeasures(`prism:${name}`);
}

/** Wrap a callback with performance measurement. Logs if >16ms (one frame). */
function profiled<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  if (!isDev) return fn;
  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    const duration = performance.now() - start;
    if (duration > 16) {
      console.log(`[perf] ${name}: ${duration.toFixed(1)}ms`);
    }
    return result;
  }) as T;
}

/** Returns a function to call each render. Logs if <30 renders/sec during scroll. */
export function useRenderCounter(componentName: string) {
  if (!isDev) return null;
  const countRef = { current: 0 };
  const lastLogRef = { current: performance.now() };

  return () => {
    countRef.current++;
    const now = performance.now();
    if (now - lastLogRef.current > 3000) {
      const fps = Math.round((countRef.current * 1000) / (now - lastLogRef.current));
      if (fps < 30) {
        console.log(`[perf] ${componentName}: ${fps} renders/3s (LOW)`);
      } else {
        console.log(`[perf] ${componentName}: ${fps} renders/3s`);
      }
      countRef.current = 0;
      lastLogRef.current = now;
    }
  };
}
