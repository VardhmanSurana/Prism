"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Spring presets
const springModerate = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 };
const springSlow = { type: "spring" as const, stiffness: 180, damping: 28, mass: 1 };
const springFast = { type: "spring" as const, stiffness: 600, damping: 35, mass: 0.6 };
const springFastExit = { duration: 0.06, ease: "linear" as const };

// ─── CollapsePanel ─────────────────────────────────────────────────────────────
// Pure framer-motion height collapse (no Radix, but same semantics)
function CollapsePanel({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const needsSnap = useRef(open);

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    innerRef.current = el;
    if (!el) return;
    if (el.offsetHeight > 0) setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => {
      if (el.offsetHeight > 0) setContentHeight(el.offsetHeight);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  useIsoLayoutEffect(() => {
    if (open && innerRef.current && innerRef.current.offsetHeight > 0) {
      setContentHeight(innerRef.current.offsetHeight);
    }
  }, [open]);

  useEffect(() => {
    if (contentHeight !== null) needsSnap.current = false;
  }, [contentHeight]);

  const [exitComplete, setExitComplete] = useState(!open);
  if (open && exitComplete) setExitComplete(false);

  if (!open && exitComplete) return null;

  return (
    <motion.div
      className="overflow-hidden"
      initial={{ height: open ? "auto" : 0 }}
      animate={{ height: open ? (contentHeight ?? "auto") : 0 }}
      transition={needsSnap.current ? { duration: 0 } : { ...springModerate, bounce: 0 }}
      onAnimationComplete={() => { if (!open) setExitComplete(true); }}
    >
      <div ref={measureRef}>{children}</div>
    </motion.div>
  );
}

// ─── TriggerRow ────────────────────────────────────────────────────────────────
function TriggerRow({
  open,
  children,
  onClick,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = open || hovered;

  return (
    <div
      className="relative w-fit"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-white/5 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: springFastExit }}
            transition={{ duration: 0.08 }}
          />
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={onClick}
        className={`relative z-10 flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-white/30 ${className}`}
      >
        <span className="inline-grid text-[12px] text-left">
          <span className="col-start-1 row-start-1 invisible font-semibold" aria-hidden>
            {children}
          </span>
          <span
            className="col-start-1 row-start-1 transition-colors duration-75"
            style={{
              color: highlighted ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
              fontWeight: open ? 600 : 400,
            }}
          >
            {children}
          </span>
        </span>
        <motion.span
          className="shrink-0 inline-flex items-center justify-center"
          animate={{ rotate: open ? 90 : 0 }}
          transition={springFast}
        >
          {/* Chevron right SVG */}
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            stroke="currentColor"
            strokeWidth={highlighted ? 2 : 1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors duration-75"
            style={{ color: highlighted ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </motion.span>
      </button>
    </div>
  );
}

// ─── ThinkingSteps ─────────────────────────────────────────────────────────────
interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

function ThinkingSteps({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className = "",
  ...props
}: ThinkingStepsProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={`w-full max-w-full ${className}`} {...props}>
      {/* Inject the open state via context substitute — pass as render prop via children */}
      {typeof children === "function"
        ? (children as (open: boolean, toggle: () => void) => ReactNode)(isOpen, toggle)
        : children}
    </div>
  );
}
ThinkingSteps.displayName = "ThinkingSteps";

// ─── ThinkingStepsHeader ───────────────────────────────────────────────────────
function ThinkingStepsHeader({
  children = "Thinking",
  open,
  onToggle,
  className = "",
}: {
  children?: ReactNode;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <TriggerRow open={open} onClick={onToggle} className={className}>
      {children}
    </TriggerRow>
  );
}
ThinkingStepsHeader.displayName = "ThinkingStepsHeader";

// ─── ThinkingStepsContent ──────────────────────────────────────────────────────
function ThinkingStepsContent({
  children,
  open,
  className = "",
}: {
  children: ReactNode;
  open: boolean;
  className?: string;
}) {
  return (
    <CollapsePanel open={open}>
      <div className={`flex flex-col px-2 pb-2 pt-0.5 ${className}`}>{children}</div>
    </CollapsePanel>
  );
}
ThinkingStepsContent.displayName = "ThinkingStepsContent";

// ─── ThinkingStep ──────────────────────────────────────────────────────────────
type StepStatus = "complete" | "active" | "pending";

interface ThinkingStepProps {
  icon?: ReactNode;
  label: string;
  description?: string;
  status?: StepStatus;
  delay?: number;
  isLast?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStep({
  icon,
  label,
  description,
  status = "complete",
  delay = 0.08,
  isLast = false,
  children,
  className = "",
}: ThinkingStepProps) {
  if (status === "pending") return null;
  const isActive = status === "active";

  return (
    <motion.div
      className={`relative z-10 overflow-hidden ${className}`}
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      transition={springSlow}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay, ease: "easeOut" }}
      >
        <div className="flex gap-2.5 px-1 py-1.5 rounded-lg">
          {/* Icon column with connector line */}
          <div className="flex flex-col items-center shrink-0 w-[14px]">
            <div className="pt-0.5">
              {icon ? (
                <span className="text-gray-400">{icon}</span>
              ) : (
                <div className="w-[14px] h-[14px] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                </div>
              )}
            </div>
            {!isLast && (
              <div className="flex-1 w-px bg-white/8 mt-1" />
            )}
          </div>

          {/* Text */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0 pb-1">
            <span
              className={`text-[12px] leading-tight ${isActive ? "shimmer-text" : "text-white/80"}`}
              style={{ fontWeight: 500 }}
            >
              {label}{isActive && "…"}
            </span>
            {description && (
              <span className="text-[11px] text-white/35 leading-snug font-mono">
                {description}
              </span>
            )}
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
ThinkingStep.displayName = "ThinkingStep";

// ─── ThinkingStepBadge ─────────────────────────────────────────────────────────
function ThinkingStepBadge({
  children,
  color = "gray",
  delay = 0,
}: {
  children: ReactNode;
  color?: "gray" | "blue" | "green" | "amber" | "rose" | "purple" | "cyan";
  delay?: number;
}) {
  const colorMap: Record<string, string> = {
    gray: "bg-white/5 border-white/10 text-white/50",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-300",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-300",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ ...springModerate, delay, filter: { duration: 0.12, delay } }}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${colorMap[color] ?? colorMap.gray}`}
    >
      {children}
    </motion.span>
  );
}
ThinkingStepBadge.displayName = "ThinkingStepBadge";

export {
  ThinkingSteps,
  ThinkingStepsHeader,
  ThinkingStepsContent,
  ThinkingStep,
  ThinkingStepBadge,
};

export type { ThinkingStepsProps, ThinkingStepProps, StepStatus };
