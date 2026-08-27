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

/**
 * Tab switcher for storage cleanup sub-tabs (blurry/duplicates/documents).
 */
export const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="cr-sub-tabs flex" role="tablist" aria-label="Storage cleanup views">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`subtab-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`cr-sub-tab ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};


