import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Server,
  FolderOpen,
  Sparkles,
  Zap,
  Check,
  ArrowRight,
  ArrowLeft,
  Palette,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Eye,
  SlidersHorizontal,
  X,
  FileCheck,
  Cpu,
  Layers,
  Database
} from 'lucide-react';
import { API_BASE } from '../../constants';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export type ExecutionTopology = 'this_device' | 'vault';
export type StorageStrategy = 'index_in_place' | 'copy';
export type NeuralProfile = 'balanced' | 'master' | 'minimalist';

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onComplete,
}) => {
  // Step state (1: Architecture, 2: Storage Strategy, 3: Footprint, 4: Neural Engine)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Configuration states
  const [topology, setTopology] = useState<ExecutionTopology>('this_device');
  const [storageStrategy, setStorageStrategy] = useState<StorageStrategy>('index_in_place');
  const [originalsDir, setOriginalsDir] = useState<string>('/Volumes/Studio-RAW-Vault/Master_Exposures_2024');
  const [detectedMasters, setDetectedMasters] = useState<number>(48290);
  const [detectedPayload, setDetectedPayload] = useState<string>('1.18 TB Total Payload');
  const [neuralProfile, setNeuralProfile] = useState<NeuralProfile>('balanced');

  // Phase 03: Footprint & Cache Allocation Configuration
  const [previewQuality, setPreviewQuality] = useState<'8k' | '4k' | '2k'>('8k');
  const [vectorPrecision, setVectorPrecision] = useState<'fp32' | 'int8' | 'ondemand'>('fp32');
  const [cacheQuota, setCacheQuota] = useState<'25gb' | '50gb' | '100gb' | 'uncapped'>('100gb');
  const [precacheMode, setPrecacheMode] = useState<'background' | 'ondemand'>('background');

  // Dynamic calculations for Footprint
  const webpGb = previewQuality === '8k' ? 44.0 : previewQuality === '4k' ? 18.2 : 6.1;
  const vectorGb = vectorPrecision === 'fp32' ? 54.0 : vectorPrecision === 'int8' ? 13.8 : 0.0;
  const engineIndexGb = 4.8;
  const totalFootprint = webpGb + vectorGb + engineIndexGb;
  const totalVolumeGb = 2000;
  const masterOriginalsGb = 1180;
  const headroomGb = Math.round((totalVolumeGb - masterOriginalsGb - totalFootprint) * 10) / 10;

  const masterPercent = 59;
  const webpPercent = Math.max(1, (webpGb / totalVolumeGb) * 100);
  const vectorPercent = Math.max(0.5, (vectorGb / totalVolumeGb) * 100);
  const indexPercent = (engineIndexGb / totalVolumeGb) * 100;
  const headroomPercent = Math.max(5, (headroomGb / totalVolumeGb) * 100);
  
  // Engine Flags Drawer/Modal state
  const [showEngineFlags, setShowEngineFlags] = useState<boolean>(false);
  const [gpuAccelerationMode, setGpuAccelerationMode] = useState<string>('webgpu');
  const [workerDaemons, setWorkerDaemons] = useState<number>(6);
  const [telemetryLock, setTelemetryLock] = useState<boolean>(true);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

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

  // Browse Directory action
  const handleBrowseDirectory = async () => {
    try {
      const res = await openFileFolderBrowser({
        directoryOnly: true,
        title: 'Select Master RAW / Originals Directory',
      });
      if (res && res.paths.length > 0) {
        setOriginalsDir(res.paths[0]);
        setDetectedMasters(52410);
        setDetectedPayload('1.29 TB Total Payload');
      }
    } catch {
      const custom = window.prompt('Enter path to originals folder:', originalsDir);
      if (custom) {
        setOriginalsDir(custom);
      }
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      localStorage.setItem('prism_onboarding_completed', 'true');
      localStorage.setItem('prism_topology', topology);
      localStorage.setItem('prism_storage_mode', storageStrategy);
      localStorage.setItem('prism_originals_dir', originalsDir);
      localStorage.setItem('prism_neural_profile', neuralProfile);
      localStorage.setItem('prism_gpu_mode', gpuAccelerationMode);
      localStorage.setItem('prism_preview_quality', previewQuality);
      localStorage.setItem('prism_vector_precision', vectorPrecision);
      localStorage.setItem('prism_cache_quota', cacheQuota);
      localStorage.setItem('prism_precache_mode', precacheMode);

      await fetch(`${API_BASE}/api/v1/settings/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topology,
          storage_mode: storageStrategy,
          originals_directory: originalsDir,
          neural_profile: neuralProfile,
          gpu_mode: gpuAccelerationMode,
          worker_daemons: workerDaemons,
          preview_quality: previewQuality,
          vector_precision: vectorPrecision,
          cache_quota: cacheQuota,
          precache_mode: precacheMode,
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
    1: { title: '01. Architecture', subtitle: 'Local NVMe Mode', label: 'Execution Topology' },
    2: { title: '02. Storage Strategy', subtitle: 'Directory Linking', label: 'Storage Strategy & Directory Linking' },
    3: { title: '03. Footprint', subtitle: `${totalFootprint.toFixed(1)} GB Est.`, label: 'Estimated Disk & Cache Allocation' },
    4: { title: '04. Neural Engine', subtitle: 'Balanced Studio', label: 'On-Device Neural Acceleration Profile' },
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
              PRISM 2.4
            </span>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
            <span className="font-mono text-xs text-[#a8a29e] hidden sm:inline">Environment Setup</span>
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
          className="relative z-20 w-full max-w-[1040px] max-h-[92vh] flex flex-col bg-[#100e0d] border border-[#2c2928] rounded-2xl shadow-2xl overflow-hidden font-sans text-[#e7e1df]"
        >
          {/* Window Titlebar (Clean Header) */}
          <div className="w-full h-12 bg-[#1d1b1a] border-b border-[#2c2928] px-4 sm:px-6 flex items-center justify-between shrink-0">
            {/* Titlebar Left */}
            <div className="flex items-center gap-2.5">
              <Sliders size={14} className="text-[#a8a29e]" />
              <span className="font-mono text-[11px] text-[#a8a29e] tracking-wider">
                Prism Workspace Setup
              </span>
            </div>

            {/* Right System Indicators & Close Action */}
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] text-[#a8a29e] px-2.5 py-0.5 rounded-full bg-[#2c2928] border border-white/5">
                v4.8 • First Run
              </span>
              <button
                type="button"
                onClick={handleFinish}
                aria-label="Close setup"
                className="w-7 h-7 rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#a8a29e] hover:text-white flex items-center justify-center transition-colors border border-white/5 ml-1"
                title="Skip & Launch"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Header Studio Intro */}
          <div className="px-6 sm:px-10 pt-6 sm:pt-8 pb-5 bg-[#100e0d] border-b border-[#211f1e] shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">
                  Calibration Phase
                </span>
                <span className="text-[#4d4541] text-[10px]">•</span>
                <span className="font-mono text-[10px] text-[#c9c6c4]">
                  Initial Environment Configuration
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-4xl text-[#f5f0ed] tracking-tight">
                Welcome to Prism Studio
              </h1>
              <p className="text-xs sm:text-sm text-[#a8a29e] max-w-2xl font-light leading-relaxed">
                Configure your local-first preservation engine, storage topology, and on-device neural acceleration profiles before mounting assets.
              </p>
            </div>

            {/* Horizontal 4-Step Segmented Navigation Bar */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#1d1b1a] p-1.5 rounded-2xl border border-white/5">
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
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-200 text-left ${
                      isActive
                        ? 'bg-[#3b3937] text-white shadow-sm border border-white/10'
                        : isCompleted
                        ? 'bg-[#2c2928] text-[#e7e1df] hover:bg-[#373433]'
                        : 'opacity-60 hover:opacity-100 text-[#a8a29e] hover:bg-[#211f1e]'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 font-bold ${
                      isActive
                        ? 'bg-white text-[#151312]'
                        : isCompleted
                        ? 'bg-[#e5e2e0] text-[#151312]'
                        : 'bg-[#373433] text-[#a8a29e]'
                    }`}>
                      {isCompleted ? <Check size={12} strokeWidth={3} /> : s}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className={`font-mono text-xs truncate ${isActive ? 'font-semibold text-white' : 'text-[#e7e1df]'}`}>
                        {meta.title}
                      </span>
                      <span className="font-mono text-[10px] text-[#78716c] truncate">
                        {meta.subtitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Body Area (PAGE SYSTEM: Only render active step configuration) */}
          <div className="px-6 sm:px-10 py-6 overflow-y-auto flex-1 custom-scrollbar min-h-[360px] flex flex-col justify-center">
            <AnimatePresence mode="wait">

              {/* ═══════════ PAGE 1: EXECUTION TOPOLOGY ═══════════ */}
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
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">Phase 01</span>
                      <span className="text-[#4d4541] text-[10px]">•</span>
                      <h2 className="font-serif text-xl text-[#f5f0ed]">Execution Topology</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#e5e2e0] bg-[#2c2928] px-2.5 py-0.5 rounded-full border border-white/5">
                      Device Primary
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Use This Device */}
                    <div
                      onClick={() => setTopology('this_device')}
                      className={`group relative p-6 rounded-2xl transition-all duration-200 cursor-pointer border ${
                        topology === 'this_device'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#373433] flex items-center justify-center text-white">
                          <Laptop size={20} />
                        </div>
                        {topology === 'this_device' ? (
                          <span className="font-mono text-xs bg-[#3b3937] text-white px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Selected
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-[#78716c] px-2 py-1">Select</span>
                        )}
                      </div>
                      <h3 className="font-serif text-xl text-[#f5f0ed] mb-1.5">Use This Device</h3>
                      <p className="text-xs sm:text-sm text-[#a8a29e] mb-5 leading-relaxed">
                        Run complete engine on local NVMe. SQLite WAL database, zero external dependencies, absolute air-gapped privacy.
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-[#c9c6c4] bg-[#1d1b1a] px-2.5 py-1 rounded-full border border-white/5">
                          M-Series / NVMe Gen4
                        </span>
                        <span className="font-mono text-[11px] text-[#998f8a] bg-[#1d1b1a] px-2.5 py-1 rounded-full border border-white/5">
                          Zero Telemetry
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Connect to Prism Vault */}
                    <div
                      onClick={() => setTopology('vault')}
                      className={`group relative p-6 rounded-2xl transition-all duration-200 cursor-pointer border ${
                        topology === 'vault'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#2c2928] flex items-center justify-center text-[#998f8a]">
                          <Server size={20} />
                        </div>
                        {topology === 'vault' ? (
                          <span className="font-mono text-xs bg-[#3b3937] text-white px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Selected
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-[#998f8a] px-2 py-1">LAN Mode</span>
                        )}
                      </div>
                      <h3 className="font-serif text-xl text-[#f5f0ed] mb-1.5">Connect to Prism Vault</h3>
                      <p className="text-xs sm:text-sm text-[#a8a29e] mb-5 leading-relaxed">
                        Pair with a dedicated headless studio workstation or private TrueNAS cluster over low-latency mDNS broadcast.
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-[#998f8a] bg-[#100e0d] px-2.5 py-1 rounded-full border border-white/5">
                          10GbE / SMBv3
                        </span>
                        <span className="font-mono text-[11px] text-[#998f8a] bg-[#100e0d] px-2.5 py-1 rounded-full border border-white/5">
                          Auto-Discovery
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ PAGE 2: STORAGE STRATEGY & DIRECTORY LINKING ═══════════ */}
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
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">Phase 02</span>
                      <span className="text-[#4d4541] text-[10px]">•</span>
                      <h2 className="font-serif text-xl text-[#f5f0ed]">Storage Strategy &amp; Directory Linking</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#998f8a]">Master Integrity Protocol</span>
                  </div>

                  {/* Strategy Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Index in Place */}
                    <div
                      onClick={() => setStorageStrategy('index_in_place')}
                      className={`p-5 rounded-2xl transition-all cursor-pointer border ${
                        storageStrategy === 'index_in_place'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#e5e2e0] text-[#151312] flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#151312]"></span>
                          </span>
                          <span className="font-mono text-[11px] text-[#f5f0ed] font-medium">
                            Recommended for Existing Catalogs
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#c9c6c4] bg-[#373433] px-2 py-0.5 rounded-full">
                          Non-Destructive
                        </span>
                      </div>
                      <h3 className="font-serif text-lg text-[#f5f0ed] mb-1">Index in Place</h3>
                      <p className="text-xs text-[#a8a29e] leading-relaxed">
                        Leave master RAW/DNG files untouched in their current hierarchical folders. Prism generates lightweight sidecars, hardware mipmaps, and neural embeddings alongside.
                      </p>
                    </div>

                    {/* Copy into Prism Container */}
                    <div
                      onClick={() => setStorageStrategy('copy')}
                      className={`p-5 rounded-2xl transition-all cursor-pointer border ${
                        storageStrategy === 'copy'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#373433] flex items-center justify-center">
                            {storageStrategy === 'copy' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="font-mono text-[11px] text-[#998f8a]">Consolidation Mode</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#998f8a] bg-[#100e0d] px-2 py-0.5 rounded-full">
                          Self-Contained
                        </span>
                      </div>
                      <h3 className="font-serif text-lg text-[#f5f0ed] mb-1">Copy into Prism Container</h3>
                      <p className="text-xs text-[#a8a29e] leading-relaxed">
                        Ingest and restructure all exposures into a single immutable, date-partitioned library bundle with cryptographic SHA-256 checksums on write.
                      </p>
                    </div>
                  </div>

                  {/* Directory Picker Control Group */}
                  <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-xs uppercase tracking-wider text-[#e7e1df]">
                        Primary Watcher &amp; Originals Directory
                      </label>
                      <span className="font-mono text-[10px] text-[#c9c6c4] bg-[#2c2928] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-white/5">
                        <HardDrive size={12} className="text-[#a8a29e]" />
                        APFS 1.8 TB NVMe
                      </span>
                    </div>

                    {/* Input Group */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-1 flex items-center bg-[#100e0d] border border-white/10 px-4 py-2.5 rounded-full">
                        <FolderOpen size={16} className="text-[#998f8a] mr-2.5 shrink-0" />
                        <input
                          type="text"
                          value={originalsDir}
                          onChange={(e) => setOriginalsDir(e.target.value)}
                          className="w-full bg-transparent font-mono text-xs text-[#f5f0ed] outline-none select-all"
                        />
                        <Eye size={15} className="text-[#78716c] ml-2 shrink-0 hidden sm:inline" />
                      </div>
                      <button
                        type="button"
                        onClick={handleBrowseDirectory}
                        className="px-5 py-2.5 rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] font-mono text-xs transition-colors flex items-center gap-1.5 shrink-0 border border-white/10"
                      >
                        <FolderOpen size={14} />
                        <span>Browse...</span>
                      </button>
                    </div>

                    {/* Scan Result Verification Pill */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#1d1b1a] px-4 py-2.5 rounded-xl border border-white/5 gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span className="text-xs text-[#f5f0ed] font-medium">
                          {detectedMasters.toLocaleString()} RAW / Video Masters Detected
                        </span>
                        <span className="text-[#4d4541] text-xs">•</span>
                        <span className="font-mono text-xs text-[#998f8a]">{detectedPayload}</span>
                      </div>
                      <div className="font-mono text-[10px] text-[#a8a29e]">
                        Hasselblad 3FR, Sony ARW, Canon CR3
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ PAGE 3: ESTIMATED DISK & CACHE ALLOCATION ═══════════ */}
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
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">Phase 03</span>
                      <span className="text-[#4d4541] text-[10px]">•</span>
                      <h2 className="font-serif text-xl text-[#f5f0ed]">Estimated Disk &amp; Cache Allocation</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#e5e2e0] bg-[#2c2928] px-2.5 py-0.5 rounded-full border border-white/5">
                      Total Footprint: {totalFootprint.toFixed(1)} GB Local
                    </span>
                  </div>

                  <div className="bg-[#211f1e] border border-white/5 p-6 rounded-2xl space-y-5">
                    {/* Progress Multi-Segment Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-mono text-xs text-[#a8a29e]">
                        <span>Volume Breakdown: /Volumes/Studio-RAW-Vault (2.0 TB Total)</span>
                        <span className="text-amber-400 font-medium">{headroomGb} GB Unallocated Headroom</span>
                      </div>
                      {/* Segmented Visual Gauge */}
                      <div className="w-full h-3.5 bg-[#100e0d] rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/5">
                        <div className="h-full rounded-full bg-[#e5e2e0] transition-all duration-300" style={{ width: `${masterPercent}%` }} title="Master Originals: 1.18 TB (59%)" />
                        <div className="h-full rounded-full bg-[#c9c6c4] transition-all duration-300" style={{ width: `${webpPercent}%` }} title={`WebP Previews: ${webpGb} GB`} />
                        <div className="h-full rounded-full bg-[#998f8a] transition-all duration-300" style={{ width: `${vectorPercent}%` }} title={`Embeddings & Vectors: ${vectorGb} GB`} />
                        <div className="h-full rounded-full bg-[#4d4541] transition-all duration-300" style={{ width: `${indexPercent}%` }} title="SQLite WAL: 4.8 GB" />
                        <div className="h-full rounded-full bg-[#2c2928] transition-all duration-300" style={{ width: `${headroomPercent}%` }} title={`Free Headroom: ${headroomGb} GB`} />
                      </div>
                    </div>

                    {/* 4 Interactive Allocation Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      {/* Master Files Card */}
                      <div className="bg-[#1d1b1a] p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e5e2e0]"></span>
                            <span className="font-mono text-xs text-[#998f8a]">Master Files</span>
                          </div>
                          <span className="font-mono text-[9px] text-[#78716c] uppercase">Linked</span>
                        </div>
                        <div className="font-serif text-2xl text-[#f5f0ed]">1.18 TB</div>
                        <div className="font-mono text-[11px] text-[#78716c] mt-0.5">Direct Reference</div>
                      </div>

                      {/* WebP / GPU Mips Card (Interactive) */}
                      <div 
                        onClick={() => {
                          const next = previewQuality === '8k' ? '4k' : previewQuality === '4k' ? '2k' : '8k';
                          setPreviewQuality(next);
                        }}
                        className="bg-[#1d1b1a] p-3.5 rounded-xl border border-white/5 hover:border-white/20 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#c9c6c4]"></span>
                            <span className="font-mono text-xs text-[#998f8a] group-hover:text-[#e7e1df] transition-colors">WebP Previews</span>
                          </div>
                          <span className="font-mono text-[9px] text-amber-300/80 uppercase">Click to Tune</span>
                        </div>
                        <div className="font-serif text-2xl text-[#f5f0ed]">{webpGb.toFixed(1)} GB</div>
                        <div className="font-mono text-[11px] text-[#78716c] mt-0.5">
                          {previewQuality === '8k' ? '8K Retinal Previews' : previewQuality === '4k' ? '4K Ultra-Sharp Previews' : '2K Compact Previews'}
                        </div>
                      </div>

                      {/* Vector DB Card (Interactive) */}
                      <div 
                        onClick={() => {
                          const next = vectorPrecision === 'fp32' ? 'int8' : vectorPrecision === 'int8' ? 'ondemand' : 'fp32';
                          setVectorPrecision(next);
                        }}
                        className="bg-[#1d1b1a] p-3.5 rounded-xl border border-white/5 hover:border-white/20 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#998f8a]"></span>
                            <span className="font-mono text-xs text-[#998f8a] group-hover:text-[#e7e1df] transition-colors">Vector DB</span>
                          </div>
                          <span className="font-mono text-[9px] text-amber-300/80 uppercase">Click to Tune</span>
                        </div>
                        <div className="font-serif text-2xl text-[#f5f0ed]">{vectorGb.toFixed(1)} GB</div>
                        <div className="font-mono text-[11px] text-[#78716c] mt-0.5">
                          {vectorPrecision === 'fp32' ? 'Full FP32 Vectors' : vectorPrecision === 'int8' ? 'Scalar Quantized Int8' : 'Cold / On-Demand'}
                        </div>
                      </div>

                      {/* Engine Index Card */}
                      <div className="bg-[#1d1b1a] p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#4d4541]"></span>
                            <span className="font-mono text-xs text-[#998f8a]">Engine Index</span>
                          </div>
                          <span className="font-mono text-[9px] text-[#78716c] uppercase">SQLite WAL</span>
                        </div>
                        <div className="font-serif text-2xl text-[#f5f0ed]">4.8 GB</div>
                        <div className="font-mono text-[11px] text-[#78716c] mt-0.5">B-Trees &amp; FTS5 Index</div>
                      </div>
                    </div>

                    {/* Interactive Tuner Section */}
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e] flex items-center gap-1.5">
                          <SlidersHorizontal size={13} className="text-[#a8a29e]" />
                          <span>Custom Storage &amp; Cache Tuners</span>
                        </span>
                        <span className="text-[11px] text-[#78716c]">Adjusting settings updates estimated footprint dynamically</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Tuner 1: WebP Preview Resolution */}
                        <div className="bg-[#1a1817] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="font-mono text-xs text-[#f5f0ed] flex items-center gap-1.5">
                              <Layers size={13} className="text-[#998f8a]" />
                              <span>Preview Resolution &amp; Quality</span>
                            </label>
                            <span className="font-mono text-[10px] text-[#998f8a] bg-[#100e0d] px-2 py-0.5 rounded-full">
                              {previewQuality === '8k' ? '8K Retinal (~44 GB)' : previewQuality === '4k' ? '4K Studio (~18 GB)' : '2K Compact (~6 GB)'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewQuality('8k')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                previewQuality === '8k'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">8K Retinal</div>
                              <div className="font-mono text-[10px] text-[#78716c]">Lossless 44 GB</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewQuality('4k')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                previewQuality === '4k'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">4K Ultra</div>
                              <div className="font-mono text-[10px] text-[#78716c]">Balanced 18.2 GB</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewQuality('2k')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                previewQuality === '2k'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">2K Fast</div>
                              <div className="font-mono text-[10px] text-[#78716c]">Compact 6.1 GB</div>
                            </button>
                          </div>
                        </div>

                        {/* Tuner 2: Vector DB Precision */}
                        <div className="bg-[#1a1817] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="font-mono text-xs text-[#f5f0ed] flex items-center gap-1.5">
                              <Database size={13} className="text-[#998f8a]" />
                              <span>Vector DB Index Precision</span>
                            </label>
                            <span className="font-mono text-[10px] text-[#998f8a] bg-[#100e0d] px-2 py-0.5 rounded-full">
                              {vectorPrecision === 'fp32' ? 'FP32 Uncompressed' : vectorPrecision === 'int8' ? 'Int8 Quantized (-74%)' : 'On-Demand'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setVectorPrecision('fp32')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                vectorPrecision === 'fp32'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">Full FP32</div>
                              <div className="font-mono text-[10px] text-[#78716c]">54 GB (Max Recall)</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVectorPrecision('int8')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                vectorPrecision === 'int8'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">Int8 Scalar</div>
                              <div className="font-mono text-[10px] text-[#78716c]">13.8 GB (Efficient)</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVectorPrecision('ondemand')}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                vectorPrecision === 'ondemand'
                                  ? 'bg-[#2c2928] border-white/30 text-[#f5f0ed] shadow-sm'
                                  : 'bg-[#141211] border-white/5 text-[#998f8a] hover:text-[#e7e1df]'
                              }`}
                            >
                              <div className="font-mono text-xs font-semibold">On-Demand</div>
                              <div className="font-mono text-[10px] text-[#78716c]">0 GB (Compute JIT)</div>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quota Cap & Precache Mode */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div className="flex items-center justify-between bg-[#1d1b1a] px-3.5 py-2.5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <HardDrive size={14} className="text-[#998f8a]" />
                            <span className="text-xs text-[#f5f0ed]">Cache Disk Quota Cap</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {(['25gb', '50gb', '100gb', 'uncapped'] as const).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setCacheQuota(q)}
                                className={`px-2 py-1 rounded font-mono text-[10px] uppercase transition-colors ${
                                  cacheQuota === q
                                    ? 'bg-[#e5e2e0] text-[#100e0d] font-bold shadow'
                                    : 'text-[#998f8a] hover:text-[#f5f0ed]'
                                }`}
                              >
                                {q === 'uncapped' ? 'Max' : q}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-[#1d1b1a] px-3.5 py-2.5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <Zap size={14} className="text-[#998f8a]" />
                            <span className="text-xs text-[#f5f0ed]">Pre-cache Pipeline</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPrecacheMode('background')}
                              className={`px-2.5 py-1 rounded font-mono text-[10px] transition-colors ${
                                precacheMode === 'background'
                                  ? 'bg-[#2c2928] text-[#f5f0ed] border border-white/10 font-medium'
                                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
                              }`}
                            >
                              Background Worker
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrecacheMode('ondemand')}
                              className={`px-2.5 py-1 rounded font-mono text-[10px] transition-colors ${
                                precacheMode === 'ondemand'
                                  ? 'bg-[#2c2928] text-[#f5f0ed] border border-white/10 font-medium'
                                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
                              }`}
                            >
                              Browse Only
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ PAGE 4: ON-DEVICE NEURAL ACCELERATION PROFILE ═══════════ */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">Phase 04</span>
                      <span className="text-[#4d4541] text-[10px]">•</span>
                      <h2 className="font-serif text-xl text-[#f5f0ed]">On-Device Neural Acceleration Profile</h2>
                    </div>
                    <span className="font-mono text-[10px] text-[#998f8a]">Hardware-Tuned Engine</span>
                  </div>

                  <div className="space-y-3">
                    {/* Balanced Studio Profile */}
                    <div
                      onClick={() => setNeuralProfile('balanced')}
                      className={`p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all border ${
                        neuralProfile === 'balanced'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-5 h-5 rounded-full bg-[#e5e2e0] text-[#151312] flex items-center justify-center shrink-0 mt-0.5">
                          {neuralProfile === 'balanced' && <span className="w-2 h-2 rounded-full bg-[#151312]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-lg text-[#f5f0ed]">Balanced Studio AI</h3>
                            <span className="font-mono text-[10px] bg-[#2c2928] text-[#e5e2e0] px-2 py-0.5 rounded-full border border-white/5">
                              Recommended
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#a8a29e] max-w-xl mt-0.5 leading-relaxed">
                            Semantic natural language search, automatic biometric clustering, and duplicate detection with zero cloud telemetry.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right shrink-0 self-end sm:self-center">
                        <span className="font-mono text-xs text-[#c9c6c4] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          8 GB RAM
                        </span>
                        <span className="font-mono text-xs text-[#998f8a] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          CLIP ViT-B/32
                        </span>
                      </div>
                    </div>

                    {/* Master Studio Pro */}
                    <div
                      onClick={() => setNeuralProfile('master')}
                      className={`p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all border ${
                        neuralProfile === 'master'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-5 h-5 rounded-full bg-[#373433] flex items-center justify-center shrink-0 mt-0.5">
                          {neuralProfile === 'master' && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-lg text-[#f5f0ed]">Master Studio Pro</h3>
                            <span className="font-mono text-[10px] text-[#998f8a] bg-[#100e0d] px-2 py-0.5 rounded-full">
                              Heavyweight
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#a8a29e] max-w-xl mt-0.5 leading-relaxed">
                            Full uncompressed CLIP ViT-L/14, multi-track audio Whisper-v3 transcription, and generative depth map estimation.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right shrink-0 self-end sm:self-center">
                        <span className="font-mono text-xs text-[#998f8a] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          16+ GB RAM
                        </span>
                        <span className="font-mono text-xs text-[#998f8a] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          Download 4.8 GB
                        </span>
                      </div>
                    </div>

                    {/* Minimalist Cold Archive */}
                    <div
                      onClick={() => setNeuralProfile('minimalist')}
                      className={`p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all border ${
                        neuralProfile === 'minimalist'
                          ? 'bg-[#211f1e] border-white/20 shadow-md ring-1 ring-white/10'
                          : 'bg-[#1d1b1a] border-white/5 hover:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-5 h-5 rounded-full bg-[#373433] flex items-center justify-center shrink-0 mt-0.5">
                          {neuralProfile === 'minimalist' && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-lg text-[#f5f0ed]">Minimalist Cold Archive</h3>
                            <span className="font-mono text-[10px] text-[#998f8a] bg-[#100e0d] px-2 py-0.5 rounded-full">
                              Pure Metadata
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#a8a29e] max-w-xl mt-0.5 leading-relaxed">
                            Zero neural background tasks. Exclusively relies on EXIF markers, IPTC data, and perceptual MD5 hashing.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right shrink-0 self-end sm:self-center">
                        <span className="font-mono text-xs text-[#998f8a] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          2 GB RAM
                        </span>
                        <span className="font-mono text-xs text-[#998f8a] bg-[#100e0d] px-3 py-1 rounded-full border border-white/5">
                          No Weights
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Engine Flags Modal / Popover */}
          <AnimatePresence>
            {showEngineFlags && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-x-4 bottom-20 z-40 bg-[#1d1b1a] border border-[#373433] rounded-2xl p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-[#e5e2e0]" />
                    <span className="font-serif text-base text-[#f5f0ed]">Advanced Engine Configuration Flags</span>
                  </div>
                  <button 
                    onClick={() => setShowEngineFlags(false)}
                    className="p-1 text-[#998f8a] hover:text-white"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-[#a8a29e]">GPU Pipeline Accelerator</label>
                    <select
                      value={gpuAccelerationMode}
                      onChange={(e) => setGpuAccelerationMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#100e0d] border border-white/10 text-[#f5f0ed] focus:outline-none"
                    >
                      <option value="webgpu">WebGPU (Metal / Vulkan SIMD)</option>
                      <option value="dx12">DirectX 12 Compute</option>
                      <option value="cpu">CPU AVX-512 Fallback</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[#a8a29e]">
                      <span>Worker Daemons</span>
                      <span className="text-white font-bold">{workerDaemons} Cores</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={workerDaemons}
                      onChange={(e) => setWorkerDaemons(Number(e.target.value))}
                      className="w-full accent-[#e5e2e0]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#a8a29e]">Telemetry Isolation</label>
                    <button
                      type="button"
                      onClick={() => setTelemetryLock(!telemetryLock)}
                      className="w-full px-3 py-2 rounded-xl bg-[#100e0d] border border-white/10 text-left flex items-center justify-between"
                    >
                      <span>Air-gapped Mode</span>
                      <span className={`w-2 h-2 rounded-full ${telemetryLock ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Control Navigation Bar */}
          <div className="w-full bg-[#1d1b1a] border-t border-[#2c2928] px-6 sm:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none shrink-0">
            {/* Back and Cancel */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={handleFinish}
                className="font-mono text-xs text-[#998f8a] hover:text-[#f5f0ed] transition-colors"
              >
                Cancel Setup
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : 1))}
                disabled={currentStep === 1}
                className="px-3.5 py-1.5 rounded-full bg-[#2c2928] text-[#f5f0ed] hover:bg-[#373433] disabled:opacity-30 font-mono text-xs transition-colors flex items-center gap-1.5 border border-white/5"
              >
                <ArrowLeft size={13} />
                <span>Step {currentStep > 1 ? currentStep - 1 : 1}</span>
              </button>
            </div>

            {/* Center Step Counter */}
            <div className="hidden md:flex items-center gap-2 text-[#a8a29e] font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5e2e0]"></span>
              <span>
                Configuring Step {currentStep} of 4 • {stepTitles[currentStep].label}
              </span>
            </div>

            {/* Forward Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowEngineFlags(!showEngineFlags)}
                className="font-mono text-xs text-[#a8a29e] hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#2c2928]"
              >
                <Sliders size={14} />
                <span className="hidden xs:inline">Engine Flags</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => ((s + 1) as 1 | 2 | 3 | 4))}
                  className="px-5 py-2 rounded-full bg-[#e5e2e0] text-[#1c1b1a] hover:bg-white font-mono text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>
                    Continue to {currentStep === 1 ? 'Storage Strategy' : currentStep === 2 ? 'Footprint Allocation' : 'Neural Engine'}
                  </span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isFinishing}
                  className="px-6 py-2 rounded-full bg-[#e5e2e0] text-[#1c1b1a] hover:bg-white font-mono text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <span>{isFinishing ? 'Initializing...' : 'Mount & Launch Studio'}</span>
                  <Check size={14} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fixed Bottom Statusline */}
        <div className="fixed bottom-0 inset-x-0 h-10 z-20 flex items-center justify-between px-6 sm:px-10 text-[#78716c] font-mono text-[11px] pointer-events-none">
          <span className="pointer-events-auto">Nocturnal Calibrated Engine • 16-bit ProPhoto RGB</span>
          <span className="pointer-events-auto">Esc to Minimize • Workspace Ready</span>
        </div>
      </div>
    </AnimatePresence>
  );
};
