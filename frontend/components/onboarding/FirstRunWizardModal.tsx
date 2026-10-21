import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  FolderPlus,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  Palette,
  Sparkles,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  LayoutGrid,
  Search,
  ScanFace,
  Wand2,
  ScanText,
  Type,
  Rocket,
  Sliders,
  ShieldCheck,
  MessageSquare,
  Layers,
} from 'lucide-react';
import { API_BASE } from '../../constants';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type ColorTheme = 'dark' | 'light' | 'system';
type AccentTone = 'gold' | 'gray' | 'emerald' | 'indigo';
type InterfaceDensity = 'compact' | 'standard' | 'spacious';
type ThumbnailQuality = '320px' | '640px' | '1280px';

/** AI flags stored in the backend general settings, keyed by our friendly toggle ids. */
const AI_FLAGS: Record<AiFeatureId, string> = {
  smartSearch: 'ENABLE_AI_CLIP',
  people: 'ENABLE_AI_FACE',
  magicEraser: 'ENABLE_AI_INPAINTING',
  readText: 'ENABLE_AI_OCR',
  captions: 'ENABLE_AI_CAPTION',
  autoOrganize: 'ENABLE_IMAGE_BG_PROCESS',
  chatAssistant: 'ENABLE_AI_AGENT',
};

type AiFeatureId = keyof typeof AI_FEATURE_META;

const AI_FEATURE_META: Record<
  string,
  { title: string; description: string; icon: React.ReactNode }
> = {
  smartSearch: {
    title: 'Smart Search',
    description: 'Find photos by describing them in plain words',
    icon: <Search size={16} />,
  },
  people: {
    title: 'People & Faces',
    description: 'Automatically group photos of the same people',
    icon: <ScanFace size={16} />,
  },
  magicEraser: {
    title: 'Magic Eraser & Video AI',
    description: 'Remove unwanted objects and polish videos with AI',
    icon: <Wand2 size={16} />,
  },
  readText: {
    title: 'Read Text in Photos',
    description: 'Search words inside screenshots, receipts, and documents',
    icon: <ScanText size={16} />,
  },
  captions: {
    title: 'Auto Captions',
    description: 'Generate short descriptions for every photo',
    icon: <Type size={16} />,
  },
  autoOrganize: {
    title: 'Organize New Photos',
    description: 'Sort and tag new photos in the background as you add them',
    icon: <Layers size={16} />,
  },
  chatAssistant: {
    title: 'AI Chat Assistant',
    description: 'Ask questions about your library in the chat panel',
    icon: <MessageSquare size={16} />,
  },
};

const THEME_OPTIONS: { value: ColorTheme; label: string; icon: React.ReactNode }[] = [
  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
  { value: 'system', label: 'System', icon: <Monitor size={16} /> },
];

const ACCENT_OPTIONS: { value: AccentTone; label: string; swatch: string }[] = [
  { value: 'gold', label: 'Gold', swatch: '#e5a93c' },
  { value: 'gray', label: 'Graphite', swatch: '#a8a29e' },
  { value: 'emerald', label: 'Emerald', swatch: '#34d399' },
  { value: 'indigo', label: 'Indigo', swatch: '#818cf8' },
];

const DENSITY_OPTIONS: { value: InterfaceDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'spacious', label: 'Spacious' },
];

const QUALITY_OPTIONS: { value: ThumbnailQuality; label: string; hint: string }[] = [
  { value: '320px', label: 'Fast', hint: 'Smaller previews' },
  { value: '640px', label: 'Balanced', hint: 'Recommended' },
  { value: '1280px', label: 'High', hint: 'Sharpest previews' },
];

const DEFAULT_AI: Record<AiFeatureId, boolean> = {
  smartSearch: true,
  people: true,
  magicEraser: true,
  readText: true,
  captions: false,
  autoOrganize: true,
  chatAssistant: true,
};

export type ExecutionTopology = 'this_device' | 'vault';
export type StorageStrategy = 'index_in_place' | 'copy';
export type NeuralProfile = 'balanced' | 'master' | 'minimalist';

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onComplete,
}) => {
  // Step state (1: Your Photos, 2: Look & Feel, 3: AI Features, 4: Ready)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — Folders to watch
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);

  // Step 2 — Look & feel
  const [theme, setTheme] = useState<ColorTheme>('dark');
  const [accent, setAccent] = useState<AccentTone>('gray');
  const [density, setDensity] = useState<InterfaceDensity>('standard');
  const [previewQuality, setPreviewQuality] = useState<ThumbnailQuality>('640px');

  // Step 3 — Smart features
  const [aiFeatures, setAiFeatures] = useState<Record<AiFeatureId, boolean>>({ ...DEFAULT_AI });

  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  const toggleAi = (id: AiFeatureId) =>
    setAiFeatures((prev) => ({ ...prev, [id]: !prev[id] }));

  const enabledAiCount = Object.values(aiFeatures).filter(Boolean).length;

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Add folders to the watch list
  const handleAddFolders = async () => {
    try {
      const res = await openFileFolderBrowser({
        directoryOnly: true,
        multiple: true,
        title: 'Choose folders for Prism to watch',
      });
      if (res && res.paths.length > 0) {
        setWatchedFolders((prev) => {
          const next = [...prev];
          res.paths.forEach((p) => {
            if (!next.includes(p)) next.push(p);
          });
          return next;
        });
      }
    } catch {
      const custom = window.prompt('Enter a folder path for Prism to watch:');
      if (custom && !watchedFolders.includes(custom)) {
        setWatchedFolders((prev) => [...prev, custom]);
      }
    }
  };

  const handleRemoveFolder = (folder: string) =>
    setWatchedFolders((prev) => prev.filter((f) => f !== folder));

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      // Appearance preferences (read by the Settings → Appearance panel)
      localStorage.setItem('prism_onboarding_completed', 'true');
      localStorage.setItem('prism_theme', theme);
      localStorage.setItem('prism_accent', accent);
      localStorage.setItem('prism_density', density);
      localStorage.setItem('prism_preview_quality', previewQuality);

      // 1) Persist the folder watch list
      await fetch(`${API_BASE}/api/v1/settings/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched_folders: watchedFolders, excluded_folders: [] }),
      }).catch(() => {});

      // 2) Persist the smart-feature toggles (merge into existing general settings)
      try {
        const current = await fetch(`${API_BASE}/api/v1/settings/general`)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
        const merged: Record<string, unknown> = { ...current };
        (Object.keys(AI_FLAGS) as AiFeatureId[]).forEach((id) => {
          merged[AI_FLAGS[id]] = aiFeatures[id];
        });
        await fetch(`${API_BASE}/api/v1/settings/general`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        }).catch(() => {});
      } catch {
        /* non-fatal */
      }

      // 3) Notify the backend that onboarding finished
      const thumbQuality =
        previewQuality === '1280px' ? 'quality' : previewQuality === '320px' ? 'fast' : 'balanced';
      const aiProfile =
        enabledAiCount === 0 ? 'minimalist' : aiFeatures.captions ? 'master' : 'balanced';

      await fetch(`${API_BASE}/api/v1/settings/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_mode: 'index_in_place',
          ai_profile: aiProfile,
          preset: 'balanced',
          thumb_quality: thumbQuality,
          completed: true,
        }),
      }).catch(() => {});
    } finally {
      setIsFinishing(false);
      onComplete();
    }
  };

  if (!isOpen) return null;

  const stepTitles: Record<1 | 2 | 3 | 4, { title: string; subtitle: string; label: string }> = {
    1: { title: '1. Your Photos', subtitle: 'Choose folders', label: 'Choose your photo folders' },
    2: { title: '2. Look & Feel', subtitle: 'Theme & layout', label: 'Personalize the interface' },
    3: { title: '3. Smart Features', subtitle: 'AI tools', label: 'Choose your smart features' },
    4: { title: '4. You\u2019re Ready', subtitle: 'Finish', label: 'All set' },
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
        {/* Fullscreen Backdrop & Atmospheric Glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-[#0d0b0a]/90 backdrop-blur-2xl pointer-events-auto"
        >
          <div className="absolute -top-32 left-1/4 w-[36rem] h-[36rem] rounded-full bg-[#2c2928]/40 blur-[130px] pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-[32rem] h-[32rem] rounded-full bg-[#373433]/30 blur-[140px] pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-[40rem] h-[28rem] rounded-full bg-[#100e0d]/80 blur-[100px] pointer-events-none" />
        </motion.div>

        {/* Top Fixed App Bar */}
        <header className="fixed top-0 inset-x-0 h-16 z-30 flex items-center justify-between px-6 sm:px-10 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-[#e5e2e0] shadow-[0_0_12px_rgba(229,226,224,0.5)]"></span>
            <span className="font-serif text-lg text-[#e7e1df] tracking-wide">Prism</span>
            <span className="font-mono text-[10px] text-[#a8a29e] px-2 py-0.5 rounded-full bg-[#2c2928] border border-white/5">
              SETUP
            </span>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
            <span className="font-mono text-xs text-[#a8a29e] hidden sm:inline">Welcome</span>
            <div className="w-8 h-8 rounded-full bg-[#2c2928] border border-white/5 flex items-center justify-center text-[#d0c4be]">
              <Palette size={16} />
            </div>
          </div>
        </header>

        {/* Main Desktop Window Dialog Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-[820px] max-h-[86vh] flex flex-col bg-[#100e0d] border border-[#2c2928] rounded-2xl shadow-2xl overflow-hidden font-sans text-[#e7e1df]"
        >
          {/* Window Titlebar (Clean Header) */}
          <div className="w-full h-12 bg-[#1d1b1a] border-b border-[#2c2928] px-4 sm:px-6 flex items-center justify-between shrink-0">
            {/* Titlebar Left */}
            <div className="flex items-center gap-2.5">
              <Sliders size={14} className="text-[#a8a29e]" />
              <span className="font-mono text-[11px] text-[#a8a29e] tracking-wider">
                Prism Setup
              </span>
            </div>

            {/* Right System Indicators & Close Action */}
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] text-[#a8a29e] px-2.5 py-0.5 rounded-full bg-[#2c2928] border border-white/5">
                Getting Started
              </span>
              <button
                type="button"
                onClick={handleFinish}
                aria-label="Skip setup"
                className="w-7 h-7 rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#a8a29e] hover:text-white flex items-center justify-center transition-colors border border-white/5 ml-1"
                title="Skip & Launch"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Header Studio Intro */}
          <div className="px-6 sm:px-8 pt-5 pb-4 bg-[#100e0d] border-b border-[#211f1e] shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">
                  Welcome
                </span>
                <span className="text-[#4d4541] text-[10px]">•</span>
                <span className="font-mono text-[10px] text-[#c9c6c4]">
                  A few quick questions
                </span>
              </div>
              <h1 className="font-serif text-xl sm:text-2xl text-[#f5f0ed] tracking-tight">
                Welcome to Prism
              </h1>
              <p className="text-xs text-[#a8a29e] max-w-2xl font-light leading-relaxed">
                Tell us where your photos live and how you like things to look. You can change any of
                this later in Settings.
              </p>
            </div>

            {/* Horizontal 4-Step Progress Line */}
            <div className="relative mt-6">
              {/* Base track (connects first and last point centers) */}
              <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-px bg-white/10" />
              {/* Completed progress fill */}
              <div
                className="absolute top-2.5 left-[12.5%] h-px bg-[#e5e2e0] transition-all duration-300"
                style={{ width: `${((currentStep - 1) / 3) * 75}%` }}
              />

              <div className="relative grid grid-cols-4">
                {[1, 2, 3, 4].map((stepNum) => {
                  const s = stepNum as 1 | 2 | 3 | 4;
                  const isActive = currentStep === s;
                  const isCompleted = currentStep > s;
                  const meta = stepTitles[s];

                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCurrentStep(s)}
                      className="group flex flex-col items-center text-center gap-2 focus:outline-none"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-[#151312] ring-4 ring-white/10'
                          : isCompleted
                          ? 'bg-[#e5e2e0] text-[#151312]'
                          : 'bg-[#1d1b1a] text-[#a8a29e] border border-white/15 group-hover:border-white/30'
                      }`}>
                        {isCompleted ? <Check size={12} strokeWidth={3} /> : s}
                      </span>
                      <span className="flex flex-col min-w-0 px-1">
                        <span className={`font-mono text-[11px] truncate transition-colors ${
                          isActive
                            ? 'font-semibold text-white'
                            : isCompleted
                            ? 'text-[#e7e1df]'
                            : 'text-[#78716c] group-hover:text-[#a8a29e]'
                        }`}>
                          {meta.title}
                        </span>
                        <span className="hidden sm:block font-mono text-[10px] text-[#5c5550] truncate">
                          {meta.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Wizard Body Area (PAGE SYSTEM: Only render active step configuration) */}
          <div className="px-6 sm:px-8 py-5 overflow-y-auto flex-1 custom-scrollbar min-h-[300px] flex flex-col justify-center">
            <AnimatePresence mode="wait">

              {/* ═══════════ STEP 1: YOUR PHOTOS ═══════════ */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={15} className="text-[#998f8a]" />
                      <h2 className="font-serif text-base text-[#f5f0ed]">
                        Where are your photos?
                      </h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#e5e2e0] bg-[#2c2928] px-2.5 py-0.5 rounded-full border border-white/5">
                      {watchedFolders.length} folder{watchedFolders.length === 1 ? '' : 's'} added
                    </span>
                  </div>

                  <p className="text-xs text-[#a8a29e] leading-relaxed">
                    Add the folders you would like Prism to watch. Your originals stay exactly where
                    they are — new photos added to these folders appear automatically.
                  </p>

                  {/* Folder list */}
                  {watchedFolders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-white/10 bg-[#1d1b1a]/60 text-center">
                      <FolderPlus size={22} className="text-[#5c5550]" />
                      <span className="text-xs text-[#78716c]">No folders added yet</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[190px] overflow-y-auto custom-scrollbar pr-1">
                      {watchedFolders.map((folder) => (
                        <div
                          key={folder}
                          className="flex items-center justify-between gap-3 bg-[#1d1b1a] border border-white/5 px-3 py-2.5 rounded-xl"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FolderOpen size={15} className="text-[#998f8a] shrink-0" />
                            <span className="font-mono text-xs text-[#e7e1df] truncate" title={folder}>
                              {folder}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFolder(folder)}
                            aria-label={`Remove ${folder}`}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#f87171] hover:bg-[#f87171]/10 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddFolders}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] font-mono text-xs transition-colors flex items-center justify-center gap-2 border border-white/10"
                  >
                    <FolderPlus size={14} />
                    Add folders
                  </button>
                </motion.div>
              )}

              {/* ═══════════ STEP 2: LOOK & FEEL ═══════════ */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette size={15} className="text-[#998f8a]" />
                      <h2 className="font-serif text-base text-[#f5f0ed]">Make it yours</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#998f8a]">Appearance</span>
                  </div>

                  {/* Theme */}
                  <div className="space-y-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e]">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {THEME_OPTIONS.map((opt) => {
                        const active = theme === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTheme(opt.value)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${
                              active
                                ? 'bg-[#2c2928] border-white/25 text-[#f5f0ed] shadow-sm'
                                : 'bg-[#1d1b1a] border-white/5 text-[#998f8a] hover:text-[#e7e1df] hover:border-white/10'
                            }`}
                          >
                            {opt.icon}
                            <span className="font-mono text-xs">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accent */}
                  <div className="space-y-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e]">
                      Accent color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {ACCENT_OPTIONS.map((opt) => {
                        const active = accent === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAccent(opt.value)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
                              active
                                ? 'bg-[#2c2928] border-white/25 text-[#f5f0ed]'
                                : 'bg-[#1d1b1a] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt.swatch }}
                            />
                            <span className="font-mono text-[11px] truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Density */}
                  <div className="space-y-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e] flex items-center gap-1.5">
                      <LayoutGrid size={12} /> Grid density
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {DENSITY_OPTIONS.map((opt) => {
                        const active = density === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDensity(opt.value)}
                            className={`py-2 rounded-xl border font-mono text-xs transition-all ${
                              active
                                ? 'bg-[#2c2928] border-white/25 text-[#f5f0ed] shadow-sm'
                                : 'bg-[#1d1b1a] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photo quality */}
                  <div className="space-y-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e]">
                      Photo preview quality
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {QUALITY_OPTIONS.map((opt) => {
                        const active = previewQuality === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPreviewQuality(opt.value)}
                            className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border transition-all text-left ${
                              active
                                ? 'bg-[#2c2928] border-white/25 text-[#f5f0ed] shadow-sm'
                                : 'bg-[#1d1b1a] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                            }`}
                          >
                            <span className="font-mono text-xs font-semibold">{opt.label}</span>
                            <span className="font-mono text-[10px] text-[#78716c]">{opt.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ STEP 3: SMART FEATURES ═══════════ */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-[#998f8a]" />
                      <h2 className="font-serif text-base text-[#f5f0ed]">Smart features</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#998f8a]">
                      {enabledAiCount} of {Object.keys(AI_FEATURE_META).length} on
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-[#1d1b1a] border border-white/5 px-3.5 py-2.5 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-[11px] text-[#a8a29e] leading-tight">
                        Everything runs on this device — nothing is uploaded.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAiFeatures({ ...DEFAULT_AI })}
                        className="px-2.5 py-1 rounded-full font-mono text-[10px] bg-[#2c2928] text-[#e7e1df] hover:bg-[#373433] border border-white/10 transition-colors"
                      >
                        Recommended
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAiFeatures(
                            Object.fromEntries(
                              Object.keys(AI_FEATURE_META).map((k) => [k, false]),
                            ) as Record<AiFeatureId, boolean>,
                          )
                        }
                        className="px-2.5 py-1 rounded-full font-mono text-[10px] text-[#998f8a] hover:text-[#f5f0ed] transition-colors"
                      >
                        Turn all off
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[230px] overflow-y-auto custom-scrollbar pr-1">
                    {(Object.keys(AI_FEATURE_META) as AiFeatureId[]).map((id) => {
                      const meta = AI_FEATURE_META[id];
                      const on = aiFeatures[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => toggleAi(id)}
                          className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                            on
                              ? 'bg-[#211f1e] border-white/15'
                              : 'bg-[#1d1b1a] border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              on ? 'bg-[#373433] text-[#f5f0ed]' : 'bg-[#100e0d] text-[#78716c]'
                            }`}>
                              {meta.icon}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-xs font-medium ${on ? 'text-[#f5f0ed]' : 'text-[#a8a29e]'}`}>
                                {meta.title}
                              </span>
                              <span className="text-[11px] text-[#78716c] truncate">
                                {meta.description}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                              on ? 'bg-[#e5e2e0]' : 'bg-[#373433]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                                on ? 'translate-x-4 bg-[#100e0d]' : 'bg-[#a8a29e]'
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ═══════════ STEP 4: READY ═══════════ */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-12 h-12 rounded-full bg-[#e5e2e0] text-[#151312] flex items-center justify-center">
                      <Rocket size={22} />
                    </div>
                    <div>
                      <h2 className="font-serif text-lg text-[#f5f0ed]">You&apos;re all set</h2>
                      <p className="text-xs text-[#a8a29e] mt-1 max-w-md mx-auto leading-relaxed">
                        Prism is ready to go. Here is a quick summary of your choices — you can change
                        any of them later in Settings.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-[#1d1b1a] border border-white/5 px-3.5 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <FolderOpen size={15} className="text-[#998f8a]" />
                        <span className="text-xs text-[#e7e1df]">Folders to watch</span>
                      </div>
                      <span className="font-mono text-xs text-[#c9c6c4]">
                        {watchedFolders.length === 0 ? 'None yet' : `${watchedFolders.length} added`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1d1b1a] border border-white/5 px-3.5 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Palette size={15} className="text-[#998f8a]" />
                        <span className="text-xs text-[#e7e1df]">Appearance</span>
                      </div>
                      <span className="font-mono text-xs text-[#c9c6c4] capitalize">
                        {theme} · {accent} · {previewQuality}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1d1b1a] border border-white/5 px-3.5 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Sparkles size={15} className="text-[#998f8a]" />
                        <span className="text-xs text-[#e7e1df]">Smart features</span>
                      </div>
                      <span className="font-mono text-xs text-[#c9c6c4]">
                        {enabledAiCount} enabled
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1d1b1a] border border-white/5 px-3.5 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={15} className="text-emerald-400" />
                        <span className="text-xs text-[#e7e1df]">Privacy</span>
                      </div>
                      <span className="font-mono text-xs text-[#c9c6c4]">On-device only</span>
                    </div>
                  </div>

                  {watchedFolders.length === 0 && (
                    <p className="text-[11px] text-[#78716c] flex items-center gap-1.5 justify-center">
                      <CheckCircle2 size={13} className="text-[#998f8a]" />
                      No folders yet — you can add them anytime from Settings.
                    </p>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer Control Navigation Bar */}
          <div className="w-full bg-[#1d1b1a] border-t border-[#2c2928] px-6 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 select-none shrink-0">
            {/* Back and Cancel */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={handleFinish}
                className="font-mono text-xs text-[#998f8a] hover:text-[#f5f0ed] transition-colors"
              >
                Skip setup
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
                disabled={currentStep === 1}
                className="px-3.5 py-1.5 rounded-full bg-[#2c2928] text-[#f5f0ed] hover:bg-[#373433] disabled:opacity-30 font-mono text-xs transition-colors flex items-center gap-1.5 border border-white/5"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            </div>

            {/* Center Step Counter */}
            <div className="hidden md:flex items-center gap-2 text-[#a8a29e] font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5e2e0]"></span>
              <span>
                Step {currentStep} of 4 • {stepTitles[currentStep].label}
              </span>
            </div>

            {/* Forward Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => ((s + 1) as 1 | 2 | 3 | 4))}
                  className="px-5 py-2 rounded-full bg-[#e5e2e0] text-[#1c1b1a] hover:bg-white font-mono text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isFinishing}
                  className="px-6 py-2 rounded-full bg-[#e5e2e0] text-[#1c1b1a] hover:bg-white font-mono text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <span>{isFinishing ? 'Setting things up…' : 'Start using Prism'}</span>
                  <Rocket size={14} />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fixed Bottom Statusline */}
        <div className="fixed bottom-0 inset-x-0 h-10 z-20 flex items-center justify-between px-6 sm:px-10 text-[#78716c] font-mono text-[11px] pointer-events-none">
          <span className="pointer-events-auto">Private by design • Your photos never leave this device</span>
          <span className="pointer-events-auto">Esc to skip</span>
        </div>
      </div>
    </AnimatePresence>
  );
};
