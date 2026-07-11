import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbItem } from './types';

interface BrowserBreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onHome: () => void;
}

export const BrowserBreadcrumbs: React.FC<BrowserBreadcrumbsProps> = ({
  currentPath,
  onNavigate,
  onHome,
}) => {
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    let accum = '';
    for (let i = 0; i < parts.length; i++) {
      accum += '/' + parts[i];
      breadcrumbs.push({ name: parts[i], path: accum });
    }
    return breadcrumbs;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar text-sm text-white/62 shrink-0 select-none">
      <button
        onClick={onHome}
        className="flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/5 hover:text-white"
        title="Allowed roots"
      >
        <Home size={14} />
      </button>

      {getBreadcrumbs().map((b) => (
        <React.Fragment key={b.path}>
          <ChevronRight size={13} className="shrink-0 text-white/22" />
          <button
            onClick={() => onNavigate(b.path)}
            className="max-w-[160px] shrink-0 truncate rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/5 hover:text-white"
          >
            {b.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
