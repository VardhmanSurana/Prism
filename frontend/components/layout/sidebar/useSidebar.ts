import { useStats } from '@/hooks/useStats';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

export function useSidebar() {
  const { stats } = useStats();
  const totalBytes = stats?.total_size_bytes ?? 0;

  return { stats, totalBytes, formatBytes };
}
