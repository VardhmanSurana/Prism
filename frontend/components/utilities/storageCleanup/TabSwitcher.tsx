import React from 'react';
import { CleanupTab } from './types';

interface TabSwitcherProps {
  activeTab: CleanupTab;
  onTabChange: (tab: CleanupTab) => void;
}

const TABS: { id: CleanupTab; label: string }[] = [
  { id: 'blurry', label: 'Blurry Photos' },
  { id: 'duplicates', label: 'Duplicate Sets' },
  { id: 'documents', label: 'Documents & Receipts' }
];

export const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="cr-sub-tabs">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`cr-sub-tab ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
};


