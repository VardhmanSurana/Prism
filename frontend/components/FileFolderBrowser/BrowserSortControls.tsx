import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, Calendar, Layers } from 'lucide-react';
import { GroupBy, SortDirection, SortField } from './types';

interface BrowserSortControlsProps {
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionToggle: () => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  /** Hide size sort when browsing folders only */
  directoryOnly?: boolean;
}

const FIELD_LABELS: Record<SortField, string> = {
  name: 'Name',
  size: 'Size',
  modified: 'Modified',
  resolution: 'Resolution',
};

const GROUP_LABELS: Record<GroupBy, string> = {
  none: 'None',
  type: 'Type',
  date: 'Date',
};

export const BrowserSortControls: React.FC<BrowserSortControlsProps> = ({
  sortField,
  sortDirection,
  groupBy,
  onSortFieldChange,
  onSortDirectionToggle,
  onGroupByChange,
  directoryOnly = false,
}) => {
  const fields: SortField[] = directoryOnly
    ? ['name', 'modified']
    : ['name', 'size', 'modified', 'resolution'];

  const DirectionIcon =
    sortField === 'name'
      ? sortDirection === 'asc'
        ? ArrowDownAZ
        : ArrowUpAZ
      : sortDirection === 'asc'
        ? ArrowUpAZ
        : ArrowDownWideNarrow;

  const directionTitle =
    sortField === 'name'
      ? sortDirection === 'asc'
        ? 'A → Z'
        : 'Z → A'
      : sortDirection === 'asc'
        ? 'Ascending'
        : 'Descending';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px]">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-white/35 font-mono uppercase shrink-0">Sort</span>
        <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {fields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => onSortFieldChange(field)}
              className={`px-2 py-1 rounded-md uppercase tracking-wider font-semibold transition-all cursor-pointer
                ${
                  sortField === field
                    ? 'bg-primary/15 text-primary'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
            >
              {FIELD_LABELS[field]}
            </button>
          ))}
          <button
            type="button"
            onClick={onSortDirectionToggle}
            title={directionTitle}
            className="px-1.5 py-1 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <DirectionIcon size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-white/35 font-mono uppercase shrink-0 inline-flex items-center gap-1">
          <Layers size={10} />
          Group
        </span>
        <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGroupByChange(g)}
              className={`px-2 py-1 rounded-md uppercase tracking-wider font-semibold transition-all cursor-pointer inline-flex items-center gap-1
                ${
                  groupBy === g
                    ? 'bg-primary/15 text-primary'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
            >
              {g === 'date' && <Calendar size={10} />}
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
