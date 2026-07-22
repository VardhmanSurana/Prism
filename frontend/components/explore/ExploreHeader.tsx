import React from 'react';

interface ExploreHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  headingId?: string;
  showTimeGreeting?: boolean;
}

export const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
};

export const ExploreHeader: React.FC<ExploreHeaderProps> = ({ icon, title, subtitle, headingId, showTimeGreeting }) => {
  const displayTitle = showTimeGreeting ? `${getTimeGreeting()}, ${title}` : title;
  return (
    <div className="mb-8 space-y-1">
      <div className="flex items-center gap-2">
        {icon && <span className="p-1.5 rounded-lg bg-white/10 text-primary">{icon}</span>}
        <h3 id={headingId} className="text-4xl font-serif font-bold text-white tracking-tight">
          {displayTitle}
        </h3>
      </div>
      {subtitle && (
        <p className="text-sm text-gray-400">{subtitle}</p>
      )}
    </div>
  );
};
