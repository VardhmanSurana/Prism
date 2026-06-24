import React from 'react';
import { MemoriesCarousel } from '@/components/ui/MemoriesCarousel';

export const ExploreView: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      <MemoriesCarousel />
    </div>
  );
};
