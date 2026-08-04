import React from 'react';
import { ShieldAlert } from 'lucide-react';

export function SecurityFooter(): React.ReactElement {
  return (
    <div className="flex justify-center mt-8">
      <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-full">
        <ShieldAlert size={12} className="text-primary animate-pulse" /> 
        <span>Advanced AES-256 local disk encryption active</span>
      </div>
    </div>
  );
}
