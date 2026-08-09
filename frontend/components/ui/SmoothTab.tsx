import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export interface SmoothTabProps<T extends string = string> {
  items: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
}

export function SmoothTab<T extends string = string>({
  items,
  activeTab,
  onChange,
  className = '',
}: SmoothTabProps<T>) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement | null>>(new Map());

  // Animate indicator to the active tab position using GSAP
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const activeButton = tabRefs.current.get(activeTab);
    if (!indicator || !activeButton) return;

    const containerRect = activeButton.parentElement?.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    if (containerRect) {
      gsap.to(indicator, {
        x: buttonRect.left - containerRect.left,
        width: buttonRect.width,
        duration: 0.3,
        ease: 'power3.out',
      });
    }
  }, [activeTab]);

  // Set initial indicator position without animation
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const activeButton = tabRefs.current.get(activeTab);
    if (!indicator || !activeButton) return;

    const containerRect = activeButton.parentElement?.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    if (containerRect) {
      gsap.set(indicator, {
        x: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, []);

  return (
    <div
      className={`flex items-center gap-6 border-b border-white/[0.08] pb-1 w-full relative select-none ${className}`}
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current.set(tab.id, el); }}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-1 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 outline-none active:scale-[0.97] ${
              isActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {Icon && (
              <Icon
                size={15}
                className={`transition-colors duration-200 ${
                  isActive ? 'text-[#828fff]' : 'text-gray-400'
                }`}
              />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
      {/* Single indicator element animated by GSAP — no layoutId, no React re-renders */}
      <div
        ref={indicatorRef}
        className="absolute bottom-[-1px] left-0 h-[2px] bg-[#5e6ad2] shadow-[0_0_10px_rgba(94,106,210,0.8)]"
        style={{ willChange: 'transform, width' }}
      />
    </div>
  );
}
