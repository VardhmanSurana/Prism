import React from 'react';

export function LoadingSpinner(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-10 h-10 border-4 border-t-primary border-white/5 rounded-full animate-spin"></div>
    </div>
  );
}
