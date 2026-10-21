/**
 * audioWaveformExtractor.ts — Asynchronous Audio Amplitude Peak Extractor.
 * Extracts normalized peak amplitude values (0.0 to 1.0) using Web Audio API OfflineAudioContext.
 */

const peakCache = new Map<string, number[]>();

/**
 * extractAudioPeaks - Performs extract audio peaks.
 */
export async function extractAudioPeaks(
  audioUrl: string,
  targetSamples: number = 100
): Promise<number[]> {
  if (!audioUrl) return [];

  const cached = peakCache.get(audioUrl);
  if (cached) return cached;

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) return [];

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return [];

    // Create an AudioContext to decode audio data
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioCtx();

    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    await tempCtx.close();

    const channelData = audioBuffer.getChannelData(0); // Use primary channel
    const totalSamples = channelData.length;
    const blockSize = Math.floor(totalSamples / targetSamples);

    const peaks: number[] = new Array(targetSamples);

    for (let i = 0; i < targetSamples; i++) {
      const start = i * blockSize;
      let sum = 0;
      let max = 0;

      for (let j = 0; j < blockSize && start + j < totalSamples; j++) {
        const val = Math.abs(channelData[start + j]);
        if (val > max) max = val;
        sum += val * val;
      }

      // Root Mean Square (RMS) combined with peak for clean waveform rendering
      const rms = Math.sqrt(sum / Math.max(1, blockSize));
      const peakVal = Math.min(1.0, (max * 0.7 + rms * 0.3));
      peaks[i] = Math.round(peakVal * 100) / 100;
    }

    peakCache.set(audioUrl, peaks);
    return peaks;
  } catch (e) {
    console.error('Failed to extract audio peaks:', e);
    return [];
  }
}
