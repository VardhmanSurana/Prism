import { useCallback } from 'react';

let globalAudioContext: AudioContext | null = null;
let globalMasterGain: GainNode | null = null;

export function useAudioContext() {
  const getOrCreateContext = useCallback(() => {
    if (typeof window === 'undefined') return { ctx: null, masterGain: null };
    if (!globalAudioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      globalAudioContext = new AudioCtx();
      globalMasterGain = globalAudioContext.createGain();
      globalMasterGain.connect(globalAudioContext.destination);
    }
    return { ctx: globalAudioContext, masterGain: globalMasterGain };
  }, []);

  const resume = useCallback(async () => {
    const { ctx } = getOrCreateContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  }, [getOrCreateContext]);

  return {
    getOrCreateContext,
    resume,
  };
}
