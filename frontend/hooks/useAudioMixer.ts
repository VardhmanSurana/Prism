import { useEffect, useRef } from 'react';
import type { Track } from '@/types/nle';
import { useAudioContext } from '@/hooks/useAudioContext';
import { evaluateKeyframes } from '@/lib/keyframes';

interface AudioNodeEntry {
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
}

export function useAudioMixer(
  videoRefs: Map<string, HTMLVideoElement | null>,
  tracks: Track[],
  isPlaying: boolean,
  playheadPosition: number,
  projectFps: number,
) {
  const { getOrCreateContext, resume } = useAudioContext();
  const nodesRef = useRef<Map<HTMLVideoElement, AudioNodeEntry>>(new Map());

  useEffect(() => {
    if (isPlaying) {
      resume();
    }
  }, [isPlaying, resume]);

  useEffect(() => {
    const { ctx, masterGain } = getOrCreateContext();
    if (!ctx || !masterGain) return;

    const seenElements = new Set<HTMLVideoElement>();

    for (const track of tracks) {
      for (const clip of track.clips) {
        const videoEntry = videoRefs.get(clip.id);
        if (!videoEntry) continue;
        seenElements.add(videoEntry);

        let entry = nodesRef.current.get(videoEntry);

        if (!entry) {
          try {
            const source = ctx.createMediaElementSource(videoEntry);
            const gainNode = ctx.createGain();
            source.connect(gainNode);
            gainNode.connect(masterGain);
            entry = { source, gainNode };
            nodesRef.current.set(videoEntry, entry);
          } catch {
            continue;
          }
        }

        const trackMuted = track.muted;
        const clipMuted = clip.muted;

        const clipStartSeconds = clip.startFrame / projectFps;
        const relativeTime = playheadPosition - clipStartSeconds;

        let clipVolume = clip.volume;
        if (clip.keyframes?.['volume']?.length) {
          clipVolume = evaluateKeyframes(clip.keyframes['volume'], relativeTime);
        }

        const anySolo = tracks.some((t) => t.solo);
        const effectiveVolume = anySolo
          ? (track.solo && !clipMuted ? clipVolume : 0)
          : (trackMuted || clipMuted ? 0 : clipVolume);

        const clampedVolume = Math.max(0, Math.min(1, effectiveVolume));

        entry.gainNode.gain.setValueAtTime(clampedVolume, ctx.currentTime);
      }
    }

    for (const [el, entry] of nodesRef.current) {
      if (!seenElements.has(el)) {
        entry.source.disconnect();
        entry.gainNode.disconnect();
        nodesRef.current.delete(el);
      }
    }
  }, [tracks, videoRefs, playheadPosition, projectFps, getOrCreateContext]);

  useEffect(() => {
    return () => {
      for (const [, entry] of nodesRef.current) {
        entry.source.disconnect();
        entry.gainNode.disconnect();
      }
      nodesRef.current.clear();
    };
  }, []);
}

