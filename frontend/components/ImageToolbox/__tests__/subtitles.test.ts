import { describe, it, expect } from 'vitest';
import {
  detectSubtitleFormat,
  parseSubtitles,
  parseSubtitleTimestamp,
  formatSubtitleTimestamp,
  serializeSubtitles,
  validateSubtitleCues,
  type SubtitleCue,
} from '../subtitles';

const SRT_SAMPLE = `1
00:00:01,000 --> 00:00:03,500
Hello there

2
00:00:04,250 --> 00:00:06,000
Second line
with a continuation`;

const VTT_SAMPLE = `WEBVTT - test file

NOTE This is a comment block
that must be skipped

STYLE
::cue { color: red; }

intro
00:01.000 --> 00:03.000 align:start position:0%
Cue with settings

00:00:04.000 --> 00:00:05.500
Multi
line
text`;

describe('detectSubtitleFormat', () => {
  it('detects WebVTT from the header', () => {
    expect(detectSubtitleFormat(VTT_SAMPLE)).toBe('vtt');
  });

  it('defaults to SRT', () => {
    expect(detectSubtitleFormat(SRT_SAMPLE)).toBe('srt');
  });
});

describe('parseSubtitleTimestamp', () => {
  it('parses SRT timestamps with comma milliseconds', () => {
    expect(parseSubtitleTimestamp('00:00:01,200')).toBeCloseTo(1.2, 5);
    expect(parseSubtitleTimestamp('01:02:03,456')).toBeCloseTo(3723.456, 5);
  });

  it('parses VTT timestamps with dot milliseconds', () => {
    expect(parseSubtitleTimestamp('00:00:01.200')).toBeCloseTo(1.2, 5);
  });

  it('parses VTT shorthand without hours', () => {
    // WebVTT allows omitting hours (mm:ss.mmm) but never the minutes field.
    expect(parseSubtitleTimestamp('01:02.500')).toBeCloseTo(62.5, 5);
    expect(parseSubtitleTimestamp('01.500')).toBeNull();
  });

  it('rejects malformed timestamps', () => {
    expect(parseSubtitleTimestamp('nonsense')).toBeNull();
    expect(parseSubtitleTimestamp('00:99:00,000')).toBeNull();
    expect(parseSubtitleTimestamp('')).toBeNull();
  });
});

describe('formatSubtitleTimestamp', () => {
  it('formats per format separator', () => {
    expect(formatSubtitleTimestamp(1.2, 'srt')).toBe('00:00:01,200');
    expect(formatSubtitleTimestamp(1.2, 'vtt')).toBe('00:00:01.200');
  });

  it('handles large values and clamps negatives', () => {
    expect(formatSubtitleTimestamp(3723.456, 'srt')).toBe('01:02:03,456');
    expect(formatSubtitleTimestamp(-5, 'vtt')).toBe('00:00:00.000');
  });

  it('round-trips through the parser', () => {
    for (const seconds of [0, 0.001, 61.5, 3723.456]) {
      const formatted = formatSubtitleTimestamp(seconds, 'srt');
      expect(parseSubtitleTimestamp(formatted)).toBeCloseTo(seconds, 3);
    }
  });
});

describe('parseSubtitles', () => {
  it('parses SRT cues in order', () => {
    const { format, cues } = parseSubtitles(SRT_SAMPLE);
    expect(format).toBe('srt');
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, end: 3.5, text: 'Hello there' });
    expect(cues[1].text).toBe('Second line\nwith a continuation');
  });

  it('parses VTT cues, skipping NOTE/STYLE blocks and cue settings', () => {
    const { format, cues } = parseSubtitles(VTT_SAMPLE);
    expect(format).toBe('vtt');
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBeCloseTo(1, 5);
    expect(cues[0].text).toBe('Cue with settings');
    expect(cues[1].text).toBe('Multi\nline\ntext');
  });

  it('handles CRLF line endings', () => {
    const crlf = SRT_SAMPLE.replace(/\n/g, '\r\n');
    expect(parseSubtitles(crlf).cues).toHaveLength(2);
  });

  it('returns no cues for garbage input', () => {
    expect(parseSubtitles('not a subtitle file').cues).toHaveLength(0);
  });
});

describe('serializeSubtitles', () => {
  const cues: SubtitleCue[] = [
    { start: 1, end: 3.5, text: 'Hello there' },
    { start: 4.25, end: 6, text: 'Second line\nwith a continuation' },
  ];

  it('round-trips SRT through parse', () => {
    const text = serializeSubtitles(cues, 'srt');
    const reparsed = parseSubtitles(text);
    expect(reparsed.format).toBe('srt');
    expect(reparsed.cues).toEqual(cues);
  });

  it('round-trips WebVTT through parse', () => {
    const text = serializeSubtitles(cues, 'vtt');
    expect(text.startsWith('WEBVTT')).toBe(true);
    const reparsed = parseSubtitles(text);
    expect(reparsed.format).toBe('vtt');
    expect(reparsed.cues).toEqual(cues);
  });

  it('sorts cues by start time', () => {
    const unsorted: SubtitleCue[] = [
      { start: 5, end: 6, text: 'later' },
      { start: 1, end: 2, text: 'sooner' },
    ];
    const reparsed = parseSubtitles(serializeSubtitles(unsorted, 'srt'));
    expect(reparsed.cues.map(c => c.text)).toEqual(['sooner', 'later']);
  });
});

describe('validateSubtitleCues', () => {
  it('accepts valid cues', () => {
    expect(validateSubtitleCues([{ start: 0, end: 1, text: 'ok' }])).toBeNull();
  });

  it('rejects cues that end before they start', () => {
    expect(validateSubtitleCues([{ start: 2, end: 1, text: 'bad' }])).toMatch(/must end after/);
  });

  it('rejects empty text', () => {
    expect(validateSubtitleCues([{ start: 0, end: 1, text: '   ' }])).toMatch(/no text/);
  });
});
