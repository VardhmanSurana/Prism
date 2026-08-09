/**
 * Slider — shadcn-style compound component slider (Root/Track/Range/Thumb).
 * White/gray monochromatic theme for the VideoEditor.
 * Matches the Radix UI Slider API pattern used by shadcn/ui.
 */
import React, { useRef, useCallback, useState, createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SliderContextValue {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onValueChange: (value: number) => void;
  /** Fires once when the user begins an interaction (pointer-down or focused keypress). */
  onGestureStart?: () => void;
  percentage: number;
}

const SliderContext = createContext<SliderContextValue>({
  value: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  onValueChange: () => {},
  percentage: 0,
});

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

interface SliderRootProps {
  value: number;
  onValueChange: (value: number) => void;
  /** Called once per pointer-down / keyboard sequence — use for pushHistory. */
  onGestureStart?: () => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SliderRoot = React.forwardRef<HTMLDivElement, SliderRootProps>(
  ({ value, onValueChange, onGestureStart, min = 0, max = 100, step = 1, disabled = false, className = '', children }, ref) => {
    const percentage = max === min ? 0 : ((value - min) / (max - min)) * 100;

    return (
      <SliderContext.Provider value={{ value, min, max, step, disabled, onValueChange, onGestureStart, percentage }}>
        <div
          ref={ref}
          className={`relative flex items-center w-full touch-none select-none ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
          data-disabled={disabled || undefined}
        >
          {children}
        </div>
      </SliderContext.Provider>
    );
  }
);
SliderRoot.displayName = 'SliderRoot';

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

interface SliderTrackProps {
  className?: string;
  children?: React.ReactNode;
}

const SliderTrack = React.forwardRef<HTMLDivElement, SliderTrackProps>(
  ({ className = '', children }, ref) => {
    const { disabled } = useContext(SliderContext);

    return (
      <div
        ref={ref}
        className={`relative h-[3px] w-full rounded-full bg-white/[0.08] overflow-hidden ${disabled ? '' : 'cursor-pointer'} ${className}`}
      >
        {children}
      </div>
    );
  }
);
SliderTrack.displayName = 'SliderTrack';

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

interface SliderRangeProps {
  className?: string;
}

const SliderRange = React.forwardRef<HTMLDivElement, SliderRangeProps>(
  ({ className = '' }, ref) => {
    const { percentage } = useContext(SliderContext);

    return (
      <div
        ref={ref}
        className={`absolute top-0 left-0 h-full bg-white/50 rounded-full ${className}`}
        style={{ width: `${percentage}%` }}
      />
    );
  }
);
SliderRange.displayName = 'SliderRange';

// ---------------------------------------------------------------------------
// Thumb
// ---------------------------------------------------------------------------

interface SliderThumbProps {
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const SliderThumb = React.forwardRef<HTMLDivElement, SliderThumbProps>(
  ({ className = '', 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy }, ref) => {
    const { value, min, max, step, disabled, onValueChange, onGestureStart, percentage } = useContext(SliderContext);
    const thumbRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const getValueFromPosition = useCallback(
      (clientX: number) => {
        const track = thumbRef.current?.parentElement?.parentElement;
        if (!track) return value;

        const rect = track.getBoundingClientRect();
        const x = clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const rawValue = min + ratio * (max - min);
        const stepped = Math.round(rawValue / step) * step;
        return Math.max(min, Math.min(max, stepped));
      },
      [min, max, step, value]
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onGestureStart?.();
        setIsDragging(true);
        const newValue = getValueFromPosition(e.clientX);
        onValueChange(newValue);
      },
      [disabled, getValueFromPosition, onValueChange, onGestureStart]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!isDragging) return;
        const newValue = getValueFromPosition(e.clientX);
        onValueChange(newValue);
      },
      [isDragging, getValueFromPosition, onValueChange]
    );

    // Reset gesture flag between pointer sessions; pointer-down sets its own
    // snapshot at the top of the handler, so the ref only gates keyboard.
    const handlePointerUp = useCallback(() => {
      setIsDragging(false);
      hasGestureRef.current = false;
    }, []);

    // Keyboard: fire gesture start once per value-changing key sequence
    // (repeats on hold still share the single pre-gesture snapshot).
    const hasGestureRef = useRef(false);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;
        let newValue = value;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            e.preventDefault();
            newValue = Math.min(max, value + step);
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            e.preventDefault();
            newValue = Math.max(min, value - step);
            break;
          case 'PageUp':
            e.preventDefault();
            newValue = Math.min(max, value + step * 10);
            break;
          case 'PageDown':
            e.preventDefault();
            newValue = Math.max(min, value - step * 10);
            break;
          case 'Home':
            e.preventDefault();
            newValue = min;
            break;
          case 'End':
            e.preventDefault();
            newValue = max;
            break;
          default:
            return;
        }

        if (!hasGestureRef.current) {
          hasGestureRef.current = true;
          onGestureStart?.();
        }
        onValueChange(newValue);
      },
      [disabled, value, min, max, step, onValueChange, onGestureStart]
    );

    const handleBlur = useCallback(() => {
      // Reset so a subsequent keyboard session starts a new history step
      hasGestureRef.current = false;
    }, []);

    return (
      <div
        ref={(node) => {
          (thumbRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[10px] h-[10px] rounded-full border border-white/20 transition-transform 150ms cubic-bezier(0.23, 1, 0.32, 1), transition-colors 150ms ease, box-shadow 150ms ease focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-[#0e0e10] ${
          isDragging
            ? 'bg-white scale-125 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
            : isHovered
            ? 'bg-white/90 scale-110'
            : 'bg-white/70'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} ${className}`}
        style={{ left: `${percentage}%` }}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }
);
SliderThumb.displayName = 'SliderThumb';

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Slider = Object.assign(SliderRoot, {
  Track: SliderTrack,
  Range: SliderRange,
  Thumb: SliderThumb,
});

export default Slider;
