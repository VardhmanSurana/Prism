/**
 * UserTemplateCard.tsx
 * Card rendering user-created custom templates.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
import { UserTemplate } from '../templates';
import { toFilterString } from '../filterEngine';
import { getSampleUrlForTemplate } from './sampleUrls';

interface UserTemplateCardProps {
  template: UserTemplate;
  isActive: boolean;
  onApply: (template: UserTemplate) => void;
  onDelete: (id: string) => void;
}

export const UserTemplateCard: React.FC<UserTemplateCardProps> = ({
  template,
  isActive,
  onApply,
  onDelete,
}) => {
  const sampleUrl = getSampleUrlForTemplate('Film', template.id);

  return (
    <div
      className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
        isActive
          ? 'border-white bg-white text-black shadow-lg'
          : 'bg-[var(--bg-tertiary)] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
      }`}
      onClick={() => onApply(template)}
    >
      <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden border border-white/10 bg-black/30">
        <img
          src={sampleUrl}
          alt={template.name}
          className="w-full h-full object-cover"
          style={{ filter: toFilterString(template.adjustments) }}
          crossOrigin="anonymous"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${isActive ? 'text-black' : 'text-white/70'}`}>
          {template.name}
        </p>
        <p className={`text-[9px] ${isActive ? 'text-black/60 font-medium' : 'text-white/25'} mt-0.5`}>
          {new Date(template.createdAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={e => {
          e.stopPropagation();
          onDelete(template.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all cursor-pointer"
        title="Delete Template"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

