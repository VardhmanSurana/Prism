import React from 'react';
import { X } from 'lucide-react';
import { BrowserSortControls } from './BrowserSortControls';
import { GroupBy, SortDirection, SortField } from './types';

interface BrowserHeaderProps {
  title: string;
  onClose: () => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  groupBy?: GroupBy;
  onSortFieldChange?: (field: SortField) => void;
  onSortDirectionToggle?: () => void;
  onGroupByChange?: (groupBy: GroupBy) => void;
  directoryOnly?: boolean;
  showSortControls?: boolean;
  /** Render only the toolbar controls, for use below the location bar. */
  compact?: boolean;
}

export const BrowserHeader: React.FC<BrowserHeaderProps> = ({
  title,
  onClose,
  sortField = 'name',
  sortDirection = 'asc',
  groupBy = 'none',
  onSortFieldChange,
  onSortDirectionToggle,
  onGroupByChange,
  directoryOnly = false,
  showSortControls = false,
  compact = false,
}) => (
  <div className={compact ? '' : 'border-b border-white/10 shrink-0'}>
    {!compact && (
      <div className="flex items-center justify-between px-6 py-4">
        <h3 className="text-base font-semibold text-white/95">{title}</h3>
        <button
          onClick={onClose}
          aria-label="Close file browser"
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
    )}
    {showSortControls && onSortFieldChange && onSortDirectionToggle && onGroupByChange && (
      <div className={compact ? '' : 'px-6 pb-3'}>
        <BrowserSortControls
          sortField={sortField}
          sortDirection={sortDirection}
          groupBy={groupBy}
          onSortFieldChange={onSortFieldChange}
          onSortDirectionToggle={onSortDirectionToggle}
          onGroupByChange={onGroupByChange}
          directoryOnly={directoryOnly}
        />
      </div>
    )}
  </div>
);
