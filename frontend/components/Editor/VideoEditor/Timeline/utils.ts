export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30); // Assuming 30fps for formatting if not provided
  return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}
