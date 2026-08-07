import { animate } from 'animejs';
import { gsap } from 'gsap';

/**
 * Spawns a radial heart burst SVG animation at viewport coordinates (x, y).
 */
export function spawnRadialHeartBurst(x: number, y: number) {
  if (typeof document === 'undefined') return;

  const burst = document.createElement('div');
  burst.className = 'fav-burst-container';
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  burst.innerHTML = `
    <svg class="fav-burst-svg" viewBox="0 0 100 100">
      <g class="fav-burst-spikes">
        <line x1="50" y1="22" x2="50" y2="8" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="50" y1="78" x2="50" y2="92" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="22" y1="50" x2="8" y2="50" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="78" y1="50" x2="92" y2="50" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="30" y1="30" x2="20" y2="20" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="70" y1="70" x2="80" y2="80" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="70" y1="30" x2="80" y2="20" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
        <line x1="30" y1="70" x2="20" y2="80" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
      </g>
      <path class="fav-burst-heart" d="M 81 24 A 20 20 0 0 0 53 24 L 50 27 L 47 24 A 20 20 0 0 0 19 24 A 20 20 0 0 0 19 52 L 23 56 L 50 83 L 77 56 L 81 52 A 20 20 0 0 0 81 24 Z" fill="#ef4444" />
    </svg>
  `;
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 600);
}

/**
 * Spawns an unfavorite heart-shatter SVG animation at viewport coordinates (x, y).
 */
export function spawnUnfavoriteBurst(x: number, y: number) {
  if (typeof document === 'undefined') return;

  const burst = document.createElement('div');
  burst.className = 'unfav-burst-container';
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  burst.innerHTML = `
    <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible">
      <path class="unfav-left" d="M 50 27 C 48 35 52 45 48 55 L 50 83 L 23 56 L 19 52 A 20 20 0 0 1 19 24 A 20 20 0 0 1 47 24 Z" fill="#f87171" />
      <path class="unfav-right" d="M 50 27 C 48 35 52 45 48 55 L 50 83 L 77 56 L 81 52 A 20 20 0 0 0 81 24 A 20 20 0 0 0 53 24 Z" fill="#f87171" />
    </svg>
  `;
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 600);
}

/**
 * Creates a shooting heart element at (x, y).
 */
export function createFlightHeart(x: number, y: number): HTMLElement {
  const heart = document.createElement('div');
  heart.className = 'shooting-heart';
  heart.style.left = `${x - 13}px`;
  heart.style.top = `${y - 13}px`;
  heart.innerHTML = `
    <svg viewBox="0 0 24 24" fill="#ef4444" width="24" height="24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  `;
  document.body.appendChild(heart);
  return heart;
}

/**
 * Parabolic arc trajectory flight of shooting heart from start to end coordinates.
 */
export function flyHeart(
  el: HTMLElement,
  endX: number,
  endY: number,
  opts: {
    duration?: number;
    lift?: number;
    rotate?: number;
    midScale?: number;
    endScale?: number;
    endOpacity?: number;
    onComplete?: () => void;
  } = {},
) {
  const r = el.getBoundingClientRect();
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const lift = opts.lift ?? -Math.min(120, Math.abs(dy) * 0.5 + 40);
  const rotate = opts.rotate ?? (Math.random() - 0.5) * 50;
  const endScale = opts.endScale ?? 0.3;
  const endOpacity = opts.endOpacity ?? 0;
  const duration = (opts.duration ?? 480) / 1000;

  const tl = gsap.timeline({
    onComplete: () => {
      if (opts.onComplete) opts.onComplete();
    },
  });

  tl.to(
    el,
    {
      x: dx,
      y: dy,
      scale: endScale,
      rotation: rotate,
      opacity: endOpacity,
      duration,
      ease: 'power2.in',
    },
    0,
  ).to(
    el,
    {
      y: dy + lift,
      duration: duration * 0.45,
      ease: 'power2.out',
    },
    0,
  );
}

/**
 * Quick pulse feedback on target element.
 */
export function pulseElement(el: HTMLElement | null, scale = 1.05, duration = 260) {
  if (!el) return;
  animate(el, {
    scale: [1, scale, 1],
    duration,
    easing: 'easeOutQuad',
  });
}
