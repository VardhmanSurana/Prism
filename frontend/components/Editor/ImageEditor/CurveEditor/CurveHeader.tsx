/**
 * CurveHeader.tsx
 * Category selector (RGB vs Color vs Color), channel buttons (Master, R, G, B), and specialized curve pills.
 */

import React from 'react';
import { SpecializedCurveKind } from '../curves';
import { Channel, CurveCategory } from './types';

interface CurveHeaderProps {
  category: CurveCategory;
  setCategory: (c: CurveCategory) => void;
  activeChannel: Channel;
  setActiveChannel: (ch: Channel) => void;
  activeSpecializedKind: SpecializedCurveKind;
  setActiveSpecializedKind: (k: SpecializedCurveKind) => void;
}

const channels: Channel[] = ['master', 'red', 'green', 'blue'];

export const CurveHeader: React.FC<CurveHeaderProps> = ({
  category,
  setCategory,
  activeChannel,
  setActiveChannel,
  activeSpecializedKind,
  setActiveSpecializedKind,
}) => {
  return (
    <>
      {/* Category selector */}
      <div className="flex rounded-lg bg-black/40 p-1 border border-white/5">
        <button
          type="button"
          onClick={() => setCategory('rgb')}
          className={`editor-btn editor-chip-btn ${
            category === 'rgb' ? 'active' : ''
          } flex-1 py-1 text-xs`}
        >
          RGB
        </button>
        <button
          type="button"
          onClick={() => setCategory('specialized')}
          className={`editor-btn editor-chip-btn ${
            category === 'specialized' ? 'active' : ''
          } flex-1 py-1 text-xs`}
        >
          Color vs Color
        </button>
      </div>

      {category === 'rgb' ? (
        /* Channel Tabs - Sleek dark rectangles */
        <div className="flex rounded-lg p-0.5 gap-2 max-w-fit mb-1">
          {channels.map(ch => {
            const isActive = activeChannel === ch;
            let textStyle = '';
            let activeStyle = '';
            let labelElement: React.ReactNode = null;

            if (ch === 'master') {
              labelElement = (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
                  <path
                    d="M2,13 C5,13 8,3 14,3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              );
              textStyle = isActive ? 'text-black' : 'text-white/60 hover:text-white';
              activeStyle = isActive ? 'bg-white text-black shadow-sm' : 'bg-white/5 hover:bg-white/10';
            } else if (ch === 'red') {
              labelElement = <span className="font-bold text-[11px] font-sans">R</span>;
              textStyle = 'text-[#ef4444]';
              activeStyle = isActive ? 'bg-[#ef4444]/20 border border-[#ef4444]/40 shadow-sm' : 'bg-white/5 hover:bg-[#ef4444]/10 border border-[#ef4444]/10';
            } else if (ch === 'green') {
              labelElement = <span className="font-bold text-[11px] font-sans">G</span>;
              textStyle = 'text-[#22c55e]';
              activeStyle = isActive ? 'bg-[#22c55e]/20 border border-[#22c55e]/40 shadow-sm' : 'bg-white/5 hover:bg-[#22c55e]/10 border border-[#22c55e]/10';
            } else if (ch === 'blue') {
              labelElement = <span className="font-bold text-[11px] font-sans">B</span>;
              textStyle = 'text-[#3b82f6]';
              activeStyle = isActive ? 'bg-[#3b82f6]/20 border border-[#3b82f6]/40 shadow-sm' : 'bg-white/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/10';
            }

            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`w-9 h-7 flex items-center justify-center rounded border border-white/5 transition-colors 150ms ease, background-color 150ms ease, border-color 150ms ease cursor-pointer ${activeStyle} ${textStyle}`}
              >
                {labelElement}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {(['hueVsHue', 'hueVsSat', 'hueVsLum', 'lumVsSat', 'satVsSat'] as SpecializedCurveKind[]).map(k => {
            const labels: Record<SpecializedCurveKind, string> = {
              hueVsHue: 'Hue vs Hue',
              hueVsSat: 'Hue vs Sat',
              hueVsLum: 'Hue vs Lum',
              lumVsSat: 'Lum vs Sat',
              satVsSat: 'Sat vs Sat',
            };
            const isActive = activeSpecializedKind === k;
            return (
              <button
                key={k}
                onClick={() => setActiveSpecializedKind(k)}
                className={`editor-btn editor-chip-btn ${
                  isActive ? 'active' : ''
                } px-2 py-1 text-[10px]`}
              >
                {labels[k]}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

