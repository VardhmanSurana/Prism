import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import type { BackgroundJob } from '@/store/jobsStore';

interface TaskQueueCardProps {
  jobs: BackgroundJob[];
  onCancelJob: (id: number) => Promise<boolean>;
  onRetryJob: (id: number) => Promise<boolean>;
  onPruneJobs: () => Promise<boolean>;
}

export const TaskQueueCard: React.FC<TaskQueueCardProps> = ({
  jobs,
  onCancelJob,
  onRetryJob,
  onPruneJobs,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending');
  const historyJobs = jobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
  );

  return (
    <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 rounded-2xl p-6 transition-all shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">Execution Center</span>
            <span className="text-[#4d4541] text-[10px]">•</span>
            <h2 className="font-serif text-lg text-[#f5f0ed] tracking-tight">Task &amp; Job Queue</h2>
          </div>
          <p className="text-xs text-[#a8a29e] mt-0.5">Background operations, batch ingestions, and neural indexing</p>
        </div>

        {/* Tab Controls & Prune Action */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#100e0d] border border-white/5 p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'active'
                  ? 'bg-[#2c2928] text-[#f5f0ed] font-medium border border-white/10 shadow-sm'
                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
              }`}
            >
              Active Tasks ({activeJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-[#2c2928] text-[#f5f0ed] font-medium border border-white/10 shadow-sm'
                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
              }`}
            >
              History ({historyJobs.length})
            </button>
          </div>

          {activeTab === 'history' && historyJobs.length > 0 && (
            <button
              type="button"
              onClick={() => onPruneJobs()}
              className="p-2 rounded-xl bg-[#1d1b1a] border border-white/5 hover:border-white/20 text-[#a8a29e] hover:text-rose-400 transition-colors"
              title="Clear completed job history"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-2.5">
        {activeTab === 'active' ? (
          activeJobs.length === 0 ? (
            <div className="py-10 text-center text-[#78716c] rounded-2xl border border-dashed border-[#2c2928] bg-[#100e0d]">
              <CheckCircle2 size={32} className="mx-auto mb-2.5 text-emerald-400/80" />
              <p className="text-sm font-serif text-[#f5f0ed]">All Tasks Completed</p>
              <p className="text-xs text-[#78716c] font-mono mt-0.5">
                Background worker is idle · Library indexing is up-to-date
              </p>
            </div>
          ) : (
            activeJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {job.status === 'processing' ? (
                    <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <Clock size={16} className="text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#f5f0ed] truncate">{job.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                          job.status === 'processing'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {job.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#78716c] mt-0.5">
                      Stage: {job.current_stage || job.job_type || 'General'} • Job #{job.id}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCancelJob(job.id)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-mono border border-rose-500/20 transition-all shrink-0"
                >
                  Cancel
                </button>
              </div>
            ))
          )
        ) : (
          historyJobs.length === 0 ? (
            <div className="py-8 text-center text-[#78716c] rounded-2xl border border-dashed border-[#2c2928] bg-[#100e0d]">
              <p className="text-xs font-mono">No historical operations logged yet</p>
            </div>
          ) : (
            historyJobs.slice(0, 10).map((job) => (
              <div
                key={job.id}
                className="p-3.5 rounded-xl bg-[#1d1b1a] border border-white/5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {job.status === 'completed' ? (
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  ) : job.status === 'failed' ? (
                    <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-[#78716c] shrink-0" />
                  )}
                  <span className="text-xs text-[#f5f0ed] truncate">{job.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : job.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-[#100e0d] text-[#78716c] border-white/5'
                    }`}
                  >
                    {job.status.toUpperCase()}
                  </span>
                </div>

                {job.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onRetryJob(job.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] text-[10px] font-mono border border-white/10 transition-colors"
                  >
                    <RotateCcw size={10} />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
