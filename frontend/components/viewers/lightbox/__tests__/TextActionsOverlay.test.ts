import { describe, it, expect } from 'vitest';
import {
  applyQuickRedact,
  formatAsTable,
  isRedactedText,
} from '../TextActionsOverlay';
import { OcrBbox } from '@/types';

describe('TextActionsOverlay helpers', () => {
  describe('applyQuickRedact & isRedactedText', () => {
    it('masks email addresses correctly', () => {
      const input = 'Contact me at test.user+label@example.co.uk for inquiries.';
      expect(isRedactedText(input)).toBe(true);
      const redacted = applyQuickRedact(input);
      expect(redacted).toBe('Contact me at [REDACTED EMAIL] for inquiries.');
    });

    it('masks phone numbers with area codes and international prefixes', () => {
      const phones = [
        '+1 (555) 123-4567',
        '(555) 123-4567',
        '555-123-4567',
        '555.123.4567',
        '+44 7911 123456',
        '1234567890',
      ];

      for (const phone of phones) {
        const text = `Call ${phone} now`;
        expect(isRedactedText(text)).toBe(true);
        expect(applyQuickRedact(text)).toContain('[REDACTED PHONE]');
      }
    });

    it('masks 16-digit credit card numbers', () => {
      const cards = [
        '4111 2222 3333 4444',
        '4111-2222-3333-4444',
        '4111222233334444',
      ];

      for (const card of cards) {
        const text = `Payment card: ${card}`;
        expect(isRedactedText(text)).toBe(true);
        expect(applyQuickRedact(text)).toContain('[REDACTED CARD]');
      }
    });

    it('does not mask innocent numbers or non-PII tokens', () => {
      const innocentTexts = [
        'Total: $42.50 on invoice 12345',
        'Date: 2026-09-07 at 14:30',
        'Item #98765 in stock',
        'Short 7-digit code: 123-4567',
      ];

      for (const text of innocentTexts) {
        expect(isRedactedText(text)).toBe(false);
        expect(applyQuickRedact(text)).toBe(text);
      }
    });

    it('handles multiple distinct PII types in one text block', () => {
      const text = 'Reach john@corp.org at 555-234-5678 or charge 1111-2222-3333-4444.';
      const redacted = applyQuickRedact(text);
      expect(redacted).toBe('Reach [REDACTED EMAIL] at [REDACTED PHONE] or charge [REDACTED CARD].');
    });
  });

  describe('formatAsTable', () => {
    it('returns an empty string when given no lines', () => {
      expect(formatAsTable([])).toBe('');
    });

    it('formats a single line', () => {
      const line: OcrBbox = {
        text: 'Header Title',
        bbox: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.15], [0.1, 0.15]],
        confidence: 0.95,
      };
      expect(formatAsTable([line])).toBe('Header Title');
    });

    it('groups lines with similar Y coordinates into the same row separated by tabs', () => {
      const lines: OcrBbox[] = [
        {
          text: 'Col B',
          bbox: [[0.5, 0.1], [0.8, 0.1], [0.8, 0.14], [0.5, 0.14]],
          confidence: 0.9,
        },
        {
          text: 'Col A',
          bbox: [[0.1, 0.105], [0.4, 0.105], [0.4, 0.145], [0.1, 0.145]],
          confidence: 0.9,
        },
      ];

      const table = formatAsTable(lines);
      // Col A (x=0.1) comes before Col B (x=0.5) on the same row
      expect(table).toBe('Col A\tCol B');
    });

    it('separates rows with distinct Y coordinates with newlines', () => {
      const lines: OcrBbox[] = [
        {
          text: 'Row 1 Left',
          bbox: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.14], [0.1, 0.14]],
          confidence: 0.9,
        },
        {
          text: 'Row 1 Right',
          bbox: [[0.6, 0.1], [0.9, 0.1], [0.9, 0.14], [0.6, 0.14]],
          confidence: 0.9,
        },
        {
          text: 'Row 2 Left',
          bbox: [[0.1, 0.3], [0.4, 0.3], [0.4, 0.34], [0.1, 0.34]],
          confidence: 0.9,
        },
        {
          text: 'Row 2 Right',
          bbox: [[0.6, 0.3], [0.9, 0.3], [0.9, 0.34], [0.6, 0.34]],
          confidence: 0.9,
        },
      ];

      const table = formatAsTable(lines);
      expect(table).toBe('Row 1 Left\tRow 1 Right\nRow 2 Left\tRow 2 Right');
    });
  });
});

