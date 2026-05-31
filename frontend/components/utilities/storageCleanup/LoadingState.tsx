import React from 'react';

export const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );
};
