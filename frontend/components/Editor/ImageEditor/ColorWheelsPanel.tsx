import React, { useState, useRef, useCallback } from 'react';
import { ColorWheelsAdjustments, ColorWheelVal, DEFAULT_COLOR_WHEEL_VAL } from './filterEngine';
import { RotateCcw } from 'lucide-react';

interface ColorWheelsPanelProps {
  value: ColorWheelsAdjustments;
  onChange: (value: ColorWheelsAdjustments) => void;
}

interface SingleWheelProps {
  label: string;
  val: ColorWheelVal;
  color: string;
  onChange: (val: ColorWheelVal) => void;
}

const SingleWheel: React.FC<SingleWheelProps> = ({ label, val, color, onChange }) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const updateVector = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }

    const normX = Math.round((dx / radius) * 100);
    const normY = Math.round((-dy / radius) * 100); // invert Y so up is positive

    onChange({ ...val, x: normX, y: normY });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_COLOR_WHEEL_VAL });
  };

  const posX = (val.x / 100) * 40; // 40px radius preview
  const posY = (-val.y / 100) * 40;

  return (
    <div className="flex flex-col items-center bg-[#14151a] p-3 rounded-lg border border-white/5">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">{label}</span>
        <button
          onClick={handleReset}
          className="text-white/40 hover:text-white transition-colors cursor-pointer p-0.5"
          title="Reset wheel"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      {/* Wheel Canvas trackball */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleReset}
        className="w-24 h-24 rounded-full relative cursor-crosshair border border-white/15 shadow-inner select-none touch-none mb-3"
        style={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.6) 100%), conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
        }}
      >
        {/* Crosshair grid */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <div className="w-full h-[1px] bg-white" />
          <div className="h-full w-[1px] bg-white absolute" />
        </div>

        {/* Center Target Handle */}
        <div
          className="w-3.5 h-3.5 rounded-full border-2 border-white bg-black shadow-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{
            transform: `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px))`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Master Luminance Slider */}
      <div className="w-full flex flex-col gap-1">
        <div className="flex justify-between text-[9px] text-white/40 uppercase font-mono">
          <span>Y (Luma)</span>
          <span>{val.yuma > 0 ? `+${val.yuma}` : val.yuma}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={val.yuma}
          onChange={(e) => onChange({ ...val, yuma: parseInt(e.target.value, 10) })}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>
    </div>
  );
};

export const ColorWheelsPanel: React.FC<ColorWheelsPanelProps> = ({ value, onChange }) => {
  const mode = value.mode || 'primary';

  const setMode = (m: 'primary' | 'log') => {
    onChange({ ...value, mode: m });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Switch Tabs */}
      <div className="flex rounded-lg bg-black/40 p-1 border border-white/5">
        <button
          onClick={() => setMode('primary')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            mode === 'primary' ? 'bg-white/15 text-white font-semibold shadow-sm' : 'text-white/50 hover:text-white'
          }`}
        >
          Primary (3-Way)
        </button>
        <button
          onClick={() => setMode('log')}
          className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
            mode === 'log' ? 'bg-white/15 text-white font-semibold shadow-sm' : 'text-white/50 hover:text-white'
          }`}
        >
          Log Wheels
        </button>
      </div>

      {mode === 'primary' ? (
        <div className="grid grid-cols-2 gap-3">
          <SingleWheel
            label="Lift (Shadows)"
            val={value.lift}
            color="#3b82f6"
            onChange={(lift) => onChange({ ...value, lift })}
          />
          <SingleWheel
            label="Gamma (Midtones)"
            val={value.gamma}
            color="#22c55e"
            onChange={(gamma) => onChange({ ...value, gamma })}
          />
          <SingleWheel
            label="Gain (Highlights)"
            val={value.gain}
            color="#ef4444"
            onChange={(gain) => onChange({ ...value, gain })}
          />
          <SingleWheel
            label="Offset (Global)"
            val={value.offset}
            color="#ffffff"
            onChange={(offset) => onChange({ ...value, offset })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <SingleWheel
              label="Shadows"
              val={value.shadows}
              color="#3b82f6"
              onChange={(shadows) => onChange({ ...value, shadows })}
            />
            <SingleWheel
              label="Midtones"
              val={value.midtones}
              color="#22c55e"
              onChange={(midtones) => onChange({ ...value, midtones })}
            />
            <SingleWheel
              label="Highlights"
              val={value.highlights}
              color="#ef4444"
              onChange={(highlights) => onChange({ ...value, highlights })}
            />
          </div>

          {/* Log Pivot Sliders */}
          <div className="bg-[#14151a] p-3 rounded-lg border border-white/5 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Low Pivot (Shadow Limit)</span>
                <span className="font-mono text-white/80">{value.lowPivot}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={value.lowPivot}
                onChange={(e) => onChange({ ...value, lowPivot: parseInt(e.target.value, 10) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>High Pivot (Highlight Limit)</span>
                <span className="font-mono text-white/80">{value.highPivot}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={value.highPivot}
                onChange={(e) => onChange({ ...value, highPivot: parseInt(e.target.value, 10) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
