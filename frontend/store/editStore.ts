import { create } from 'zustand';
import { Adjustments } from '@/components/Editor/ImageEditor/filterEngine';

interface EditStore {
  copiedAdjustments: Partial<Adjustments> | null;
  copyAdjustments: (adj: Partial<Adjustments>) => void;
  clearCopied: () => void;
}

export const useEditStore = create<EditStore>((set) => ({
  copiedAdjustments: null,
  copyAdjustments: (adj) => set({ copiedAdjustments: adj }),
  clearCopied: () => set({ copiedAdjustments: null }),
}));
