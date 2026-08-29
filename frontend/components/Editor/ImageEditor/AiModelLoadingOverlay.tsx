/**
 * AiModelLoadingOverlay.tsx
 * Fullscreen loading screen for AI model inference in the Image Editor.
 * Displays randomized mathematical curve animations (Lemniscate Bloom, Rose Three,
 * Spiral Search, Butterfly Phase, Rose Orbit, Hypotrochoid Loop) and rotating
 * engaging UX status messages to keep users informed and delighted during processing.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Cpu, ShieldCheck, X } from 'lucide-react';
import { MathCurveLoader, MathCurveType } from './MathCurveLoader';

export interface AiModelLoadingOverlayProps {
  isLoading: boolean;
  operationName?: string;
  detailMessage?: string;
  curveType?: MathCurveType;
  onCancel?: () => void;
}

const DEFAULT_AI_MESSAGES = [
  'Initializing on-device neural inference session...',
  'Extracting latent image embeddings & high-frequency details...',
  'Analyzing spatial composition & depth contours...',
  'Calibrating edge boundaries with sub-pixel precision...',
  'Synthesizing coherent textures & ambient illumination...',
  'Applying bilateral smoothing & anti-aliasing filters...',
  'Compositing pristine high-resolution tensor buffer...',
  'Finalizing AI output and updating workspace...',
];

const OPERATION_SPECIFIC_MESSAGES: Record<string, string[]> = {
  inpaint: [
    'Analyzing surrounding textures and lighting falloff...',
    'Synthesizing contextual background fills via LaMa neural engine...',
    'Reconstructing seamless texture gradients...',
    'Blending diffusion patches with surrounding pixels...',
    'Finalizing seamless removal...',
  ],
  sam: [
    'Running MobileSAM prompt encoder on target coordinates...',
    'Tracing zero-shot segmentation boundaries...',
    'Refining high-contrast mask silhouettes...',
    'Extracting sub-pixel alpha cutout...',
  ],
  matting: [
    'Computing foreground probability map...',
    'Refining fine hair strands and semi-transparent edges...',
    'Isolating foreground subject from backdrop...',
    'Generating high-precision alpha mask...',
  ],
  enhance: [
    'Running Real-ESRGAN super-resolution model...',
    'Reconstructing ultra-fine details and sharp edges...',
    'Suppressing compression artifacts and sensor noise...',
    'Generating 4K enhanced output pixels...',
  ],
  face: [
    'Scanning facial landmarks and orientation anchors...',
    'Restoring eye clarity, skin texture, and facial symmetry...',
    'Applying GFPGAN fidelity priors...',
    'Blending restored face crops back into scene...',
  ],
};

const ROTATING_TIPS = [
  'Prism runs all AI models 100% locally on your machine — zero cloud uploads.',
  'Tip: Double exposure and blend modes can be stacked non-destructively in the Layer Stack.',
  'Tip: Hold the \\ key anywhere in the editor to compare before/after in real-time.',
  'Tip: MobileSAM allows point-and-click selection of complex objects with sub-pixel accuracy.',
];

export const AiModelLoadingOverlay: React.FC<AiModelLoadingOverlayProps> = ({
  isLoading,
  operationName = 'AI Neural Processing',
  detailMessage,
  curveType,
  onCancel,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Pick suitable message pool based on operation
  const messagePool = useMemo(() => {
    const lower = operationName.toLowerCase();
    if (lower.includes('eraser') || lower.includes('inpaint')) return OPERATION_SPECIFIC_MESSAGES.inpaint;
    if (lower.includes('sam') || lower.includes('select')) return OPERATION_SPECIFIC_MESSAGES.sam;
    if (lower.includes('background') || lower.includes('cutout') || lower.includes('depth text') || lower.includes('matting')) return OPERATION_SPECIFIC_MESSAGES.matting;
    if (lower.includes('enhance') || lower.includes('upscale') || lower.includes('denoise')) return OPERATION_SPECIFIC_MESSAGES.enhance;
    if (lower.includes('face') || lower.includes('portrait')) return OPERATION_SPECIFIC_MESSAGES.face;
    return DEFAULT_AI_MESSAGES;
  }, [operationName]);

  // Reset timer on loading state change
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      setCurrentMessageIndex(0);
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 100) / 10);
    }, 100);

    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messagePool.length);
    }, 2400);

    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ROTATING_TIPS.length);
    }, 6000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(messageInterval);
      clearInterval(tipInterval);
    };
  }, [isLoading, messagePool.length]);

  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#090a0f]/80 backdrop-blur-md animate-fade-in select-none text-white p-6">
      {/* Top Floating Badge */}
      <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 shadow-lg">
        <Cpu size={14} className="text-cyan-400 animate-pulse" />
        <span className="text-[11px] font-mono font-medium text-white/80">Local ONNX Engine</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Cancel processing"
        >
          <X size={16} />
        </button>
      )}

      {/* Center Math Curve Animation */}
      <div className="relative flex flex-col items-center">
        <MathCurveLoader curveType={curveType} size={220} color="#38bdf8" showBadge={true} />

        {/* Operation Title */}
        <div className="mt-5 text-center space-y-1.5">
          <div className="inline-flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400 animate-spin-slow" />
            <h2 className="text-base font-bold tracking-wide text-white drop-shadow-md">
              {operationName}
            </h2>
          </div>

          {/* Dynamic rotating UX message */}
          <div className="h-6 flex items-center justify-center">
            <p className="text-xs text-white/80 font-medium transition-all duration-300 animate-fade-in tracking-wide">
              {detailMessage || messagePool[currentMessageIndex]}
            </p>
          </div>

          {/* Live Timer Counter */}
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>Elapsed: {elapsedSeconds.toFixed(1)}s</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Educational Tip Bar */}
      <div className="absolute bottom-6 max-w-lg text-center px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40 font-medium">
          <ShieldCheck size={13} className="text-emerald-400/80 flex-shrink-0" />
          <span className="transition-opacity duration-500">{ROTATING_TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
};

