/**
 * HslTabs.tsx
 * Sticky 4-tab navigation header shared by the HSL panel.
 */
import React from 'react';
import { Palette, Sliders, Disc, Sparkles } from 'lucide-react';

export interface HslTabsProps {
  subTab: 'mixer' | 'basic' | 'grading' | 'toning';
  setSubTab: (t: 'mixer' | 'basic' | 'grading' | 'toning') => void;
  isHslModified: boolean;
  isBasicModified: boolean;
  isToningModified: boolean;
}

export const HslTabs: React.FC<HslTabsProps> = (p) => {
  const dot = (cond: boolean) =>
    cond ? <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCBC00] animate-pulse" /> : null;

  const tabClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-[10px] font-semibold tracking-tight transition-all select-none cursor-pointer ${
      active
        ? 'bg-white/10 text-white font-bold border border-white/10 shadow-sm'
        : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
    }`;

  return (
    <div className="sticky top-0 z-20 bg-[#0d0f14]/95 backdrop-blur-md px-3 pt-3 pb-2 border-b border-white/5">
      <div className="grid grid-cols-4 gap-1.5 bg-[#12141a] p-1.5 rounded-xl border border-white/5">
        <button onClick={() => p.setSubTab('mixer')} className={tabClass(p.subTab === 'mixer')}>
          <Palette size={16} className="shrink-0" />
          <span className="leading-none">Mixer</span>
          {!p.subTab.match(/mixer/) && dot(p.isHslModified)}
        </button>
        <button onClick={() => p.setSubTab('basic')} className={tabClass(p.subTab === 'basic')}>
          <Sliders size={16} className="shrink-0" />
          <span className="leading-none">Basic</span>
          {p.subTab !== 'basic' && dot(p.isBasicModified)}
        </button>
        <button onClick={() => p.setSubTab('grading')} className={tabClass(p.subTab === 'grading')}>
          <Disc size={16} className="shrink-0" />
          <span className="leading-none">Wheels</span>
        </button>
        <button onClick={() => p.setSubTab('toning')} className={tabClass(p.subTab === 'toning')}>
          <Sparkles size={16} className="shrink-0" />
          <span className="leading-none">Split</span>
          {p.subTab !== 'toning' && dot(p.isToningModified)}
        </button>
      </div>
    </div>
  );
};
