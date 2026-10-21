/**
 * indicators.tsx
 * Visual indicators for brush cursor, clone source crosshairs, and helper badges.
 */

import React from 'react';
import { HealingToolMode } from './types';

interface HealingCursorRingProps {
  cursorPos: { x: number; y: number } | null;
  brushSize: number;
  isAltHeld: boolean;
}

export const HealingCursorRing: React.FC<HealingCursorRingProps> = ({
  cursorPos,
  brushSize,
  isAltHeld,
}) => {
  if (!cursorPos || isAltHeld) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cursorPos.x,
        top: cursorPos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        width: brushSize,
        height: brushSize,
        border: '1.5px solid rgba(255, 255, 255, 0.9)',
        borderRadius: '50%',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), inset 0 0 4px rgba(0, 0, 0, 0.3)',
      }}
    />
  );
};

interface HealingSourceIndicatorProps {
  liveSourcePos: { x: number; y: number } | null;
  brushSize: number;
  mode: HealingToolMode;
}

export const HealingSourceIndicator: React.FC<HealingSourceIndicatorProps> = ({
  liveSourcePos,
  brushSize,
  mode,
}) => {
  if (!liveSourcePos || (mode !== 'clone-stamp' && mode !== 'healing-brush')) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: liveSourcePos.x,
        top: liveSourcePos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        width: brushSize,
        height: brushSize,
        border: '1.5px dashed #f59e0b',
        borderRadius: '50%',
        boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
      }}
    >
      {/* Centered Crosshair */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-400 opacity-80" />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-amber-400 opacity-80" />
    </div>
  );
};

interface HealingHelperBannerProps {
  sourceAnchor: { x: number; y: number } | null;
  isAltHeld: boolean;
  mode: HealingToolMode;
}

export const HealingHelperBanner: React.FC<HealingHelperBannerProps> = ({
  sourceAnchor,
  isAltHeld,
  mode,
}) => {
  if (mode !== 'clone-stamp' && mode !== 'healing-brush') return null;

  if (!sourceAnchor) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/80 border border-white/10 text-[10px] text-white/70 font-medium whitespace-nowrap pointer-events-none shadow-xl backdrop-blur-sm">
        💡 Click anywhere to set sample point (Alt+Click to reset)
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-amber-500/30 text-[10px] text-amber-400 font-semibold whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm">
      {isAltHeld ? '⊕ Target New Source' : '● Source Locked'} — {mode === 'clone-stamp' ? 'Clone Stamp' : 'Healing Brush'} (Alt+Click to reset)
    </div>
  );
};

