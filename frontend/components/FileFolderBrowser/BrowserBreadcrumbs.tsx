import React from 'react';
import { Home } from 'lucide-react';
import { BreadcrumbItem } from './types';

interface BrowserBreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onHome: () => void;
}

export const BrowserBreadcrumbs: React.FC<BrowserBreadcrumbsProps> = ({ currentPath, onNavigate, onHome }) => {
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
    <div className="px-4 py-2 bg-[#080808] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs text-white/60 shrink-0 select-none">
      <button
        onClick={onHome}
        className="hover:text-white flex items-center gap-1 shrink-0 transition-colors"
        title="Allowed Roots"
      >
        <Home size={13} />
        <span>/</span>
      </button>

      {getBreadcrumbs().map((b) => (
        <React.Fragment key={b.path}>
          <span className="text-white/20">/</span>
          <button
            onClick={() => onNavigate(b.path)}
            className="hover:text-white truncate max-w-[120px] transition-colors"
          >
            {b.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};