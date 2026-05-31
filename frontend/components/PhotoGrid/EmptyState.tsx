import React from 'react';
import { AlertCircle } from 'lucide-react';
import { EmptyStateProps } from './types';

export const EmptyState: React.FC<EmptyStateProps> = ({ message = 'No photos found' }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20">
      <AlertCircle size={48} className="mb-4 opacity-20" />
      <p className="text-lg">{message}</p>
    </div>
  );
};
