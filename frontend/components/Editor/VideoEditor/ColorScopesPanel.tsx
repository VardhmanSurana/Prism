/**
 * ColorScopesPanel.tsx — Professional real-time Color Grading Scopes overlay panel.
 * Displays Luma Waveform, RGB Parade, and Cb/Cr Vectorscope with Rec.709 graticules.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { renderColorScope, type ScopeMode } from './scopesEngine';
import { Activity, X } from 'lucide-react';

export interface ColorScopesPanelProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
  dockPosition?: 'overlay' | 'right';
}

/**
 * ColorScopesPanel - Renders color scopes panel.
 */
export const ColorScopesPanel: React.FC<ColorScopesPanelProps> = ({
  sourceCanvasRef,
  isOpen,
  onClose,
  isPlaying = false,
  dockPosition = 'overlay',
}) => {
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ScopeMode>('waveform');
  const [gain, setGain] = useState<number>(1.2);
  const [showGraticule, setShowGraticule] = useState(true);

  /**
   * updateScope - Performs update scope.
   */
  const updateScope = useCallback(() => {
    if (!sourceCanvasRef.current || !scopeCanvasRef.current || !isOpen) return;
    renderColorScope(sourceCanvasRef.current, scopeCanvasRef.current, {
      mode,
      gain,
      showGraticule,
    });
  }, [sourceCanvasRef, mode, gain, showGraticule, isOpen]);

  // Re-render scopes on mode/gain change or animation frame loop
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    /**
     * loop - Performs loop.
     */
    const loop = () => {
      updateScope();
      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };

    updateScope();

    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen, isPlaying, updateScope]);

  if (!isOpen) return null;

  return (
    <div
      className={`z-30 flex flex-col bg-[#1d1b1a]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden transition-all ${
        dockPosition === 'overlay'
          ? 'absolute top-3 right-3 w-[380px] h-[260px]'
          : 'w-80 bg-[#171615] border-l border-white/10 shrink-0'
      }`}
    >
      {/* Header / Mode Switcher */}
      <div className="h-9 px-3 bg-[#171615] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#e5a93c]" />
          <span className="text-[#f5f0ed] text-xs font-medium tracking-wide">Scopes</span>
        </div>

        {/* Scope Mode Tabs */}
        <div className="flex items-center bg-[#151312] p-0.5 rounded-lg border border-white/10">
          <button
            onClick={() => setMode('waveform')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'waveform' ? 'bg-[#e5a93c] text-[#151312] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Luma Waveform (IRE)"
          >
            Waveform
          </button>
          <button
            onClick={() => setMode('rgbParade')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'rgbParade' ? 'bg-[#e5a93c] text-[#151312] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="RGB Parade"
          >
            Parade
          </button>
          <button
            onClick={() => setMode('vectorscope')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'vectorscope' ? 'bg-[#e5a93c] text-[#151312] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="Cb/Cr Vectorscope"
          >
            Vectorscope
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
              mode === 'all' ? 'bg-[#e5a93c] text-[#151312] font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
            title="All Scopes Grid"
          >
            All
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          title="Close scopes"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scope Canvas Area */}
      <div className="flex-1 relative bg-[#151312] flex items-center justify-center p-1 min-h-0">
        <canvas
          ref={scopeCanvasRef}
          width={360}
          height={190}
          className="w-full h-full block rounded bg-[#100f0e]"
        />
      </div>

      {/* Footer Controls */}
      <div className="h-7 px-3 bg-[#171615] border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Gain:</span>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={gain}
            onChange={(e) => setGain(parseFloat(e.target.value))}
            className="w-16 accent-[#e5a93c] cursor-pointer"
          />
          <span className="font-mono text-zinc-300 w-6">{gain.toFixed(1)}x</span>
        </div>

        <button
          onClick={() => setShowGraticule(!showGraticule)}
          className={`hover:text-white transition-colors cursor-pointer ${showGraticule ? 'text-[#e5a93c] font-medium' : 'text-zinc-500'}`}
        >
          Grid: {showGraticule ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
