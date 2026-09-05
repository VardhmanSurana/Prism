/**
 * AiModelLoadingOverlay.tsx
 * Fullscreen loading screen for AI model inference in the Image Editor.
 * Displays randomized mathematical curve animations (Lemniscate Bloom, Rose Three,
 * Spiral Search, Butterfly Phase, Rose Orbit, Hypotrochoid Loop) and rotating
 * engaging UX status messages to keep users informed and delighted during processing.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MathCurveLoader, MathCurveType } from './MathCurveLoader';
import { BlurReveal, SlideUpText } from './textAnimations';

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

export const AiModelLoadingOverlay: React.FC<AiModelLoadingOverlayProps> = ({
  isLoading,
  operationName = 'AI Neural Processing',
  detailMessage,
  curveType,
  onCancel,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
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

    return () => {
      clearInterval(timerInterval);
      clearInterval(messageInterval);
    };
  }, [isLoading, messagePool.length]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="ai-model-loading-overlay-root"
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#090a0f]/85 backdrop-blur-md select-none text-white p-6 overflow-hidden"
        >
          {onCancel && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              type="button"
              onClick={onCancel}
              className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              title="Cancel processing"
            >
              <X size={18} />
            </motion.button>
          )}

          {/* Center Math Curve Animation */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: -16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
            className="relative flex flex-col items-center"
          >
            <MathCurveLoader curveType={curveType} size={150} color="#ffffff" showBadge={false} />

            {/* Operation Title with Spell UI BlurReveal */}
            <div className="mt-6 text-center space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                <BlurReveal key={operationName} text={operationName} />
              </h2>

              {/* Dynamic rotating UX message with Spell UI SlideUpText */}
              <div className="min-h-[28px] flex items-center justify-center max-w-lg px-4">
                <SlideUpText
                  textKey={detailMessage || messagePool[currentMessageIndex]}
                  className="text-center"
                >
                  <p className="text-sm sm:text-base text-white/90 font-medium tracking-normal text-center">
                    {detailMessage || messagePool[currentMessageIndex]}
                  </p>
                </SlideUpText>
              </div>

              {/* Live Timer Counter */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="pt-2"
              >
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-mono text-white/70 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Elapsed: {elapsedSeconds.toFixed(1)}s</span>
                </span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


