/**
 * ColorScopesPanel.tsx — Professional real-time Color Grading Scopes overlay panel.
 * Displays Luma Waveform, RGB Parade, and Cb/Cr Vectorscope with Rec.709 graticules.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { renderColorScope, type ScopeMode } from './scopesEngine';

export interface ColorScopesPanelProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
  dockPosition?: 'overlay' | 'right';
}

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
      className={`z-30 flex flex-col bg-[#141414]/95 backdrop-blur-md border border-[#2b2b2b] rounded-lg shadow-2xl overflow-hidden transition-all ${
        dockPosition === 'overlay'
          ? 'absolute top-3 right-3 w-[380px] h-[260px]'
          : 'w-80 bg-[#161616] border-l border-[#2a2a2a] shrink-0'
      }`}
    >
      {/* Header / Mode Switcher */}
      <div className="h-9 px-3 bg-[#1e1e1e] border-b border-[#2b2b2b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-white text-xs font-medium tracking-wide">Scopes</span>
        </div>

        {/* Scope Mode Tabs */}
        <div className="flex items-center bg-[#111] p-0.5 rounded border border-[#2a2a2a]">
          <button
            onClick={() => setMode('waveform')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              mode === 'waveform' ? 'bg-[#3b82f6] text-white' : 'text-[#888] hover:text-white'
            }`}
            title="Luma Waveform (IRE)"
          >
            Waveform
          </button>
          <button
            onClick={() => setMode('rgbParade')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              mode === 'rgbParade' ? 'bg-[#3b82f6] text-white' : 'text-[#888] hover:text-white'
            }`}
            title="RGB Parade"
          >
            Parade
          </button>
          <button
            onClick={() => setMode('vectorscope')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              mode === 'vectorscope' ? 'bg-[#3b82f6] text-white' : 'text-[#888] hover:text-white'
            }`}
            title="Cb/Cr Vectorscope"
          >
            Vectorscope
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              mode === 'all' ? 'bg-[#3b82f6] text-white' : 'text-[#888] hover:text-white'
            }`}
            title="All Scopes Grid"
          >
            All
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="text-[#777] hover:text-white text-sm p-0.5 transition-colors"
          title="Close scopes"
        >
          &times;
        </button>
      </div>

      {/* Scope Canvas Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center p-1 min-h-0">
        <canvas
          ref={scopeCanvasRef}
          width={360}
          height={190}
          className="w-full h-full block rounded bg-[#0a0a0a]"
        />
      </div>

      {/* Footer Controls */}
      <div className="h-7 px-3 bg-[#181818] border-t border-[#252525] flex items-center justify-between text-[10px] text-[#888] shrink-0">
        <div className="flex items-center gap-2">
          <span>Gain:</span>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={gain}
            onChange={(e) => setGain(parseFloat(e.target.value))}
            className="w-16 accent-[#3b82f6] cursor-pointer"
          />
          <span className="font-mono text-white/80 w-6">{gain.toFixed(1)}x</span>
        </div>

        <button
          onClick={() => setShowGraticule(!showGraticule)}
          className={`hover:text-white transition-colors ${showGraticule ? 'text-[#3b82f6]' : 'text-[#555]'}`}
        >
          Grid: {showGraticule ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
