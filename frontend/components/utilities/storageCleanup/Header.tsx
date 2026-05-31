import React from 'react';
import { Trash2 } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
        <Trash2 className="text-yellow-500" size={20} />
        <span>Smart Storage Cleanup</span>
      </h3>
      <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
        Analyze and free up physical drive space on-device
      </p>
    </div>
  );
};
