import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderSync, 
  Copy, 
  Cpu, 
  Sparkles, 
  HardDrive, 
  ShieldCheck, 
  ArrowRight, 
  Check, 
  Layers,
  Camera
} from 'lucide-react';
import { API_BASE } from '@/constants';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type StorageMode = 'index_in_place' | 'copy';
type AiProfile = 'fast' | 'studio';

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [storageMode, setStorageMode] = useState<StorageMode>('index_in_place');
  const [aiProfile, setAiProfile] = useState<AiProfile>('fast');
  const [estimatedPhotos, setEstimatedPhotos] = useState<number>(5000);
  const [isFinishing, setIsFinishing] = useState(false);

  const estThumbSizeMb = Math.round((estimatedPhotos * 150) / 1024);
  const estIndexSizeMb = Math.round((estimatedPhotos * 15) / 1024);
  const totalAllocMb = estThumbSizeMb + estIndexSizeMb;

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      localStorage.setItem('prism_onboarding_completed', 'true');
      localStorage.setItem('prism_storage_mode', storageMode);
      localStorage.setItem('prism_ai_profile', aiProfile);

      await fetch(`${API_BASE}/api/v1/settings/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_mode: storageMode,
          ai_profile: aiProfile,
          completed: true,
        }),
      }).catch(() => {});
    } finally {
      setIsFinishing(false);
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-xl bg-[#14171D] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 overflow-hidden"
          >
            {/* Ambient backdrop glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Stepper Pills */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                  <Camera size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">Welcome to Prism</h2>
                  <p className="text-xs text-gray-400">Personalize your local-first experience</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      step === s ? 'w-6 bg-primary' : step > s ? 'w-2 bg-emerald-500' : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step 1: Storage Choice */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">How should Prism handle your photos?</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Choose how original media is managed on your storage drive.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button
                    onClick={() => setStorageMode('index_in_place')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      storageMode === 'index_in_place'
                        ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/5 text-primary">
                          <FolderSync size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">Index in Place</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                              Recommended
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            Leaves your original files and folder structure completely untouched. Prism generates thumbnails and indexes non-destructively.
                          </p>
                        </div>
                      </div>
                      {storageMode === 'index_in_place' && <Check size={18} className="text-primary mt-1 shrink-0" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setStorageMode('copy')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      storageMode === 'copy'
                        ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/5 text-amber-400">
                          <Copy size={20} />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-white">Copy into Managed Library</span>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            Copies imported photos into Prism's dedicated internal storage directory. Best for users creating an isolated archive.
                          </p>
                        </div>
                      </div>
                      {storageMode === 'copy' && <Check size={18} className="text-primary mt-1 shrink-0" />}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Storage Estimator */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Estimated Storage Footprint</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Prism caches high-speed thumbnails and AI vectors locally for instant offline performance.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>Approximate photo collection size:</span>
                    <span className="font-mono text-white font-bold">{estimatedPhotos.toLocaleString()} photos</span>
                  </div>

                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="1000"
                    value={estimatedPhotos}
                    onChange={(e) => setEstimatedPhotos(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Thumbnails</span>
                      <span className="text-sm font-mono font-bold text-primary">{estThumbSizeMb} MB</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">AI Vectors</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">{estIndexSizeMb} MB</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total Cache</span>
                      <span className="text-sm font-mono font-bold text-white">{totalAllocMb} MB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <ShieldCheck size={16} className="shrink-0" />
                  <span>Your original raw and jpeg files never undergo lossy compression.</span>
                </div>
              </div>
            )}

            {/* Step 3: AI Engine Profile */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Select AI Engine Profile</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure background intelligence models to match your device capabilities.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setAiProfile('fast')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      aiProfile === 'fast'
                        ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu size={18} className="text-primary" />
                      <span className="text-sm font-bold text-white">Fast & Balanced</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      SigLIP semantic search only. Lightweight (~350 MB), ultra-low battery drain, perfect for laptops.
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-primary font-semibold">
                      RAM: ~500 MB
                    </div>
                  </button>

                  <button
                    onClick={() => setAiProfile('studio')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      aiProfile === 'studio'
                        ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={18} className="text-amber-400" />
                      <span className="text-sm font-bold text-white">Studio Studio AI</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      SigLIP + Face ID clustering + Rapid OCR text search + Smart Segmentation (~1.8 GB).
                    </p>
                    <div className="mt-3 text-[10px] font-mono text-amber-400 font-semibold">
                      RAM: ~2.1 GB
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/10">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => (s - 1) as any)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as any)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={isFinishing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-colors disabled:opacity-50"
                >
                  <span>{isFinishing ? 'Configuring...' : 'Launch Prism'}</span>
                  <Check size={14} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
