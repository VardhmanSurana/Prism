import { useEffect, useRef } from 'react';
import type { Track } from '@/types/nle';
import { useAudioContext } from '@/hooks/useAudioContext';
import { evaluateKeyframes } from '@/lib/keyframes';

interface AudioNodeEntry {
  source: MediaElementAudioSourceNode;
  lowFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  highFilter: BiquadFilterNode;
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

    // Check if any speech/dialogue (video track audio) is actively playing at playhead
    const speechIsActive = tracks.some((t) => {
      if (t.muted || t.type === 'audio') return false;
      return t.clips.some((c) => {
        const start = c.startFrame / projectFps;
        const end = start + c.durationFrames / projectFps;
        return playheadPosition >= start && playheadPosition <= end && !c.muted && c.volume > 0;
      });
    });

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

            // 3-Band Equalizer Filters
            const lowFilter = ctx.createBiquadFilter();
            lowFilter.type = 'lowshelf';
            lowFilter.frequency.value = 320; // Bass

            const midFilter = ctx.createBiquadFilter();
            midFilter.type = 'peaking';
            midFilter.frequency.value = 1000; // Voice / Mid
            midFilter.Q.value = 1.0;

            const highFilter = ctx.createBiquadFilter();
            highFilter.type = 'highshelf';
            highFilter.frequency.value = 3200; // Treble

            const gainNode = ctx.createGain();

            // Connect signal path: source -> low -> mid -> high -> gain -> masterGain
            source.connect(lowFilter);
            lowFilter.connect(midFilter);
            midFilter.connect(highFilter);
            highFilter.connect(gainNode);
            gainNode.connect(masterGain);

            entry = { source, lowFilter, midFilter, highFilter, gainNode };
            nodesRef.current.set(videoEntry, entry);
          } catch {
            continue;
          }
        }

        const trackMuted = track.muted;
        const clipMuted = clip.muted;

        const clipStartSeconds = clip.startFrame / projectFps;
        const relativeTime = playheadPosition - clipStartSeconds;

        // Dynamic speed ramping rate adjustment for video/audio element
        if (clip.keyframes?.['speed']?.length) {
          const speedKfs = clip.keyframes['speed'];
          const lastKf = speedKfs[speedKfs.length - 1];
          const firstKf = speedKfs[0];
          let instSpeed = clip.speed ?? 1;
          if (relativeTime <= firstKf.t) instSpeed = firstKf.v;
          else if (relativeTime >= lastKf.t) instSpeed = lastKf.v;
          else {
            for (let k = 0; k < speedKfs.length - 1; k++) {
              if (relativeTime >= speedKfs[k].t && relativeTime <= speedKfs[k + 1].t) {
                const prog = (relativeTime - speedKfs[k].t) / (speedKfs[k + 1].t - speedKfs[k].t);
                instSpeed = speedKfs[k].v + (speedKfs[k + 1].v - speedKfs[k].v) * prog;
                break;
              }
            }
          }
          const targetRate = Math.max(0.1, Math.min(4.0, instSpeed));
          if (Math.abs(videoEntry.playbackRate - targetRate) > 0.05 && isPlaying) {
            videoEntry.playbackRate = targetRate;
          }
        } else if (videoEntry.playbackRate !== (clip.speed ?? 1) && isPlaying) {
          videoEntry.playbackRate = clip.speed ?? 1;
        }

        // Apply 3-Band EQ gains
        const eq = clip.eq ?? { lowGain: 0, midGain: 0, highGain: 0, ducking: false };
        entry.lowFilter.gain.setValueAtTime(eq.lowGain, ctx.currentTime);
        entry.midFilter.gain.setValueAtTime(eq.midGain, ctx.currentTime);
        entry.highFilter.gain.setValueAtTime(eq.highGain, ctx.currentTime);

        // Volume calculation & keyframing
        let clipVolume = clip.volume;
        if (clip.keyframes?.['volume']?.length) {
          clipVolume = evaluateKeyframes(clip.keyframes['volume'], relativeTime);
        }

        const anySolo = tracks.some((t) => t.solo);
        const effectiveVolume = anySolo
          ? (track.solo && !clipMuted ? clipVolume : 0)
          : (trackMuted || clipMuted ? 0 : clipVolume);

        const clampedVolume = Math.max(0, Math.min(1, effectiveVolume));

        // Fade-In & Fade-Out handles
        const clipDurationSec = clip.durationFrames / projectFps;
        let fadeMult = 1.0;
        if (clip.fadeIn > 0 && relativeTime < clip.fadeIn) {
          fadeMult *= Math.max(0, relativeTime / clip.fadeIn);
        }
        if (clip.fadeOut > 0 && relativeTime > clipDurationSec - clip.fadeOut) {
          const rem = clipDurationSec - relativeTime;
          fadeMult *= Math.max(0, rem / clip.fadeOut);
        }

        // Auto-ducking (-12dB = 0.25x volume when speech active)
        let duckingMult = 1.0;
        if (eq.ducking && speechIsActive && track.type === 'audio') {
          duckingMult = 0.25;
        }

        const finalVolume = clampedVolume * fadeMult * duckingMult;
        entry.gainNode.gain.setValueAtTime(finalVolume, ctx.currentTime);
      }
    }

    for (const [el, entry] of nodesRef.current) {
      if (!seenElements.has(el)) {
        entry.source.disconnect();
        entry.lowFilter.disconnect();
        entry.midFilter.disconnect();
        entry.highFilter.disconnect();
        entry.gainNode.disconnect();
        nodesRef.current.delete(el);
      }
    }
  }, [tracks, videoRefs, playheadPosition, projectFps, getOrCreateContext]);

  useEffect(() => {
    return () => {
      for (const [, entry] of nodesRef.current) {
        entry.source.disconnect();
        entry.lowFilter.disconnect();
        entry.midFilter.disconnect();
        entry.highFilter.disconnect();
        entry.gainNode.disconnect();
      }
      nodesRef.current.clear();
    };
  }, []);
}
