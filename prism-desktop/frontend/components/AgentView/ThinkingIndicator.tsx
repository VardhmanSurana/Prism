"use client";

import { forwardRef, useState, useEffect, type HTMLAttributes } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const infinity =
  "M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z";

const DEFAULT_WORDS = ["Thinking", "Planning", "Searching", "Refining"];

interface ThinkingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  showIcon?: boolean;
  words?: string[];
}

const ThinkingIndicator = forwardRef<HTMLDivElement, ThinkingIndicatorProps>(
  ({ className = "", showIcon = true, words = DEFAULT_WORDS, ...props }, ref) => {
    const [index, setIndex] = useState(0);
    const reduceMotion = useReducedMotion() ?? false;

    useEffect(() => {
      if (reduceMotion) return;
      const interval = setInterval(() => {
        setIndex((i) => (i + 1) % words.length);
      }, 4000);
      return () => clearInterval(interval);
    }, [reduceMotion, words.length]);

    return (
      <div
        ref={ref}
        role="status"
        className={`flex items-center gap-2 px-1 py-1 ${className}`}
        {...props}
      >
        <span className="sr-only">Thinking…</span>

        {showIcon && (
          <motion.svg
            aria-hidden
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400 shrink-0"
            animate={reduceMotion ? {} : { rotate: 360, scale: [1, 1.12, 1] }}
            transition={{
              rotate: { duration: 6, ease: "linear", repeat: Infinity },
              scale: { duration: 2, ease: "easeInOut", repeat: Infinity },
            }}
          >
            <path d={infinity} />
          </motion.svg>
        )}

        <span
          aria-hidden="true"
          className="inline-grid text-[13px] overflow-hidden text-gray-300"
          style={{ fontWeight: 500 }}
        >
          {/* Invisible widest word reserves layout width */}
          <span className="col-start-1 row-start-1 invisible shimmer-text">
            {words.reduce((a, b) => (a.length >= b.length ? a : b))}
          </span>

          {reduceMotion ? (
            <span className="col-start-1 row-start-1 shimmer-text">{words[0]}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={words[index]}
                className="col-start-1 row-start-1 shimmer-text"
                initial={{ y: "80%", opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] } }}
                exit={{ y: "-80%", opacity: 0, transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] } }}
              >
                {words[index]}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      </div>
    );
  }
);

ThinkingIndicator.displayName = "ThinkingIndicator";
export { ThinkingIndicator };
export type { ThinkingIndicatorProps };
export default ThinkingIndicator;
