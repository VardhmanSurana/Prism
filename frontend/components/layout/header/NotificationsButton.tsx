import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Sparkles, Activity } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { API_BASE } from '@/constants';
import { eventService } from '@/services/EventService';
import { useSyncStore } from '@/store/syncStore';

interface ServiceStatus {
  processed: number;
  total: number;
  progress: number;
  is_processing: boolean;
}

interface JobStatus {
  total_photos: number;
  clip: ServiceStatus;
  gemma: ServiceStatus;
  face: ServiceStatus;
  ocr: ServiceStatus;
  queue: {
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  };
}

export const NotificationsButton: React.FC = () => {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewCompletion, setHasNewCompletion] = useState(false);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial load of background status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (e) {
        console.error('Failed to fetch background jobs status', e);
      }
    };
    fetchStatus();
  }, []);

  // Listen to SSE events for real-time status & completion pings
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (e) {
        console.error('Failed to fetch background jobs status', e);
      }
    };

    const unsubStatus = eventService.subscribe('background_job_status', (event) => {
      const data = event.data as JobStatus;
      setStatus(data);
    });

    const unsubCompleted = eventService.subscribe('background_job_completed', (event) => {
      const data = event.data as JobStatus;
      setStatus(data);
      setHasNewCompletion(true);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLogs((prev) => [
        `✓ AI Ingestion completed: ${data.total_photos} photos analyzed at ${timestamp}`,
        ...prev.slice(0, 4),
      ]);
    });

    const unsubReconnected = eventService.subscribe('reconnected', () => {
      fetchStatus();
    });

    return () => {
      unsubStatus();
      unsubCompleted();
      unsubReconnected();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setHasNewCompletion(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setHasNewCompletion(false);
  };

  const isProcessingAny =
    syncStatus.is_scanning ||
    !!(
      status?.clip.is_processing ||
      status?.gemma.is_processing ||
      status?.face.is_processing ||
      status?.ocr.is_processing
    );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className={`p-2 rounded-xl transition-all relative ${
          isOpen ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white'
        }`}
        aria-label="Notifications"
      >
        <Bell size={18} className={isProcessingAny ? 'animate-pulse text-primary' : ''} />
        {hasNewCompletion && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-background animate-bounce" />
        )}
        {isProcessingAny && !hasNewCompletion && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 z-50 pointer-events-auto"
          >
            <GlassMaterial intensity="regular" className="p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    System Tasks
                    </span>
                </div>
                {logs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                  >
                    Clear All
                    </button>
                )}
              </div>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Importing Scan */}
                {syncStatus.is_scanning && (
                  <div className="space-y-1">
                    <ProgressBar
                      progress={syncStatus.progress}
                      total={syncStatus.total_files}
                      processed={syncStatus.processed_files}
                      isScanning={syncStatus.is_scanning}
                      label="Importing & Syncing Library"
                      color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    />
                  </div>
                )}

                {/* CLIP Processing */}
                {status?.clip.is_processing && (
                  <div className="space-y-1">
                    <ProgressBar
                      progress={status.clip.progress}
                      total={status.clip.total}
                      processed={status.clip.processed}
                      isScanning={status.clip.is_processing}
                      label="Vision Indexing (CLIP)"
                      color="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                    />
                  </div>
                )}

                {/* Gemma Captioning */}
                {status?.gemma.is_processing && (
                  <div className="space-y-1">
                    <ProgressBar
                      progress={status.gemma.progress}
                      total={status.gemma.total}
                      processed={status.gemma.processed}
                      isScanning={status.gemma.is_processing}
                      label="AI Captioning (Gemma)"
                      color="bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                    />
                  </div>
                )}

                {/* Face Scan */}
                {status?.face.is_processing && (
                  <div className="space-y-1">
                    <ProgressBar
                      progress={status.face.progress}
                      total={status.face.total}
                      processed={status.face.processed}
                      isScanning={status.face.is_processing}
                      label="Face Detection & Clustering"
                      color="bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                    />
                  </div>
                )}

                {/* OCR Text Extraction */}
                {status?.ocr.is_processing && (
                  <div className="space-y-1">
                    <ProgressBar
                      progress={status.ocr.progress}
                      total={status.ocr.total}
                      processed={status.ocr.processed}
                      isScanning={status.ocr.is_processing}
                      label="Text Extraction (OCR)"
                      color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    />
                  </div>
                )}

                {/* Empty State / System Idle */}
                {!isProcessingAny && (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                      <Check size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-xs font-semibold text-gray-300">All systems idle</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Library is fully indexed and up to date</p>
                  </div>
                )}

                {/* Logs Section */}
                {logs.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                      Recent Activity
                      </span>
                    <div className="space-y-1.5">
                      {logs.map((log, idx) => (
                        <div
                          key={idx}
                          className="text-[10px] text-gray-400 bg-white/[0.02] border border-white/5 p-2 rounded-lg flex items-start gap-2"
                        >
                          <Sparkles size={10} className="text-yellow-500 shrink-0 mt-0.5" />
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassMaterial>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
