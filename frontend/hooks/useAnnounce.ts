import { create } from 'zustand';

export type AnnouncePoliteness = 'polite' | 'assertive';

interface AnnounceStore {
  politeMessage: string;
  assertiveMessage: string;
  announce: (message: string, politeness?: AnnouncePoliteness) => void;
  clear: () => void;
}

export const useAnnounceStore = create<AnnounceStore>((set) => ({
  politeMessage: '',
  assertiveMessage: '',
  announce: (message: string, politeness: AnnouncePoliteness = 'polite') => {
    if (politeness === 'assertive') {
      set({ assertiveMessage: message });
    } else {
      set({ politeMessage: message });
    }
  },
  clear: () => set({ politeMessage: '', assertiveMessage: '' }),
}));

/**
 * useAnnounce - Hook to announce screen reader live messages.
 */
export function useAnnounce() {
  const announce = useAnnounceStore((s) => s.announce);
  const clear = useAnnounceStore((s) => s.clear);
  return { announce, clear };
}
