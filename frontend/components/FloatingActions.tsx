import React from 'react';
import { AgentLogo } from './AgentLogo';
import { ProgressBar } from './ProgressBar';

interface FloatingActionsProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
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
  isChatOpen,
  onToggleChat,
  importStatus,
  syncStatus
}: FloatingActionsProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end">
      <button
        onClick={onToggleChat}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl ${
          isChatOpen
            ? 'bg-white/10 text-white rotate-[180deg] border border-white/10 scale-90'
            : 'bg-primary text-black hover:scale-110 active:scale-95 shadow-primary/20'
        }`}
      >
        <AgentLogo className={isChatOpen ? 'scale-75 opacity-50' : 'scale-90'} />
      </button>
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
