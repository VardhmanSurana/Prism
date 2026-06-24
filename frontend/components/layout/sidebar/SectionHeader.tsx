import React from 'react';

interface SectionHeaderProps {
  label: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ label }) => (
  <div className="px-6 pt-10 pb-3 text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.3em] relative z-20">
    {label}
  </div>
);
