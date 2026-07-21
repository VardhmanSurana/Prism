import React from 'react';
import { CleanupTab } from './types';

interface TabSwitcherProps {
  activeTab: CleanupTab;
  onTabChange: (tab: CleanupTab) => void;
}

const TABS: { id: CleanupTab; label: string }[] = [
  { id: 'blurry', label: 'Blurry' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'documents', label: 'Documents' }
];

export const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex gap-1 bg-white/[0.01] border border-white/[0.05] rounded-xl p-1 w-fit shadow-lg">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] ${
              isActive
                ? 'bg-primary text-black font-semibold shadow-md'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

