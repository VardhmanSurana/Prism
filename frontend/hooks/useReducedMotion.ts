/**
 * useReducedMotion — React hook that uses GSAP matchMedia to detect
 * prefers-reduced-motion and provides a reactive boolean.
 *
 * When reduced motion is preferred:
 * - GSAP animations use duration: 0
 * - CSS transitions are killed via the existing media query in index.css
 * - Components can use this hook to conditionally skip animations
 */

import { useState, useEffect } from 'react';
import { gsap } from 'gsap';

/**
 * useReducedMotion - Hook managing reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const reduceMotion = context.conditions?.reduceMotion ?? false;
        setReducedMotion(reduceMotion);

        // Set GSAP defaults based on motion preference
        if (reduceMotion) {
          gsap.defaults({
            duration: 0,
            ease: 'none',
          });
        } else {
          gsap.defaults({
            duration: 0.3,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        }

        return () => {
          // Reset to defaults when condition changes
          gsap.defaults({
            duration: 0.3,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        };
      }
    );

    return () => {
      mm.revert();
    };
  }, []);

  return reducedMotion;
}
