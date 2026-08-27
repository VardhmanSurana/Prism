import { animate } from 'animejs';
import { gsap } from 'gsap';

export const EASE = 'easeOutCubic';

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

/** Parabolic arc flight for a cloned card to the trash target using GSAP. */
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

  const tl = gsap.timeline({
    onComplete: opts.onComplete,
  });

  tl.to(
    el,
    {
      x: dx,
      rotation: rotate,
      duration,
      ease: 'power2.out',
    },
    0,
  );

  tl.to(
    el,
    {
      y: dy + lift,
      duration: duration * 0.35,
      ease: 'power1.out',
    },
    0,
  ).to(
    el,
    {
      y: dy,
      duration: duration * 0.65,
      ease: 'power2.out',
    },
    duration * 0.35,
  );

  tl.to(
    el,
    {
      scale: 0.85,
      opacity: 1.0,
      duration: duration * 0.6,
      ease: 'none',
    },
    0,
  ).to(
    el,
    {
      scale: 0.02,
      opacity: 0,
      duration: duration * 0.4,
      ease: 'power2.in',
    },
    duration * 0.6,
  );
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
    gsap.to(p, {
      x: Math.cos(angle) * velocity,
      y: Math.sin(angle) * velocity - 20,
      scale: 0,
      opacity: 0,
      duration: (500 + Math.random() * 300) / 1000,
      ease: 'power2.out',
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
    duration: 300,
    ease: 'outQuad',
  });
}
