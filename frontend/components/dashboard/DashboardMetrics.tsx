import React from 'react';
import { Image, Layers, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { HardwareTelemetry, JobCounts } from '@/store/jobsStore';

interface DashboardMetricsProps {
  totalMediaCount: number;
  photoCount?: number;
  videoCount?: number;
  totalSizeMb?: number;
  counts: JobCounts;
  hardware: HardwareTelemetry | null;
  databaseSizeMb?: number;
  cacheSizeMb?: number;
  gpuDevice?: string | null;
  gpuAvailable?: boolean;
  integrityStatus?: string;
  isHealthy?: boolean;
  missingCount?: number;
  lastBackupDate?: string | null;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  totalMediaCount,
  photoCount,
  videoCount,
  totalSizeMb,
  counts,
  hardware,
  databaseSizeMb,
  cacheSizeMb,
  gpuDevice,
  gpuAvailable,
  integrityStatus = 'ok',
  isHealthy = true,
  missingCount = 0,
  lastBackupDate,
}) => {
  const isWorkerBusy = counts.processing > 0;
  const cpuPercent = hardware ? Math.round(hardware.cpu_usage) : 0;
  const isHighLoad = cpuPercent >= 85;
  const isModerateLoad = cpuPercent >= 60;

  const hasIntegrityIssue = !isHealthy || missingCount > 0 || (integrityStatus && integrityStatus.toLowerCase() !== 'ok');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Media Assets */}
      <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 p-5 rounded-2xl transition-all shadow-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
            Total Media Assets
          </span>
          <div className="w-8 h-8 rounded-full bg-[#211f1e] border border-white/5 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <Image size={15} />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5 mb-1.5">
          <span className="font-serif text-3xl sm:text-4xl text-[#f5f0ed] tracking-tight">
            {totalMediaCount.toLocaleString()}
          </span>
          {totalSizeMb ? (
            <span className="font-mono text-xs text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {(totalSizeMb / 1024).toFixed(1)} GB
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-[#78716c] font-mono flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-2">
          <span>{photoCount !== undefined ? `${photoCount.toLocaleString()} Photos` : 'Indexed Library'}</span>
          <span>{videoCount !== undefined ? `${videoCount.toLocaleString()} Videos` : 'Local Storage'}</span>
        </div>
      </div>

      {/* 2. Processing Engine Queue */}
      <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 p-5 rounded-2xl transition-all shadow-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
            Processing Engine Queue
          </span>
          <div className="w-8 h-8 rounded-full bg-[#211f1e] border border-white/5 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <Layers size={15} className={isWorkerBusy ? 'animate-spin' : ''} />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className={`font-serif text-3xl sm:text-4xl tracking-tight ${isWorkerBusy ? 'text-blue-400' : 'text-[#f5f0ed]'}`}>
            {counts.processing}
          </span>
          <span className="font-mono text-xs text-[#a8a29e]">running</span>
          <span className="font-mono text-xs text-[#78716c] ml-auto">
            {counts.pending} queued
          </span>
        </div>
        <div className="text-[11px] text-[#78716c] font-mono flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-2">
          <span>{isWorkerBusy ? 'Batch active' : 'Queue idle'}</span>
          <span className={counts.failed > 0 ? 'text-rose-400' : 'text-[#a8a29e]'}>
            {counts.failed > 0 ? `${counts.failed} failed` : `${counts.completed} completed`}
          </span>
        </div>
      </div>

      {/* 3. Host CPU & Hardware Load */}
      <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 p-5 rounded-2xl transition-all shadow-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
            Host CPU &amp; Hardware
          </span>
          <div className="w-8 h-8 rounded-full bg-[#211f1e] border border-white/5 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
            <Cpu size={15} />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5 mb-1.5">
          <span className="font-serif text-3xl sm:text-4xl text-[#f5f0ed] tracking-tight">
            {cpuPercent}%
          </span>
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
              isHighLoad
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : isModerateLoad
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}
          >
            {isHighLoad ? 'High Load' : isModerateLoad ? 'Moderate' : 'Nominal'}
          </span>
        </div>
        <div className="text-[11px] text-[#78716c] font-mono flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-2 truncate">
          <span className="truncate">
            {gpuAvailable && gpuDevice ? gpuDevice : 'Rayon Threadpool'}
          </span>
          <span className="text-[#a8a29e] shrink-0 ml-1">
            {gpuAvailable ? 'GPU Accel' : 'CPU Only'}
          </span>
        </div>
      </div>

      {/* 4. Library & Database Integrity */}
      <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 p-5 rounded-2xl transition-all shadow-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">
            Library &amp; DB Integrity
          </span>
          <div className={`w-8 h-8 rounded-full bg-[#211f1e] border border-white/5 flex items-center justify-center ${hasIntegrityIssue ? 'text-amber-400' : 'text-emerald-400'} group-hover:scale-105 transition-transform`}>
            {hasIntegrityIssue ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className={`font-serif text-3xl sm:text-4xl tracking-tight ${hasIntegrityIssue ? 'text-amber-400' : 'text-emerald-400'}`}>
            {hasIntegrityIssue ? (missingCount > 0 ? `${missingCount} Missing` : 'Degraded') : 'Intact'}
          </span>
          <span className="font-mono text-xs text-[#a8a29e] ml-auto">
            WAL {integrityStatus.toUpperCase()}
          </span>
        </div>
        <div className="text-[11px] text-[#78716c] font-mono flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-2">
          <span>DB: {databaseSizeMb ? `${databaseSizeMb.toFixed(1)}MB` : 'SQLite'}</span>
          <span>{lastBackupDate ? `Backup: ${new Date(lastBackupDate).toLocaleDateString()}` : `Cache: ${cacheSizeMb ? `${cacheSizeMb.toFixed(1)}MB` : '0MB'}`}</span>
        </div>
      </div>
    </div>
  );
};
