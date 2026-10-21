/**
 * subtitles.ts - Client-side SRT/WebVTT parsing and serialization for the
 * Subtitle Editor tool. Pure functions with no browser dependencies so they
 * can be unit tested directly.
 */

export type SubtitleFormat = 'srt' | 'vtt';

export interface SubtitleCue {
  /** Cue start time in seconds. */
  start: number;
  /** Cue end time in seconds. */
  end: number;
  /** Cue payload text (may contain multiple lines). */
  text: string;
}

export interface ParsedSubtitles {
  format: SubtitleFormat;
  cues: SubtitleCue[];
}

/**
 * detectSubtitleFormat - Detects whether text is WebVTT or SubRip (SRT).
 */
export const detectSubtitleFormat = (text: string): SubtitleFormat =>
  /^\s*WEBVTT\b/.test(text) ? 'vtt' : 'srt';

/**
 * parseSubtitleTimestamp - Parses "00:00:01,200" (SRT) or "00:00:01.200" /
 * "01.200" (VTT) into seconds. Returns null when invalid.
 */
export const parseSubtitleTimestamp = (token: string): number | null => {
  const match = token.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4].padEnd(3, '0'));
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
};

/**
 * formatSubtitleTimestamp - Formats seconds as an SRT/VTT timestamp
 * (e.g. "00:00:01,200" for SRT, "00:00:01.200" for VTT).
 */
export const formatSubtitleTimestamp = (seconds: number, format: SubtitleFormat): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  const separator = format === 'vtt' ? '.' : ',';
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${String(ms).padStart(3, '0')}`;
};

/**
 * parseSubtitleTimingLine - Parses a "start --> end" timing line (with optional
 * VTT cue settings after the end timestamp) into seconds.
 */
const parseSubtitleTimingLine = (line: string): { start: number; end: number } | null => {
  const parts = line.split('-->');
  if (parts.length !== 2) return null;
  const endToken = parts[1].trim().split(/\s+/)[0] ?? '';
  const start = parseSubtitleTimestamp(parts[0]);
  const end = parseSubtitleTimestamp(endToken);
  if (start === null || end === null) return null;
  return { start, end };
};

/**
 * parseSubtitles - Parses SRT or WebVTT text into structured cues.
 * VTT headers, NOTE/STYLE/REGION blocks, and cue identifiers are skipped.
 */
export const parseSubtitles = (text: string): ParsedSubtitles => {
  const format = detectSubtitleFormat(text);
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const cues: SubtitleCue[] = [];

  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((line, idx) => idx === 0 || line.trim() !== '');
    if (lines.length === 0) continue;

    const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex === -1) continue;

    const timing = parseSubtitleTimingLine(lines[timingIndex]);
    if (!timing) continue;

    // Skip VTT metadata blocks (they never carry a valid timing line, but be safe).
    const firstToken = lines[0].trim().split(/\s+/)[0];
    if (firstToken === 'NOTE' || firstToken === 'STYLE' || firstToken === 'REGION') continue;

    const payload = lines.slice(timingIndex + 1).join('\n').trim();
    if (!payload) continue;

    cues.push({ start: timing.start, end: timing.end, text: payload });
  }

  cues.sort((a, b) => a.start - b.start);
  return { format, cues };
};

/**
 * serializeSubtitles - Renders cues back into SRT or WebVTT text.
 */
export const serializeSubtitles = (cues: SubtitleCue[], format: SubtitleFormat): string => {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const blocks = sorted.map(
    (cue, idx) =>
      `${idx + 1}\n${formatSubtitleTimestamp(cue.start, format)} --> ${formatSubtitleTimestamp(cue.end, format)}\n${cue.text.trim()}`,
  );
  const body = blocks.join('\n\n');
  return format === 'vtt' ? `WEBVTT\n\n${body}\n` : `${body}\n`;
};

/**
 * validateSubtitleCues - Returns an error message for the first invalid cue,
 * or null when every cue is valid.
 */
export const validateSubtitleCues = (cues: SubtitleCue[]): string | null => {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) {
      return `Cue ${i + 1} has an invalid timestamp.`;
    }
    if (cue.start < 0) return `Cue ${i + 1} starts before zero.`;
    if (cue.end <= cue.start) return `Cue ${i + 1} must end after it starts.`;
    if (!cue.text.trim()) return `Cue ${i + 1} has no text.`;
  }
  return null;
};
