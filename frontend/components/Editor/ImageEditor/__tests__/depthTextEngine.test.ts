import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_DEPTH_TEXT_SETTINGS,
  DEPTH_TEXT_PRESETS,
  drawDepthTextToCanvas,
  DepthTextSettings,
} from '../depthTextEngine';

describe('Depth Typography Engine (Text Behind Subject)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has valid default depth text settings', () => {
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.text).toBe('NEVER\nGIVE\nUP');
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.fontFamily).toBe('Anton');
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.fillColor).toBe('#e4e4e7');
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.strokeColor).toBe('#22c55e');
    expect(DEFAULT_DEPTH_TEXT_SETTINGS.strokePlacement).toBe('front');
  });

  it('includes required preset styles including Gym Motivation', () => {
    const gymPreset = DEPTH_TEXT_PRESETS.find((p) => p.id === 'gym-motivation');
    expect(gymPreset).toBeDefined();
    expect(gymPreset?.settings.strokeColor).toBe('#22c55e');
    expect(gymPreset?.settings.strokePlacement).toBe('front');

    const cyberpunk = DEPTH_TEXT_PRESETS.find((p) => p.id === 'cyberpunk-neon');
    expect(cyberpunk).toBeDefined();
  });

  it('returns early without throwing when depthText is disabled or empty', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    const settings: DepthTextSettings = {
      ...DEFAULT_DEPTH_TEXT_SETTINGS,
      enabled: false,
    };

    expect(() => drawDepthTextToCanvas(canvas, settings, null)).not.toThrow();

    const emptyTextSettings: DepthTextSettings = {
      ...DEFAULT_DEPTH_TEXT_SETTINGS,
      enabled: true,
      text: '   ',
    };

    expect(() => drawDepthTextToCanvas(canvas, emptyTextSettings, null)).not.toThrow();
  });

  it('correctly executes multi-pass drawing with subject mask and front stroke', () => {
    const mockCtx = {
      drawImage: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
      })),
      putImageData: vi.fn(),
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'center',
      textBaseline: 'alphabetic',
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;

    const mask = document.createElement('canvas');
    mask.width = 1000;
    mask.height = 1000;

    const settings: DepthTextSettings = {
      ...DEFAULT_DEPTH_TEXT_SETTINGS,
      enabled: true,
      text: 'NEVER\nGIVE\nUP',
      strokeEnabled: true,
      strokePlacement: 'front',
    };

    drawDepthTextToCanvas(canvas, settings, mask);

    // Verify multi-pass rendering occurred:
    // 1. Text fill
    expect(mockCtx.fillText).toHaveBeenCalled();
    // 2. Subject cutout mask processing
    expect(mockCtx.putImageData).toHaveBeenCalled();
    // 3. Front stroke outline
    expect(mockCtx.strokeText).toHaveBeenCalled();
  });
});
