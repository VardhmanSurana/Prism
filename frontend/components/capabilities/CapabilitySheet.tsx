import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Download, Cpu, HardDrive, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCapabilitiesStore } from '@/store/capabilitiesStore';
import { API_BASE } from '@/constants';

export interface CapabilitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  featureKey: string;
  onActivated?: () => void;
}

export const CapabilitySheet: React.FC<CapabilitySheetProps> = ({
  isOpen,
  onClose,
  featureKey,
  onActivated,
}) => {
  const { capabilities, hardware, fetchCapabilities } = useCapabilitiesStore();
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const cap = capabilities[featureKey] || {
    name: featureKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: 'ai',
    state: 'model_not_installed',
    installed: false,
    enabled: true,
    resident_in_ram: false,
    model_id: featureKey,
    download_size_bytes: 0,
    description: 'Neural intelligence model for enhanced local media processing.',
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'Variable';
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    return `${(bytes / 1_000_000).toFixed(0)} MB`;
  };

  const handleDownload = async () => {
    if (!cap.model_id) return;
    setIsStartingDownload(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/models/download/${cap.model_id}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to start model download');
      }
      setDownloadStarted(true);
      await fetchCapabilities();
      if (onActivated) onActivated();
      setTimeout(() => {
        onClose();
        setDownloadStarted(false);
        setIsStartingDownload(false);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed to initialize');
      setIsStartingDownload(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#14171D] border border-white/10 shadow-2xl p-7 text-white z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white">{cap.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Optional Neural Intelligence Model</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Description */}
          <div className="space-y-4 mb-6">
            <p className="text-sm leading-relaxed text-gray-300">
              {cap.description}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <HardDrive size={18} className="text-blue-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-gray-400">Download Size</div>
                  <div className="text-xs font-semibold text-white">{formatSize(cap.download_size_bytes)}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <Cpu size={18} className="text-amber-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-gray-400">Hardware Runtime</div>
                  <div className="text-xs font-semibold text-white capitalize">
                    {hardware?.backend || 'CPU'} Accelerated
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Sovereignty Note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>100% Local Execution:</strong> Weights run entirely in-process on this machine. Your media is never uploaded to any cloud server.
              </span>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={onClose}
              disabled={isStartingDownload}
              className="px-4 py-2.5 text-xs font-medium text-gray-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              Remind Me Later
            </button>

            {downloadStarted ? (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-semibold">
                <CheckCircle2 size={16} />
                <span>Download Started!</span>
              </div>
            ) : (
              <button
                onClick={handleDownload}
                disabled={isStartingDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                <Download size={15} />
                <span>{isStartingDownload ? 'Starting...' : 'Download & Activate'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
