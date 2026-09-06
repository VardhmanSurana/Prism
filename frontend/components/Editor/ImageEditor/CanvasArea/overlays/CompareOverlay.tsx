/**
 * CompareOverlay.tsx
 * Renders the "Before" / "After" labels and the draggable divider.
 */
import React from 'react';
import { ImageRect, overlayStyle } from '../imageRect';

export interface CompareOverlayProps {
  rect: ImageRect;
  comparePercent: number;
  beforeLabelRef: React.MutableRefObject<HTMLDivElement | null>;
  afterLabelRef: React.MutableRefObject<HTMLDivElement | null>;
  compareDividerRef: React.MutableRefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export const CompareOverlay: React.FC<CompareOverlayProps> = (p) => (
  <>
    <div
      ref={p.beforeLabelRef}
      className="absolute z-20 pointer-events-none px-2.5 py-1 rounded bg-[#0D0F14]/75 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/50"
      style={{ left: p.rect.left + 16, top: p.rect.top + 16 }}
    >
      Before
    </div>
    <div
      ref={p.afterLabelRef}
      className="absolute z-20 pointer-events-none px-2.5 py-1 rounded bg-primary/25 border border-primary/35 text-[9px] font-bold uppercase tracking-wider text-primary shadow-[0_2px_12px_rgba(var(--color-primary),0.15)]"
      style={{ left: p.rect.left + p.rect.width - 64, top: p.rect.top + 16 }}
    >
      After
    </div>
    <div
      ref={p.compareDividerRef}
      className="absolute z-30 select-none cursor-ew-resize flex flex-col items-center justify-center touch-none"
      style={overlayStyle(
        { left: p.rect.left + (p.comparePercent / 100) * p.rect.width, top: p.rect.top, width: 40, height: p.rect.height },
        { transform: 'translateX(-50%)' },
      )}
      onPointerDown={p.onPointerDown}
      onPointerMove={p.onPointerMove}
      onPointerUp={p.onPointerUp}
    >
      <div className="w-[2px] h-full bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" />
      <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0D0F14] border-2 border-primary flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
        <span className="text-[10px] font-bold text-primary select-none">↔</span>
      </div>
    </div>
  </>
);
