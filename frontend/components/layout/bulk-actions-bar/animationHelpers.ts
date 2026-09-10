import { animate } from 'framer-motion';

export const EASE = [0.33, 1, 0.68, 1] as const;

/**
 * nextFrame - Performs next frame.
 */
export const nextFrame = (cb: () => void) => {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(() => cb());
  } else {
    cb();
  }
};

/**
 * delay - Performs delay.
 */
export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Parabolic arc flight for a cloned card to the trash target using Framer Motion. */
export function flyToTrash(
  el: HTMLElement,
  endX: number,
  endY: number,
  opts: { duration?: number; onComplete?: () => void } = {},
) {
  const r = el.getBoundingClientRect();
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const lift = -Math.min(140, Math.abs(dy) * 0.4 + 40);
  const rotate = (Math.random() - 0.5) * 240;
  const duration = (opts.duration ?? 420) / 1000;

  animate(el, {
    x: dx,
    y: [0, dy + lift, dy],
    rotate,
    scale: [1, 0.85, 0.02],
    opacity: [1, 1, 0],
  }, {
    duration,
    times: [0, 0.4, 1],
    ease: 'easeOut',
    onComplete: opts.onComplete,
  });
}

/** Burst of small colored particles at (x, y). */
export function spawnParticles(x: number, y: number, count = 10) {
  const colors = ['#ef4444', '#f87171', '#fca5a5', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'trash-particle';
    const size = Math.random() * 6 + 3;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    document.body.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 80 + 30;
    const duration = (500 + Math.random() * 300) / 1000;

    animate(p, {
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 20,
      scale: 0,
      opacity: 0,
    }, {
      duration,
      ease: 'easeOut',
      onComplete: () => p.remove(),
    });
  }
}

/** Gulp bounce on the trash-can inner wrapper. */
export function gulpBounce(inner: HTMLElement | null) {
  if (!inner) return;
  animate(inner, {
    scaleX: [1, 1.22, 0.92, 1],
    scaleY: [1, 0.85, 1.08, 1],
  }, {
    duration: 0.3,
    ease: 'easeOut',
  });
}
