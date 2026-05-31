import React from 'react';
import { CleanupTab } from './types';

interface TabSwitcherProps {
  activeTab: CleanupTab;
  onTabChange: (tab: CleanupTab) => void;
}

const TABS: { id: CleanupTab; label: string }[] = [
  { id: 'blurry', label: 'blurry' },
  { id: 'duplicates', label: 'duplicates' },
  { id: 'documents', label: 'documents' }
];

export const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex items-center gap-2 bg-[#0a0a0a] p-1 rounded-2xl border border-white/5 max-w-md">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300
            ${activeTab === tab.id 
              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10' 
              : 'text-gray-400 hover:text-white'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
