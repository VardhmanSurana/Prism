import React from 'react';

export const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="relative">
        <div className="w-8 h-8 border-2 border-[#23252a] border-t-[#5e6ad2] rounded-full animate-spin" />
      </div>
    </div>
  );
};
