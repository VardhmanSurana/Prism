import React from 'react';

interface SectionHeaderProps {
  label: string;
  className?: string;
}

/**
 * SectionHeader - Renders category section header matching Prism Dark Basalt design.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ label, className = '' }) => (
  <div
    className={`px-3.5 pt-5 pb-1.5 text-[11px] font-medium text-[#7c746f] uppercase tracking-[0.14em] select-none ${className}`}
  >
    {label}
  </div>
);

