import React from 'react';
import { MemoriesCarousel } from './MemoriesCarousel';

export const ExploreView: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      <MemoriesCarousel />
    </div>
  );
};
