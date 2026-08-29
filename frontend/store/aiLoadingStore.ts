/**
 * aiLoadingStore.ts
 * Global state store tracking active AI model processing across the editor.
 */

import { create } from 'zustand';
import type { MathCurveType } from '@/components/Editor/ImageEditor/MathCurveLoader';

interface AiLoadingState {
  isLoading: boolean;
  operationName: string;
  detailMessage?: string;
  curveType?: MathCurveType;
  startAiProcessing: (operationName: string, detailMessage?: string, curveType?: MathCurveType) => void;
  updateAiMessage: (detailMessage: string) => void;
  stopAiProcessing: () => void;
}

export const useAiLoadingStore = create<AiLoadingState>((set) => ({
  isLoading: false,
  operationName: 'AI Model Processing',
  detailMessage: undefined,
  curveType: undefined,

  startAiProcessing: (operationName, detailMessage, curveType) =>
    set({
      isLoading: true,
      operationName,
      detailMessage,
      curveType,
    }),

  updateAiMessage: (detailMessage) =>
    set({ detailMessage }),

  stopAiProcessing: () =>
    set({
      isLoading: false,
      operationName: 'AI Model Processing',
      detailMessage: undefined,
      curveType: undefined,
    }),
}));
