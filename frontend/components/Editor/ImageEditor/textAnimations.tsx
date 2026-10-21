/**
 * textAnimations.tsx
 * Spell UI inspired text animation components powered by Framer Motion.
 * Features:
 *  - BlurReveal: Words/characters emerge from soft blur with staggered spring
 *  - SlideUpText: Phrases slide up and dissolve seamlessly on update
 *  - SpecialText: Hacker/neural matrix character scramble decode effect
 *  - ShimmerText: Ambient iridescent gradient sweep across typography
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 1. BlurReveal ─────────────────────────────────────────────────────────────
export interface BlurRevealProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  by?: 'word' | 'character';
}

export const BlurReveal: React.FC<BlurRevealProps> = ({
  text,
  className = '',
  delay = 0,
  duration = 0.45,
  by = 'word',
}) => {
  const items = useMemo(() => (by === 'character' ? text.split('') : text.split(' ')), [text, by]);

  return (
    <motion.span
      className={`inline-flex flex-wrap items-center justify-center ${className}`}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: by === 'character' ? 0.025 : 0.07,
            delayChildren: delay,
          },
        },
      }}
    >
      {items.map((item, index) => (
        <motion.span
          key={`${item}-${index}`}
          className="inline-block whitespace-pre"
          variants={{
            hidden: {
              opacity: 0,
              filter: 'blur(10px)',
              y: 10,
            },
            visible: {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              transition: {
                duration,
                ease: [0.16, 1, 0.3, 1],
              },
            },
          }}
        >
          {item}
          {by === 'word' && index < items.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </motion.span>
  );
};

// ── 2. SlideUpText ────────────────────────────────────────────────────────────
export interface SlideUpTextProps {
  children: React.ReactNode;
  className?: string;
  textKey?: string | number;
  duration?: number;
}

export const SlideUpText: React.FC<SlideUpTextProps> = ({
  children,
  className = '',
  textKey,
  duration = 0.38,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={textKey}
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
        transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// ── 3. SpecialText (Scramble Decode) ──────────────────────────────────────────
export interface SpecialTextProps {
  text: string;
  className?: string;
  speed?: number;
  trigger?: boolean;
}

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#abcdef0123456789';

export const SpecialText: React.FC<SpecialTextProps> = ({
  text,
  className = '',
  speed = 28,
  trigger = true,
}) => {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    if (!trigger) return;

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) {
              return text[index];
            }
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }

      iteration += 1 / 2;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, trigger]);

  return <span className={className}>{displayText}</span>;
};

// ── 4. ShimmerText ────────────────────────────────────────────────────────────
export interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({ children, className = '' }) => {
  return (
    <span
      className={`inline-block bg-[linear-gradient(110deg,#ffffff,45%,#93c5fd,55%,#ffffff)] bg-[length:250%_100%] bg-clip-text text-transparent animate-shimmer ${className}`}
    >
      {children}
    </span>
  );
};
