/**
 * TransitionsPanel — Browse and apply video transitions with black & white animated previews.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { findClipById } from '@/store/nle/helpers';
import type { Transition } from '@/types/nle';

interface TransitionPreset {
  name: string;
  category: 'Dissolve' | 'Iris' | 'Motion' | 'Wipe' | 'Zoom' | 'Stylized' | '3D Motion';
  type: Transition['type'];
  duration: number;
}

const TRANSITION_PRESETS: TransitionPreset[] = [
  // Dissolve
  { name: 'Cross Dissolve', category: 'Dissolve', type: 'crossfade', duration: 1.0 },
  { name: 'Film Dissolve', category: 'Dissolve', type: 'dissolve', duration: 1.0 },
  { name: 'Dip to Black', category: 'Dissolve', type: 'dip-to-black', duration: 1.0 },
  { name: 'Dip to White', category: 'Dissolve', type: 'dip-to-white', duration: 1.0 },

  // Iris / Shapes
  { name: 'Iris Circle', category: 'Iris', type: 'iris-circle', duration: 1.0 },
  { name: 'Iris Box', category: 'Iris', type: 'iris-box', duration: 1.0 },
  { name: 'Iris Diamond', category: 'Iris', type: 'iris-diamond', duration: 1.0 },
  { name: 'Iris Star', category: 'Iris', type: 'iris-star', duration: 1.0 },
  { name: 'Heart Reveal', category: 'Iris', type: 'iris-heart', duration: 1.0 },

  // Motion / Slide
  { name: 'Push Left', category: 'Motion', type: 'push-left', duration: 1.0 },
  { name: 'Push Right', category: 'Motion', type: 'push-right', duration: 1.0 },
  { name: 'Push Up', category: 'Motion', type: 'push-up', duration: 1.0 },
  { name: 'Push Down', category: 'Motion', type: 'push-down', duration: 1.0 },
  { name: 'Slide Left', category: 'Motion', type: 'slide-left', duration: 1.0 },
  { name: 'Slide Right', category: 'Motion', type: 'slide-right', duration: 1.0 },
  { name: 'Whip Pan', category: 'Motion', type: 'whip-pan', duration: 0.6 },
  { name: 'Center Split', category: 'Motion', type: 'split', duration: 1.0 },

  // Wipe
  { name: 'Wipe Left', category: 'Wipe', type: 'wipe-left', duration: 1.0 },
  { name: 'Wipe Right', category: 'Wipe', type: 'wipe-right', duration: 1.0 },
  { name: 'Barn Doors', category: 'Wipe', type: 'barn-doors', duration: 1.0 },
  { name: 'Clock Wipe', category: 'Wipe', type: 'clock-wipe', duration: 1.0 },

  // Zoom / Spin
  { name: 'Cross Zoom', category: 'Zoom', type: 'zoom', duration: 1.0 },
  { name: 'Zoom In', category: 'Zoom', type: 'zoom-in', duration: 1.0 },
  { name: 'Spin Rotate', category: 'Zoom', type: 'spin', duration: 1.0 },

  // Stylized (Clipchamp)
  { name: 'Digital Glitch', category: 'Stylized', type: 'glitch', duration: 0.8 },
  { name: 'Pixelate Mosaic', category: 'Stylized', type: 'pixelate', duration: 1.0 },
  { name: 'Light Leak', category: 'Stylized', type: 'light-leak', duration: 1.0 },
  { name: 'Film Burn', category: 'Stylized', type: 'burn', duration: 1.0 },

  // 3D Motion
  { name: 'Cube Spin', category: '3D Motion', type: 'cube-spin', duration: 1.0 },
  { name: '3D Flip', category: '3D Motion', type: 'flip', duration: 1.0 },
];

const CATEGORIES = ['All', 'Dissolve', 'Iris', 'Motion', 'Wipe', 'Zoom', 'Stylized', '3D Motion'] as const;

/**
 * High-contrast Black & White animated preview thumbnail component for transition cards.
 * Renders pure monochrome (black/white) transition effects in real-time canvas animation loop without static icons.
 */
const AnimatedTransitionThumbnail: React.FC<{ type: Transition['type'] }> = ({ type }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;

    const width = canvas.width;
    const height = canvas.height;

    // Offscreen Canvas A (Pure Black with White 'A')
    const offA = document.createElement('canvas');
    offA.width = width; offA.height = height;
    const ctxA = offA.getContext('2d')!;
    ctxA.fillStyle = '#000000';
    ctxA.fillRect(0, 0, width, height);
    ctxA.fillStyle = '#ffffff';
    ctxA.font = '900 16px sans-serif';
    ctxA.textAlign = 'center';
    ctxA.textBaseline = 'middle';
    ctxA.fillText('A', width / 2, height / 2);

    // Offscreen Canvas B (Pure White with Black 'B')
    const offB = document.createElement('canvas');
    offB.width = width; offB.height = height;
    const ctxB = offB.getContext('2d')!;
    ctxB.fillStyle = '#ffffff';
    ctxB.fillRect(0, 0, width, height);
    ctxB.fillStyle = '#000000';
    ctxB.font = '900 16px sans-serif';
    ctxB.textAlign = 'center';
    ctxB.textBaseline = 'middle';
    ctxB.fillText('B', width / 2, height / 2);

    const duration = 1600; // 1.6s loop

    const renderFrame = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % duration;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, width, height);

      // Render monochrome transitions
      if (type === 'crossfade' || type === 'dissolve') {
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(offA, 0, 0);
        ctx.globalAlpha = progress;
        ctx.drawImage(offB, 0, 0);
        ctx.globalAlpha = 1.0;
      } else if (type === 'dip-to-black') {
        if (progress < 0.5) {
          ctx.globalAlpha = 1 - progress * 2;
          ctx.drawImage(offA, 0, 0);
        } else {
          ctx.globalAlpha = (progress - 0.5) * 2;
          ctx.drawImage(offB, 0, 0);
        }
        ctx.globalAlpha = 1.0;
      } else if (type === 'wipe-left') {
        ctx.drawImage(offA, 0, 0);
        const wipeX = (1 - progress) * width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(wipeX, 0, width - wipeX, height);
        ctx.clip();
        ctx.drawImage(offB, 0, 0);
        ctx.restore();
      } else if (type === 'wipe-right') {
        ctx.drawImage(offA, 0, 0);
        const wipeX = progress * width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, wipeX, height);
        ctx.clip();
        ctx.drawImage(offB, 0, 0);
        ctx.restore();
      } else if (type === 'push-left' || type === 'slide-left') {
        const offX = progress * width;
        ctx.drawImage(offA, -offX, 0);
        ctx.drawImage(offB, width - offX, 0);
      } else if (type === 'push-right') {
        const offX = progress * width;
        ctx.drawImage(offA, offX, 0);
        ctx.drawImage(offB, -width + offX, 0);
      } else if (type === 'iris-circle') {
        ctx.drawImage(offA, 0, 0);
        const radius = progress * (width * 0.7);
        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(offB, 0, 0);
        ctx.restore();
      } else if (type === 'iris-box' || type === 'iris-diamond') {
        ctx.drawImage(offA, 0, 0);
        const size = progress * width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(width / 2 - size / 2, height / 2 - size / 2, size, size);
        ctx.clip();
        ctx.drawImage(offB, 0, 0);
        ctx.restore();
      } else if (type === 'zoom' || type === 'zoom-in' || type === 'spin') {
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(offA, 0, 0);
        ctx.globalAlpha = progress;
        const scale = 0.5 + progress * 0.5;
        const sw = width * scale;
        const sh = height * scale;
        ctx.drawImage(offB, (width - sw) / 2, (height - sh) / 2, sw, sh);
        ctx.globalAlpha = 1.0;
      } else if (type === 'glitch' || type === 'pixelate') {
        ctx.drawImage(progress < 0.5 ? offA : offB, 0, 0);
        if (progress > 0.3 && progress < 0.7) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.random() * width, Math.random() * height, 20, 6);
        }
      } else {
        // Default B&W fade fallback
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(offA, 0, 0);
        ctx.globalAlpha = progress;
        ctx.drawImage(offB, 0, 0);
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={36}
      className="rounded border border-white/20 bg-black shadow-md block"
    />
  );
};

export const TransitionsPanel: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const tracks = useNLEStore((s) => s.tracks);
  const selectedClipId = useNLEStore((s) => s.selectedClipId);
  const selectedClip = useMemo(() => selectedClipId ? findClipById(tracks, selectedClipId) : null, [tracks, selectedClipId]);
  const setClipTransition = useNLEStore((s) => s.setClipTransition);

  const applyTransition = useCallback((preset: TransitionPreset) => {
    if (!selectedClip) return;
    setClipTransition(selectedClip.id, {
      type: preset.type,
      duration: preset.duration,
    });
  }, [selectedClip, setClipTransition]);

  const removeTransition = useCallback(() => {
    if (!selectedClip) return;
    setClipTransition(selectedClip.id, undefined);
  }, [selectedClip, setClipTransition]);

  const filtered = TRANSITION_PRESETS.filter((p) =>
    activeCategory === 'All' || p.category === activeCategory
  );

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0 select-none">
      <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Transitions Library</span>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-[#2a2a2a] overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-[#3b82f6] text-white font-medium'
                : 'bg-[#222] text-[#666] hover:text-[#999]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {!selectedClip ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-[#666] text-xs text-center">
            Select a clip on the timeline to add a transition.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {/* Remove transition button */}
          {selectedClip.transition && (
            <button
              onClick={removeTransition}
              className="w-full mb-2 px-3 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-800/50 text-red-400 text-[11px] rounded transition-colors"
            >
              Remove Current Transition
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {filtered.map((preset, idx) => (
              <button
                key={`${preset.type}-${preset.duration}-${idx}`}
                onClick={() => applyTransition(preset)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded border transition-all ${
                  selectedClip.transition?.type === preset.type
                    ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6] shadow-lg shadow-blue-500/10'
                    : 'bg-[#222] hover:bg-[#2a2a2a] border-[#333] hover:border-[#555]'
                }`}
              >
                {/* Animated Black & White Transition Preview Canvas */}
                <AnimatedTransitionThumbnail type={preset.type} />
                <span className="text-[#ccc] text-[10px] font-medium leading-tight text-center truncate w-full">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransitionsPanel;
