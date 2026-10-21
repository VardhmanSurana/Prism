import React from 'react';
import { CleanupTab } from './types';
import { Layers, Copy, FileText } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: CleanupTab;
  onTabChange: (tab: CleanupTab) => void;
}

const TABS: { id: CleanupTab; label: string; icon: React.ElementType }[] = [
  { id: 'duplicates', label: 'Duplicate Sets', icon: Copy },
  { id: 'blurry', label: 'Blurry Photos', icon: Layers },
  { id: 'documents', label: 'Documents & Receipts', icon: FileText }
];

/**
 * Tab switcher for storage cleanup sub-tabs in Prism Dark Basalt styling.
 */
export const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-[#100e0d] border border-[#2c2928] rounded-2xl w-fit" role="tablist" aria-label="Storage cleanup views">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`subtab-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-[#2c2928] text-[#f5f0ed] font-semibold border border-white/10 shadow-sm'
                : 'text-[#a8a29e] hover:text-[#f5f0ed] hover:bg-[#1d1b1a]'
            }`}
          >
            <Icon size={14} className={isActive ? 'text-[#e5a93c]' : 'text-[#78716c]'} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
