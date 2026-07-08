"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// ─── Spring presets ───────────────────────────────────────────────────────────
const springFast = {
  type: "spring" as const,
  stiffness: 600,
  damping: 35,
  mass: 0.6,
};
const springFastExit = { duration: 0.06, ease: "linear" as const };

// ─── Auto-sizing hook ─────────────────────────────────────────────────────────
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Touch devices have no hover, so show controls persistently on them.
function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputMessageSlotContext {
  openFilePicker: (acceptOverride?: string) => void;
  files: File[];
}

type InputMessageSlot =
  | ReactNode
  | ((ctx: InputMessageSlotContext) => ReactNode);

interface InputMessageProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  onSend?: (value: string, files: File[]) => void;
  placeholder?: string;
  leftSlot?: InputMessageSlot;
  rightSlot?: InputMessageSlot;
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
  clickToFocus?: boolean;
  sendLabel?: string;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  textareaProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "onKeyDown" | "disabled" | "placeholder"
  >;
  status?: "idle" | "streaming";
  onStop?: () => void;
  history?: string[];
}

// ─── InputMessage ─────────────────────────────────────────────────────────────

const InputMessage = forwardRef<HTMLDivElement, InputMessageProps>(
  (
    {
      value,
      onValueChange,
      onSend,
      placeholder = "Ask me anything…",
      leftSlot,
      rightSlot,
      disabled,
      minRows = 1,
      maxRows = 8,
      clickToFocus = true,
      sendLabel = "Send",
      files,
      onFilesChange,
      accept = "image/png,image/jpeg,application/pdf",
      maxFiles,
      textareaProps,
      status,
      onStop,
      history = [],
      className,
      style,
      ...props
    },
    ref
  ) => {
    const reduceMotion = useReducedMotion() ?? false;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [focusVisible, setFocusVisible] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [hovered, setHovered] = useState(false);

    const {
      onFocus: _textareaOnFocus,
      onBlur: _textareaOnBlur,
      ...restTextareaProps
    } = textareaProps ?? {};

    const filesArr = useMemo(() => files ?? [], [files]);
    const supportsFiles = onFilesChange !== undefined;
    const streaming = status === "streaming";

    // History navigation state
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);
    const draftBeforeHistory = useRef("");

    // Line-height cache for auto-resize
    const lineHeightCache = useRef<{ el: HTMLTextAreaElement; value: number } | null>(null);

    useIsoLayoutEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      let cache = lineHeightCache.current;
      if (!cache || cache.el !== el) {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        cache = { el, value: Number.isNaN(lineHeight) ? 20 : lineHeight };
        lineHeightCache.current = cache;
      }
      const min = cache.value * minRows;
      const max = cache.value * maxRows;
      const next = Math.min(Math.max(el.scrollHeight, min), max);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    }, [value, minRows, maxRows]);

    const trimmed = value.trim();
    const canSend = !disabled && (trimmed.length > 0 || filesArr.length > 0);

    // ── Box-shadow focus ring (matches Prism's dark aesthetic) ────────────────
    const EDGE_DROP = "0 2px 8px rgba(0,0,0,0.4)";
    const edgeShadow = dragOver
      ? `0 0 0 1.5px rgba(107, 151, 255, 0.7), ${EDGE_DROP}`
      : focusVisible
        ? `0 0 0 1px rgba(255,255,255,0.15), ${EDGE_DROP}`
        : hovered && clickToFocus && !disabled
          ? `0 0 0 1px rgba(255,255,255,0.08), ${EDGE_DROP}`
          : `0 1px 3px rgba(0,0,0,0.3), ${EDGE_DROP}`;

    // ── Send handler ──────────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
      if (!canSend) return;
      setHistoryIndex(null);
      onSend?.(trimmed, filesArr);
    }, [canSend, onSend, trimmed, filesArr]);

    const handleStop = useCallback(() => onStop?.(), [onStop]);

    const buttonMode: "send" | "stop" = streaming && onStop ? "stop" : "send";
    const buttonLabel = buttonMode === "stop" ? "Stop" : sendLabel;

    const setCaretEnd = useCallback(() => {
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      });
    }, []);

    // ── Keyboard handler ──────────────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;

        if (
          history.length > 0 &&
          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
          !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey
        ) {
          const el = e.currentTarget;
          const caret = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? caret;
          if (e.key === "ArrowUp" && !value.slice(0, caret).includes("\n")) {
            const start = historyIndex == null ? history.length : historyIndex;
            if (start > 0) {
              e.preventDefault();
              if (historyIndex == null) draftBeforeHistory.current = value;
              const ni = start - 1;
              setHistoryIndex(ni);
              onValueChange(history[ni]);
              setCaretEnd();
            }
            return;
          }
          if (e.key === "ArrowDown" && historyIndex != null && !value.slice(end).includes("\n")) {
            e.preventDefault();
            const ni = historyIndex + 1;
            if (ni >= history.length) {
              setHistoryIndex(null);
              onValueChange(draftBeforeHistory.current);
            } else {
              setHistoryIndex(ni);
              onValueChange(history[ni]);
            }
            setCaretEnd();
            return;
          }
        }

        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [history, value, historyIndex, onValueChange, setCaretEnd, handleSend]
    );

    const handleContainerMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!clickToFocus || disabled) return;
        const target = e.target as HTMLElement;
        if (target === textareaRef.current) return;
        if (target.closest('button, a, input, select, textarea, [contenteditable], [role="button"]')) return;
        e.preventDefault();
        textareaRef.current?.focus();
      },
      [clickToFocus, disabled]
    );

    // ── File helpers ──────────────────────────────────────────────────────────
    const acceptTokens = useMemo(
      () => accept.split(",").map((s) => s.trim()).filter(Boolean),
      [accept]
    );

    const matchesAccept = useCallback(
      (file: File) =>
        acceptTokens.some((token) => {
          if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
          if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token.toLowerCase());
          return file.type === token;
        }),
      [acceptTokens]
    );

    const addFiles = useCallback(
      (incoming: File[]) => {
        if (!onFilesChange) return;
        const fingerprint = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
        const existing = new Set(filesArr.map(fingerprint));
        const accepted: File[] = [];
        for (const f of incoming) {
          if (!matchesAccept(f)) continue;
          const fp = fingerprint(f);
          if (existing.has(fp)) continue;
          existing.add(fp);
          accepted.push(f);
        }
        if (!accepted.length) return;
        const next = [...filesArr, ...accepted];
        onFilesChange(maxFiles != null ? next.slice(0, maxFiles) : next);
      },
      [onFilesChange, filesArr, matchesAccept, maxFiles]
    );

    const removeFile = useCallback(
      (idx: number) => {
        if (!onFilesChange) return;
        onFilesChange(filesArr.filter((_, i) => i !== idx));
      },
      [onFilesChange, filesArr]
    );

    const openFilePicker = useCallback(
      (overrideAccept?: string) => {
        const el = fileInputRef.current;
        if (!el) return;
        if (overrideAccept) {
          el.accept = overrideAccept;
          el.click();
          queueMicrotask(() => {
            if (fileInputRef.current) fileInputRef.current.accept = accept;
          });
          return;
        }
        el.click();
      },
      [accept]
    );

    // ── Slot rendering ────────────────────────────────────────────────────────
    const slotCtx = useMemo<InputMessageSlotContext>(
      () => ({ openFilePicker, files: filesArr }),
      [openFilePicker, filesArr]
    );
    const leftContent = typeof leftSlot === "function" ? leftSlot(slotCtx) : leftSlot;
    const rightContent = typeof rightSlot === "function" ? rightSlot(slotCtx) : rightSlot;

    // ── Drag-and-drop ─────────────────────────────────────────────────────────
    const handleDragOver = useCallback(
      (e: ReactDragEvent<HTMLDivElement>) => {
        if (!supportsFiles || disabled) return;
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      },
      [supportsFiles, disabled]
    );

    const handleDragLeave = useCallback(
      (e: ReactDragEvent<HTMLDivElement>) => {
        const wrapper = e.currentTarget;
        const next = e.relatedTarget as Node | null;
        if (next && wrapper.contains(next)) return;
        setDragOver(false);
      },
      []
    );

    const handleDrop = useCallback(
      (e: ReactDragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (!supportsFiles || disabled) return;
        addFiles(Array.from(e.dataTransfer.files));
      },
      [supportsFiles, disabled, addFiles]
    );

    const handleFileInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        addFiles(Array.from(e.target.files));
        e.target.value = "";
      },
      [addFiles]
    );

    return (
      <div
        ref={ref}
        onMouseDown={handleContainerMouseDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex flex-col gap-1 p-2 transition-all duration-150 rounded-xl ${
          clickToFocus && !disabled ? "cursor-text" : ""
        } ${disabled ? "opacity-50 pointer-events-none" : ""} ${className ?? ""}`}
        style={{
          background: "rgba(12, 12, 16, 0.85)",
          backdropFilter: "blur(12px)",
          border: dragOver
            ? "1px solid rgba(107, 151, 255, 0.5)"
            : focusVisible
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(255,255,255,0.06)",
          boxShadow: edgeShadow,
          ...style,
        }}
        {...props}
      >
        {supportsFiles && (
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={maxFiles == null || maxFiles > 1}
            className="hidden"
            onChange={handleFileInputChange}
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {/* Attached files preview row */}
        <AnimatePresence initial={false}>
          {filesArr.length > 0 && (
            <motion.div
              key="preview-row"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8, bounce: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pb-1 px-2 pt-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {filesArr.map((file, i) => (
                    <motion.div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: springFastExit }}
                      transition={springFast}
                      className="relative shrink-0 cursor-default group/tile"
                    >
                      <div
                        className="w-16 h-16 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden text-xs text-gray-400 font-medium"
                        title={file.name}
                      >
                        {file.type.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-center px-1 leading-tight">{file.name.split(".").pop()?.toUpperCase()}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        aria-label={`Remove ${file.name}`}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-neutral-900 text-white opacity-0 group-hover/tile:opacity-100 transition-opacity duration-100 flex items-center justify-center cursor-pointer outline-none text-[10px] font-bold"
                      >
                        ×
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setHistoryIndex(null);
            onValueChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            if (e.target.matches(":focus-visible")) setFocusVisible(true);
            textareaProps?.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocusVisible(false);
            textareaProps?.onBlur?.(e);
          }}
          placeholder={
            dragOver && supportsFiles
              ? "Drop files here to add to chat"
              : placeholder
          }
          disabled={disabled}
          rows={minRows}
          aria-label={textareaProps?.["aria-label"] ?? "Message"}
          className="w-full resize-none bg-transparent outline-none text-[14px] leading-5 text-white placeholder:text-gray-500 px-2 py-2"
          style={{ fontWeight: 500 }}
          {...restTextareaProps}
        />

        {/* Bottom bar: left slot | right slot + send button */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {leftContent}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {rightContent}
            <button
              type="button"
              onClick={buttonMode === "stop" ? handleStop : handleSend}
              disabled={buttonMode === "stop" ? disabled : !canSend}
              aria-label={buttonLabel}
              className="relative group inline-flex items-center justify-center w-8 h-8 rounded-lg outline-none cursor-pointer transition-all duration-100 disabled:opacity-30 disabled:pointer-events-none"
              style={{
                background: canSend || buttonMode === "stop"
                  ? "rgba(255,255,255,1)"
                  : "rgba(255,255,255,0.08)",
                color: canSend || buttonMode === "stop" ? "#000" : "rgba(255,255,255,0.4)",
              }}
            >
              <span className="absolute inset-0 rounded-[inherit] transition-all duration-100 group-hover:opacity-90 group-active:scale-95 group-active:opacity-80" />
              <span className="relative flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={buttonMode === "stop" ? "stop" : "arrow"}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.6, transition: springFastExit }
                    }
                    transition={springFast}
                    className="flex items-center justify-center leading-none"
                  >
                    {buttonMode === "stop" ? (
                      <span className="w-3 h-3 rounded-[3px] bg-current" />
                    ) : (
                      /* Arrow-up SVG (send icon) */
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 19V5m0 0-7 7m7-7 7 7" />
                      </svg>
                    )}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </div>
        </div>

        {/* Screen-reader announcements */}
        <span className="sr-only" role="status" aria-live="polite" />
      </div>
    );
  }
);

InputMessage.displayName = "InputMessage";

export { InputMessage };
export type { InputMessageProps, InputMessageSlotContext };
export default InputMessage;
