import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-1 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 outline-none ${
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
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#5e6ad2] shadow-[0_0_10px_rgba(94,106,210,0.8)]"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
