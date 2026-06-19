import React from 'react';

export const Header: React.FC = () => {
  return (
    <div className="mb-6">
      <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
        Smart Storage Cleanup
      </h3>
      <p className="text-xs text-[#8a8f98] mt-1.5">
        Analyze and free up physical drive space on-device
      </p>
    </div>
  );
};
