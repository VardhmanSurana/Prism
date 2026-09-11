import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Clock,
  Loader2,
  X
} from 'lucide-react';
import { useJobsStore, BackgroundJob } from '@/store/jobsStore';

export const ActivityCenter: React.FC = () => {
  const {
    jobs,
    counts,
    isWorkerPaused,
    fetchJobs,
    cancelJob,
    retryJob,
    pruneJobs,
    pauseWorker,
    resumeWorker,
  } = useJobsStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const containerRef = useRef<HTMLDivElement>(null);

  // Poll for job updates while open, or every 5 seconds normally
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
    }, isOpen ? 2000 : 8000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending');
  const historyJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  const totalActive = counts.processing + counts.pending;
  const isRunning = counts.processing > 0;

  return (
    <div className="relative" ref={containerRef}>
      {/* Header Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2.5 rounded-full transition-all duration-150 cursor-pointer ${
          isOpen
            ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
            : isRunning
            ? 'text-primary bg-primary/10 hover:bg-primary/20'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        title="Activity Center & Background Jobs"
      >
        <Activity size={18} className={isRunning ? 'animate-pulse' : ''} />
        {totalActive > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#121417]">
            {totalActive}
          </span>
        )}
      </button>

      {/* Activity Center Popover Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-96 z-50 overflow-hidden rounded-2xl bg-[#14171D] border border-white/10 shadow-2xl"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Activity Center</span>
              </div>

              <div className="flex items-center gap-2">
                {isWorkerPaused ? (
                  <button
                    onClick={resumeWorker}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-medium transition-colors"
                    title="Resume all background tasks"
                  >
                    <Play size={12} />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={pauseWorker}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[11px] font-medium transition-colors"
                    title="Pause all background tasks"
                  >
                    <Pause size={12} />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/5"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-white/[0.01]">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === 'active'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Active Tasks ({activeJobs.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === 'history'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                History ({historyJobs.length})
              </button>
            </div>

            {/* Tab Body */}
            <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5">
              {activeTab === 'active' ? (
                activeJobs.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-40 text-emerald-400" />
                    <p className="text-xs">All background tasks completed</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Your library and AI models are idle</p>
                  </div>
                ) : (
                  activeJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {job.status === 'processing' ? (
                            <Loader2 size={14} className="text-primary animate-spin shrink-0" />
                          ) : (
                            <Clock size={14} className="text-amber-400 shrink-0" />
                          )}
                          <span className="text-xs font-medium text-white truncate" title={job.title}>
                            {job.title}
                          </span>
                        </div>
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="p-1 text-gray-400 hover:text-rose-400 rounded transition-colors"
                          title="Cancel Task"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>

                      {/* Stage & Progress Info */}
                      {(job.current_stage || job.stage_progress) && (
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                          <span className="capitalize">{job.current_stage?.replace(/_/g, ' ') || 'Processing'}</span>
                          <span>{job.stage_progress || `${Math.round(job.progress_pct)}%`}</span>
                        </div>
                      )}

                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, job.progress_pct))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )
              ) : (
                historyJobs.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <p className="text-xs">No recent task history</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={pruneJobs}
                        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-rose-300 transition-colors"
                      >
                        <Trash2 size={12} />
                        <span>Clear Finished</span>
                      </button>
                    </div>

                    {historyJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {job.status === 'completed' ? (
                            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          ) : job.status === 'cancelled' ? (
                            <XCircle size={15} className="text-gray-500 shrink-0" />
                          ) : (
                            <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                          )}

                          <div className="min-w-0">
                            <div className="text-xs text-gray-200 truncate">{job.title}</div>
                            {job.last_error ? (
                              <div className="text-[10px] text-rose-400 truncate max-w-[220px]" title={job.last_error}>
                                {job.last_error}
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-500 capitalize">{job.status}</div>
                            )}
                          </div>
                        </div>

                        {job.status === 'failed' && (
                          <button
                            onClick={() => retryJob(job.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                            title="Retry task"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
