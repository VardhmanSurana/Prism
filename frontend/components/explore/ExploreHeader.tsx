import React from 'react';

interface ExploreHeaderProps {
  icon?: React.ReactNode;
  /** The small mono label shown above the main title (e.g. "Retro", "Analytics") */
  label?: string;
  title: string;
  subtitle?: string;
  headingId?: string;
  showTimeGreeting?: boolean;
}

/**
 * getTimeGreeting - Retrieves get time greeting.
 */
export const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
};

/**
 * ExploreHeader - Renders explore header.
 */
export const ExploreHeader: React.FC<ExploreHeaderProps> = ({
  icon,
  label,
  title,
  subtitle,
  headingId,
  showTimeGreeting,
}) => {
  const displayTitle = showTimeGreeting ? `${getTimeGreeting()}, ${title}` : title;
  return (
    <div className="mb-8">
      {/* Mono overline label */}
      {(label || icon) && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-white/40">{icon}</span>}
          {label && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.35em] text-white/30">
              {label}
            </span>
          )}
        </div>
      )}
      {/* Serif italic title */}
      <h3
        id={headingId}
        className="font-serif italic text-4xl text-white tracking-tight leading-tight"
      >
        {displayTitle}
      </h3>
      {subtitle && (
        <p className="text-sm text-white/30 mt-1.5">{subtitle}</p>
      )}
    </div>
  );
};
