import React from 'react';
import { ProgressBar } from './ProgressBar';

interface FloatingActionsProps {
  importStatus: {
    is_scanning: boolean;
    total_files: number;
    processed_files: number;
    progress: number;
  };
  syncStatus: {
    is_scanning: boolean;
    total_files: number;
    processed_files: number;
    progress: number;
  };
}

export function FloatingActions({
  importStatus,
  syncStatus
}: FloatingActionsProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end">
      <ProgressBar
        progress={importStatus.progress}
        total={importStatus.total_files}
        processed={importStatus.processed_files}
        isScanning={importStatus.is_scanning}
        label="Importing Photos..."
        color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
      />
      <ProgressBar
        progress={syncStatus.progress}
        total={syncStatus.total_files}
        processed={syncStatus.processed_files}
        isScanning={syncStatus.is_scanning}
      />
    </div>
  );
}
