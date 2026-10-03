import React, { useEffect, useState } from 'react';
import {
  Activity,
  Play,
  Pause,
  AlertTriangle,
  RefreshCw,
  Download,
  Sliders,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobsStore } from '@/store/jobsStore';
import { API_BASE } from '@/constants';
import { DashboardMetrics } from './DashboardMetrics';
import { StorageDistributionCard } from './StorageDistributionCard';
import { ThroughputTrendCard } from './ThroughputTrendCard';
import { PipelineStagesCard } from './PipelineStagesCard';
import { SystemResourceCard } from './SystemResourceCard';
import { TaskQueueCard } from './TaskQueueCard';
import { useDashboardStats } from './useDashboardStats';

interface DiagnosticsData {
  database_size_bytes?: number;
  thumbnail_cache_size_bytes?: number;
  models_dir_size_bytes?: number;
  total_active_photos?: number;
  system_health?: {
    database_size_mb: number;
    cache_size_mb: number;
    total_size_mb: number;
    gpu_available: boolean;
    gpu_device: string | null;
  };
  database_size_mb?: number;
  cache_size_mb?: number;
  total_size_mb?: number;
  gpu_available?: boolean;
  gpu_device?: string | null;
}

type DashboardTab = 'overview' | 'pipeline' | 'storage' | 'hardware' | 'tasks';

export const DashboardView: React.FC = () => {
  const {
    jobs,
    counts,
    isWorkerPaused,
    pauseReason,
    pausedStages,
    hardware,
    fetchJobs,
    cancelJob,
    retryJob,
    pruneJobs,
    pauseWorker,
    resumeWorker,
    pauseStage,
    resumeStage,
  } = useJobsStore();

  const {
    photoStats,
    libraryHealth,
    pipelineStatus,
    hardwareProfile,
    isLoading: isStatsLoading,
    refresh: refreshDashboardStats,
  } = useDashboardStats(4000);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch {
      // background poll catch
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchDiagnostics();

    const jobsInterval = setInterval(fetchJobs, 3000);
    const diagInterval = setInterval(fetchDiagnostics, 10000);

    return () => {
      clearInterval(jobsInterval);
      clearInterval(diagInterval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchJobs(), fetchDiagnostics(), refreshDashboardStats()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExportSnapshot = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      counts,
      isWorkerPaused,
      pauseReason,
      pausedStages,
      hardware,
      photoStats,
      libraryHealth,
      pipelineStatus,
      hardwareProfile,
      diagnostics,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prism_Telemetry_Snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleToggleStage = (stageId: string) => {
    const isPaused = pausedStages.some((s) => s.toLowerCase() === stageId.toLowerCase());
    if (isPaused) {
      resumeStage(stageId);
    } else {
      pauseStage(stageId);
    }
  };

  const isWorkerBusy = counts.processing > 0 || counts.pending > 0;

  // Real Counts from SQLite
  const totalPhotosCount = photoStats?.total_photos ?? diagnostics?.total_active_photos ?? 0;
  const totalVideosCount = photoStats?.total_videos ?? 0;
  const totalMedia = totalPhotosCount + totalVideosCount;

  // Real Storage Breakdown from Host OS & SQLite
  const originalsBytes = libraryHealth?.storage?.originals_bytes ?? photoStats?.storage_used_bytes ?? 0;
  const dbBytes = libraryHealth?.storage?.database_bytes ?? diagnostics?.database_size_bytes ?? 0;
  const thumbBytes = libraryHealth?.storage?.thumbnails_bytes ?? diagnostics?.thumbnail_cache_size_bytes ?? 0;
  const modelBytes = libraryHealth?.storage?.models_bytes ?? diagnostics?.models_dir_size_bytes ?? 0;
  const proxiesBytes = libraryHealth?.storage?.proxies_bytes ?? 0;

  const totalUsedBytes =
    libraryHealth?.storage?.total_bytes ??
    (originalsBytes + dbBytes + thumbBytes + modelBytes + proxiesBytes);

  const totalSizeMb = totalUsedBytes > 0 ? Math.round(totalUsedBytes / (1024 * 1024)) : 0;
  const dbSizeMb = dbBytes > 0 ? dbBytes / (1024 * 1024) : 0;
  const cacheSizeMb = thumbBytes > 0 ? thumbBytes / (1024 * 1024) : 0;

  const gpuAvailable =
    hardwareProfile?.profile?.gpu_name != null ||
    diagnostics?.system_health?.gpu_available ||
    diagnostics?.gpu_available ||
    false;

  const gpuDevice =
    hardwareProfile?.profile?.gpu_name ||
    diagnostics?.system_health?.gpu_device ||
    diagnostics?.gpu_device ||
    (hardwareProfile?.profile?.backend ? `${hardwareProfile.profile.backend.toUpperCase()} Engine` : 'CPU (Rayon)');

  const diskFreeGb = hardware?.disk_free_gb ?? 580;

  return (
    <div className="relative min-h-screen bg-[#0d0b0a] text-[#e7e1df] p-4 sm:p-8 flex-1 overflow-x-hidden select-none">
      {/* Volumetric Diffuse Background Lighting */}
      <div className="absolute -top-32 left-1/4 w-[36rem] h-[36rem] rounded-full bg-[#2c2928]/35 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-[32rem] h-[32rem] rounded-full bg-[#373433]/25 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Top Studio Header & Telemetry App Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[#211f1e]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#998f8a]">
                STUDIO TELEMETRY • ORCHESTRATION PIPELINE
              </span>
              <span className="text-[#4d4541] text-[10px]">•</span>
              <span className="font-mono text-[10px] text-[#c9c6c4]">
                PRISM 2.4
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl sm:text-4xl text-[#f5f0ed] tracking-tight">
                System Dashboard
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1d1b1a] border border-white/5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWorkerPaused
                      ? 'bg-amber-400'
                      : isWorkerBusy
                        ? 'bg-blue-400 animate-pulse'
                        : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  }`}
                />
                <span className="font-mono text-[11px] text-[#a8a29e]">
                  {isWorkerPaused
                    ? 'Worker Paused'
                    : isWorkerBusy
                      ? `${counts.processing} Active · ${counts.pending} Queued`
                      : 'Workers Nominal'}
                </span>
              </div>
            </div>
            <p className="text-xs text-[#a8a29e] mt-1 font-light max-w-2xl leading-relaxed">
              Real-time hardware telemetry, neural inference velocity, storage breakdown, and background pipeline execution.
            </p>
          </div>

          {/* Badges & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[11px] text-[#998f8a] bg-[#1d1b1a] px-3 py-1.5 rounded-xl border border-white/5">
              {gpuDevice}
            </span>
            <span className="font-mono text-[11px] text-[#998f8a] bg-[#1d1b1a] px-3 py-1.5 rounded-xl border border-white/5">
              {diskFreeGb} GB Headroom
            </span>

            <button
              type="button"
              onClick={handleExportSnapshot}
              className="p-2 rounded-xl bg-[#1d1b1a] hover:bg-[#2c2928] text-[#a8a29e] hover:text-[#f5f0ed] border border-white/5 transition-all"
              title="Export Telemetry JSON Snapshot"
            >
              <Download size={15} />
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              className={`p-2 rounded-xl bg-[#1d1b1a] hover:bg-[#2c2928] text-[#a8a29e] hover:text-[#f5f0ed] border border-white/5 transition-all ${
                isRefreshing || isStatsLoading ? 'animate-spin text-white' : ''
              }`}
              title="Refresh Telemetry Now"
            >
              <RefreshCw size={15} />
            </button>

            {isWorkerPaused ? (
              <button
                type="button"
                onClick={resumeWorker}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-mono font-medium transition-all shadow-sm"
              >
                <Play size={13} />
                <span>Resume Engine</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseWorker}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-mono font-medium transition-all shadow-sm"
              >
                <Pause size={13} />
                <span>Pause Engine</span>
              </button>
            )}
          </div>
        </div>

        {/* Pause Reason Alert Banner */}
        {pauseReason && !pauseReason.toLowerCase().includes('temperature') && (
          <div className="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5 font-mono">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <span>Worker Pause Notice: {pauseReason}</span>
          </div>
        )}

        {/* View Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-xs no-scrollbar">
          {[
            { id: 'overview', label: '01. Cockpit Overview' },
            { id: 'pipeline', label: '02. Pipeline Controller' },
            { id: 'storage', label: '03. Storage Allocation' },
            { id: 'hardware', label: '04. Hardware Telemetry' },
            { id: 'tasks', label: '05. Task Execution Queue' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap border ${
                activeTab === tab.id
                  ? 'bg-[#2c2928] text-[#f5f0ed] font-medium border-white/20 shadow-sm'
                  : 'bg-[#151312] text-[#998f8a] border-white/5 hover:text-[#f5f0ed] hover:border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. Top KPI Summary Strip */}
        <DashboardMetrics
          totalMediaCount={totalMedia}
          photoCount={totalPhotosCount}
          videoCount={totalVideosCount}
          totalSizeMb={totalSizeMb}
          counts={counts}
          hardware={hardware}
          databaseSizeMb={dbSizeMb}
          cacheSizeMb={cacheSizeMb}
          gpuAvailable={gpuAvailable}
          gpuDevice={gpuDevice}
          integrityStatus={libraryHealth?.integrity_status}
          isHealthy={libraryHealth?.is_healthy}
          missingCount={libraryHealth?.missing_count}
          lastBackupDate={libraryHealth?.last_backup?.created_at}
        />

        {/* Content based on Active Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Row 1: Storage Donut & Throughput Area Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 flex flex-col">
                  <StorageDistributionCard
                    databaseSizeBytes={dbBytes}
                    thumbnailCacheSizeBytes={thumbBytes}
                    modelsDirSizeBytes={modelBytes}
                    originalSizeBytes={originalsBytes}
                    proxiesSizeBytes={proxiesBytes}
                    totalDiskFreeBytes={hardware?.disk_free_bytes}
                  />
                </div>
                <div className="lg:col-span-7 flex flex-col">
                  <ThroughputTrendCard />
                </div>
              </div>

              {/* Row 2: Pipeline Controller & Hardware Telemetry */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <PipelineStagesCard
                    pausedStages={pausedStages}
                    onToggleStage={handleToggleStage}
                    stagesProgress={{
                      thumbnail: pipelineStatus?.thumbnail,
                      clip: pipelineStatus?.clip,
                      face: pipelineStatus?.face,
                      ocr: pipelineStatus?.ocr,
                      gemma: pipelineStatus?.gemma,
                    }}
                  />
                </div>
                <div className="lg:col-span-5">
                  <SystemResourceCard
                    hardware={hardware}
                    gpuAvailable={gpuAvailable}
                    gpuDevice={gpuDevice}
                    inferenceSlot={hardwareProfile?.inference_slot}
                  />
                </div>
              </div>

              {/* Row 3: Task Queue Execution Center */}
              <TaskQueueCard
                jobs={jobs}
                onCancelJob={cancelJob}
                onRetryJob={retryJob}
                onPruneJobs={pruneJobs}
              />
            </motion.div>
          )}

          {activeTab === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <PipelineStagesCard
                pausedStages={pausedStages}
                onToggleStage={handleToggleStage}
                stagesProgress={{
                  thumbnail: pipelineStatus?.thumbnail,
                  clip: pipelineStatus?.clip,
                  face: pipelineStatus?.face,
                  ocr: pipelineStatus?.ocr,
                  gemma: pipelineStatus?.gemma,
                }}
              />
              <ThroughputTrendCard />
            </motion.div>
          )}

          {activeTab === 'storage' && (
            <motion.div
              key="storage"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <StorageDistributionCard
                databaseSizeBytes={dbBytes}
                thumbnailCacheSizeBytes={thumbBytes}
                modelsDirSizeBytes={modelBytes}
                originalSizeBytes={originalsBytes}
                proxiesSizeBytes={proxiesBytes}
                totalDiskFreeBytes={hardware?.disk_free_bytes}
              />
            </motion.div>
          )}

          {activeTab === 'hardware' && (
            <motion.div
              key="hardware"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <SystemResourceCard
                hardware={hardware}
                gpuAvailable={gpuAvailable}
                gpuDevice={gpuDevice}
                inferenceSlot={hardwareProfile?.inference_slot}
              />
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <TaskQueueCard
                jobs={jobs}
                onCancelJob={cancelJob}
                onRetryJob={retryJob}
                onPruneJobs={pruneJobs}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DashboardView;
