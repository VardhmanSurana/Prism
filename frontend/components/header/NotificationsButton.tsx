import React from 'react';
import { Bell } from 'lucide-react';

export const NotificationsButton: React.FC = () => {
  return (
    <button className="p-2 text-gray-500 hover:text-white transition-colors relative">
      <Bell size={18} />
      <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
    </button>
  );
};
