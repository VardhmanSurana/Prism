/**
 * InpaintTutorial.tsx
 * Interactive tutorial/help overlay for inpainting features.
 */

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  image?: string;
  tips?: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Inpainting',
    description: 'Remove, replace, or extend any part of your images using AI-powered tools. This tutorial will guide you through the basics.',
    tips: [
      'Works best on well-lit, high-resolution images',
      'Results may vary based on selected AI model',
      'Experiment with different tools for best results',
    ],
  },
  {
    title: 'Brush Tool',
    description: 'Paint over areas you want to modify. Use the brush to manually select regions for inpainting.',
    tips: [
      'Adjust brush size with slider or [ and ] keys',
      'Hold Shift and click to draw straight lines',
      'Use softer brushes for better edge blending',
    ],
  },
  {
    title: 'Eraser Tool',
    description: 'Remove parts of your mask to refine the selection. Perfect for fixing mistakes or adjusting boundaries.',
    tips: [
      'Same controls as brush tool',
      'Use smaller eraser for precise corrections',
      'Switch between brush and eraser quickly',
    ],
  },
  {
    title: 'Interactive Selection',
    description: 'Click on objects to automatically select them. Left-click to add, right-click to subtract from selection.',
    tips: [
      'Click multiple times to refine selection',
      'Works best on objects with clear edges',
      'Combine with brush for final touch-ups',
    ],
  },
  {
    title: 'Auto Detect',
    description: 'Let AI automatically find objects in your image. Click on detected objects to select them for editing.',
    tips: [
      'Detects common objects automatically',
      'Click bounding boxes to create masks',
      'Adjust detection sensitivity if needed',
    ],
  },
  {
    title: 'Remove Operation',
    description: 'Erase unwanted objects from your photos. The AI fills in the removed area naturally.',
    tips: [
      'LaMa model: Fast, good for simple removals',
      'MAT model: Slower, best quality results',
      'Paint over entire object for best results',
    ],
  },
  {
    title: 'Replace Operation',
    description: 'Replace selected areas with AI-generated content using text prompts.',
    tips: [
      'Requires Stable Diffusion models',
      'Write detailed prompts for better results',
      'Adjust guidance scale for prompt strength',
    ],
  },
  {
    title: 'Outpainting',
    description: 'Extend your image beyond its borders. Perfect for creating wider compositions or filling in cropped edges.',
    tips: [
      'Specify expansion size in pixels',
      'Use prompts to guide generated content',
      'Works best with SD models',
    ],
  },
  {
    title: 'Model Selection',
    description: 'Choose the right AI model for your task. Each model has different strengths and speed.',
    tips: [
      'LaMa: Fast object removal (3-5s)',
      'MAT: High-quality removal (10-15s)',
      'SD 1.5: Creative generation (20-30s)',
      'SDXL: Best quality generation (30-60s)',
    ],
  },
  {
    title: 'Tips & Tricks',
    description: "You're ready to start! Here are some pro tips to get the best results.",
    tips: [
      'Save your work frequently',
      'Use Undo/Redo if results aren\'t perfect',
      'Try different models for comparison',
      'Adjust mask edges for smoother blending',
      'Be patient - good results take time',
    ],
  },
];

interface InpaintTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InpaintTutorial: React.FC<InpaintTutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep(prev => prev - 1);
  };

  const handleSkip = () => {
    setCurrentStep(TUTORIAL_STEPS.length - 1);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Inpainting Tutorial</h2>
              <p className="text-xs text-white/50">
                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/60 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
          <p className="text-sm text-white/70 leading-relaxed mb-6">{step.description}</p>

          {step.tips && step.tips.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
                {isLast ? 'Pro Tips' : 'Tips'}
              </p>
              <ul className="space-y-2">
                {step.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isFirst
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                Skip
              </button>
            )}

            <button
              onClick={isLast ? onClose : handleNext}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-primary text-black hover:bg-primary/90 transition-all"
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
