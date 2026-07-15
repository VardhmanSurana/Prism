import React from 'react';

interface ExploreHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  headingId?: string;
}

export const ExploreHeader: React.FC<ExploreHeaderProps> = ({ icon, title, subtitle, headingId }) => {
  return (
    <div className="mb-8 space-y-1">
      <h3 id={headingId} className="text-4xl font-serif font-bold text-white tracking-tight">{title}</h3>
      {subtitle && (
        <p className="text-sm text-gray-400">{subtitle}</p>
      )}
    </div>
  );
};
