/**
 * useReducedMotion — React hook that detects prefers-reduced-motion
 * using Framer Motion and provides a reactive boolean.
 */

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/**
 * useReducedMotion - Hook managing reduced motion.
 */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

