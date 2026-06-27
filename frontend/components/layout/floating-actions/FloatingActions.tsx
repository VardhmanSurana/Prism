import { ProgressBar } from '@/components/ui/ProgressBar';
import { useSyncStore } from '@/store/syncStore';
import type { FloatingActionsProps } from '../types/floating-actions';

export function FloatingActions({ importStatus }: FloatingActionsProps) {
  const syncStatus = useSyncStore((s) => s.syncStatus);

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
