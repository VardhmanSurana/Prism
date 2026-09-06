/**
 * CuratedTemplateCard.tsx
 * Card rendering curated film look presets with live filter preview and accent bar.
 */

import React from 'react';
import { Check } from 'lucide-react';
import { Template, applyTemplate } from '../templates';
import { Adjustments, toFilterString } from '../filterEngine';
import { getSampleUrlForTemplate } from './sampleUrls';

interface CuratedTemplateCardProps {
  template: Template;
  isActive: boolean;
  adjustments: Adjustments;
  onApply: (template: Template) => void;
}

export const CuratedTemplateCard: React.FC<CuratedTemplateCardProps> = ({
  template,
  isActive,
  adjustments,
  onApply,
}) => {
  const sampleUrl = getSampleUrlForTemplate(template.category, template.id);

  return (
    <button
      onClick={() => onApply(template)}
      className={`group relative flex flex-col items-start p-0 rounded-xl border overflow-hidden transition-all duration-150 text-left bg-[var(--bg-tertiary)] cursor-pointer ${
        isActive
          ? 'template-card-selected border-white shadow-md'
          : 'border-white/5 hover:border-white/20 hover:scale-[1.01]'
      }`}
    >
      {/* Sample image preview area with template filter applied */}
      <div className="w-full h-[84px] shrink-0 relative overflow-hidden bg-black/30">
        <img
          src={sampleUrl}
          alt={template.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          style={{ filter: toFilterString(applyTemplate(adjustments, template.adjustments)) }}
          crossOrigin="anonymous"
        />
        {/* Accent gradient bar */}
        <div
          className="absolute bottom-0 inset-x-0 h-0.5"
          style={{ background: template.accent }}
        />
      </div>

      {/* Active check overlay */}
      {isActive && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg z-10">
          <Check size={10} strokeWidth={3} className="text-black" />
        </div>
      )}

      {/* Label */}
      <div className={`w-full px-2.5 py-1.5 ${isActive ? 'bg-white' : 'bg-[var(--bg-tertiary)]'}`}>
        <p
          className={`text-[10px] font-bold truncate transition-colors ${
            isActive ? 'text-black font-extrabold' : 'text-white/60 group-hover:text-white/90'
          }`}
        >
          {template.name}
        </p>
        <p className="text-[8px] text-white/25 mt-0.5 truncate leading-tight">
          {template.description}
        </p>
      </div>
    </button>
  );
};

