import React from 'react';
import { Pipette, Copy, Lock, Unlock } from 'lucide-react';
import { hexToRgb } from './colorQuantization';

interface PaletteSwatchItemProps {
  color: string;
  index: number;
  isLocked: boolean;
  isPickingThis: boolean;
  onPickColor: (index: number) => void;
  onCopy: (color: string) => void;
  onToggleLock: (index: number) => void;
}

export const PaletteSwatchItem: React.FC<PaletteSwatchItemProps> = ({
  color,
  index,
  isLocked,
  isPickingThis,
  onPickColor,
  onCopy,
  onToggleLock,
}) => {
  const rgb = hexToRgb(color);

  return (
    <div
      className={`group/swatch flex items-center justify-between p-2 rounded-2xl border transition-all duration-150 ${
        isPickingThis
          ? 'border-white bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
          : isLocked
          ? 'border-white/20 bg-white/[0.04]'
          : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Swatch color bubble */}
        <div
          className="w-9 h-9 rounded-xl border border-white/10 shrink-0 shadow-inner"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0">
          <span className="text-xs font-mono font-bold text-white/90 uppercase select-all block">
            {color}
          </span>
          <span className="block text-[9px] font-mono text-white/30 truncate">
            {rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `Swatch ${index + 1}`}
            {isLocked && ' • Locked'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Eyedropper Pick for this slot */}
        <button
          onClick={() => onPickColor(index)}
          className={`editor-btn editor-chip-btn ${
            isPickingThis ? 'active' : ''
          } p-1.5`}
          title={`Pick color from image into Swatch ${index + 1}`}
        >
          <Pipette size={12} />
        </button>

        {/* Copy Button */}
        <button
          onClick={() => onCopy(color)}
          className="editor-btn editor-chip-btn p-1.5"
          title="Copy hex code"
        >
          <Copy size={12} />
        </button>

        {/* Lock/Unlock Button */}
        <button
          onClick={() => onToggleLock(index)}
          className={`editor-btn editor-chip-btn ${
            isLocked ? 'active' : ''
          } p-1.5`}
          title={isLocked ? 'Unlock swatch' : 'Lock swatch'}
        >
          {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      </div>
    </div>
  );
};

