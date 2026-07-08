/**
 * ColorPicker — Fluid Functionalism-inspired color picker component.
 * Features: gradient canvas, hue slider, hex input, opacity slider, preset swatches.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ColorPickerProps {
  value: string;      // hex color e.g. "#ff0000"
  onChange: (hex: string) => void;
  className?: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, s, v];
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

function hsvToHueHex(h: number): string {
  return hsvToHex(h, 1, 1);
}

// ── Preset swatches ───────────────────────────────────────────────────────────
const PRESETS = [
  '#ffffff', '#e4e4e7', '#a1a1aa', '#71717a', '#3f3f46', '#18181b',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#10b981', '#f59e0b',
];

// ── Component ─────────────────────────────────────────────────────────────────

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial HSV from incoming hex value
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    try { return hexToHsv(value || '#ffffff'); }
    catch { return [0, 0, 1]; }
  });
  const [hexInput, setHexInput] = useState(value || '#ffffff');

  // Keep local state in sync with external value changes
  useEffect(() => {
    try {
      if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
        setHsv(hexToHsv(value));
        setHexInput(value);
      }
    } catch { /* ignore */ }
  }, [value]);

  const gradientRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);

  const [dragGrad, setDragGrad] = useState(false);
  const [dragHue, setDragHue] = useState(false);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Draw gradient canvas ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gradientRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    // Hue base color
    const hueColor = hsvToHueHex(hsv[0]);
    ctx.clearRect(0, 0, w, h);
    // White → hue horizontal
    const gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, '#ffffff');
    gradH.addColorStop(1, hueColor);
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, w, h);
    // Transparent → black vertical
    const gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, '#000000');
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, w, h);
  }, [hsv[0]]);

  // ── Draw hue slider ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    const stops = [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1];
    stops.forEach(s => grad.addColorStop(s, hsvToHueHex(s)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Commit color change ────────────────────────────────────────────────────
  const commitHsv = useCallback((newHsv: [number, number, number]) => {
    setHsv(newHsv);
    const hex = hsvToHex(...newHsv);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // ── Gradient interaction ───────────────────────────────────────────────────
  const handleGradientPointer = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = gradientRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    commitHsv([hsv[0], s, v]);
  }, [hsv, commitHsv]);

  const handleGradientMouseDown = useCallback((e: React.MouseEvent) => {
    setDragGrad(true);
    handleGradientPointer(e);
  }, [handleGradientPointer]);

  // ── Hue interaction ────────────────────────────────────────────────────────
  const handleHuePointer = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    commitHsv([h, hsv[1], hsv[2]]);
  }, [hsv, commitHsv]);

  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    setDragHue(true);
    handleHuePointer(e);
  }, [handleHuePointer]);

  // ── Global mouse move / up ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dragGrad && !dragHue) return;
    const onMove = (e: MouseEvent) => {
      if (dragGrad) handleGradientPointer(e);
      if (dragHue) handleHuePointer(e);
    };
    const onUp = () => { setDragGrad(false); setDragHue(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragGrad, dragHue, handleGradientPointer, handleHuePointer]);

  // ── Hex input ──────────────────────────────────────────────────────────────
  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
      const newHsv = hexToHsv(withHash);
      setHsv(newHsv);
      onChange(withHash);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentHex = hsvToHex(...hsv);
  const gradThumbX = hsv[1] * 100;     // 0–100%
  const gradThumbY = (1 - hsv[2]) * 100;
  const hueThumbX = hsv[0] * 100;

  return (
    <div ref={containerRef} className={`relative inline-block ${className || ''}`}>
      {/* Trigger swatch */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 cursor-pointer transition-colors outline-none focus:border-[#3b82f6]/50 w-full"
        title="Pick color"
      >
        <span
          className="w-4 h-4 rounded-sm border border-white/10 shrink-0"
          style={{ backgroundColor: currentHex }}
        />
        <span className="text-[#aaa] text-xs font-mono">{currentHex}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-3 h-3 text-[#555] shrink-0 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Floating picker panel */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 z-50 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl p-3 w-56"
          style={{ animation: 'cpFadeIn 0.12s ease-out' }}
        >
          <style>{`
            @keyframes cpFadeIn {
              from { opacity: 0; transform: translateY(-4px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Gradient area */}
          <div
            className="relative w-full rounded-lg overflow-hidden cursor-crosshair mb-2"
            style={{ height: 120 }}
            onMouseDown={handleGradientMouseDown}
          >
            <canvas
              ref={gradientRef}
              width={208}
              height={120}
              className="absolute inset-0 w-full h-full"
            />
            {/* Thumb */}
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${gradThumbX}%`,
                top: `${gradThumbY}%`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            className="relative w-full rounded-full cursor-pointer mb-3"
            style={{ height: 10 }}
            onMouseDown={handleHueMouseDown}
          >
            <canvas
              ref={hueRef}
              width={208}
              height={10}
              className="absolute inset-0 w-full h-full rounded-full"
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${hueThumbX}%`,
                backgroundColor: hsvToHueHex(hsv[0]),
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              }}
            />
          </div>

          {/* Hex input + current swatch */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-7 h-7 rounded-md border border-white/10 shrink-0"
              style={{ backgroundColor: currentHex }}
            />
            <div className="flex-1 flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1 gap-1">
              <span className="text-[#555] text-[10px] font-mono">#</span>
              <input
                type="text"
                value={hexInput.replace(/^#/, '')}
                onChange={handleHexInput}
                maxLength={6}
                spellCheck={false}
                className="bg-transparent text-[#ccc] text-[11px] font-mono outline-none flex-1 min-w-0"
              />
            </div>
          </div>

          {/* Preset swatches */}
          <div>
            <span className="text-[#555] text-[10px] block mb-1.5">Swatches</span>
            <div className="grid grid-cols-8 gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const newHsv = hexToHsv(preset);
                    setHsv(newHsv);
                    setHexInput(preset);
                    onChange(preset);
                  }}
                  className="w-5 h-5 rounded-sm border border-transparent hover:border-white/30 cursor-pointer transition-all"
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
