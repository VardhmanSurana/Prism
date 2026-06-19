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
    <div className="flex gap-1 bg-[#050505] border border-[#23252a] rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-[#141516] text-[#d0d6e0] border border-[#23252a]'
              : 'text-[#62666d] hover:text-[#8a8f98] border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
