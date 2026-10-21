/**
 * useLassoAnimation.ts
 * Animated marching-ants dash offset driven by a 60fps RAF loop.
 */
import { useEffect, useState } from 'react';

export function useLassoAnimation(period = 12, intervalMs = 65): number {
  const [dashOffset, setDashOffset] = useState(0);

  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (time - lastTime >= intervalMs) {
        setDashOffset(prev => (prev + 1) % period);
        lastTime = time;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [period, intervalMs]);

  return dashOffset;
}
