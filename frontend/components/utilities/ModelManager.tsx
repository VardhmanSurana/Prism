import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Download, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Pause, 
  Play, 
  Sparkles, 
  HardDrive, 
  Clock, 
  Gauge, 
  Timer, 
  RefreshCw,
  Cpu,
  Layers,
  Search,
  ScanFace,
  Box,
  Scissors,
  FileText,
  ShieldCheck,
  ShieldAlert,
  FolderDown,
  Check,
  X
} from 'lucide-react';
import { API_BASE } from '@/constants';
import { usePlatform } from '@/hooks/usePlatform';

export interface ModelProgress {
  model_id: string;
  status: 'not_downloaded' | 'downloading' | 'completed' | 'error' | 'paused';
  bytes_downloaded: number;
  total_bytes: number;
  download_speed_bps: number;
  progress_percent: number;
  elapsed_seconds: number;
  eta_seconds?: number | null;
  error_message?: string | null;
  updated_at_ms: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  total_size_bytes: number;
  desktop_only?: boolean;
  is_downloaded: boolean;
  disk_size_bytes: number;
  license?: string | null;
  gated?: boolean;
  ack_required?: boolean;
  license_acknowledged?: boolean;
  progress?: ModelProgress | null;
}

const MODEL_ICONS: Record<string, React.ElementType> = {
  siglip2: Search,
  face_id: ScanFace,
  yolo_objects: Box,
  mobile_sam: Scissors,
  rapid_ocr: FileText,
  'isnet-general-use': Scissors,
  birefnet: Layers,
  'rmbg-1.4': Sparkles,
};

export const ModelManager: React.FC = () => {
  const { isMobile } = usePlatform();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'core' | 'packs'>('all');
  
  // Gated model acknowledgment modal state
  const [ackModalModel, setAckModalModel] = useState<ModelInfo | null>(null);
  const [ackChecked, setAckChecked] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/models`);
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
        setError(null);
      }
    } catch (e: any) {
      console.error('Failed to fetch models:', e);
      setError(e.message || 'Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProgressOnly = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/models/progress`);
      if (res.ok) {
        const data = await res.json();
        const progressMap: Record<string, ModelProgress> = data.progress || {};

        setModels((prev) =>
          prev.map((m) => {
            const prog = progressMap[m.id];
            if (prog) {
              const isDone = prog.status === 'completed';
              return {
                ...m,
                is_downloaded: isDone ? true : m.is_downloaded,
                disk_size_bytes: isDone ? m.total_size_bytes : m.disk_size_bytes,
                progress: prog,
              };
            }
            return m;
          })
        );
      }
    } catch {
      // Ignore background progress poll errors
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Dynamic real-time telemetry polling interval
  const hasActiveDownloads = models.some(
    (m) => m.progress?.status === 'downloading'
  );

  useEffect(() => {
    const intervalTime = hasActiveDownloads ? 400 : 5000;
    const interval = setInterval(() => {
      if (hasActiveDownloads) {
        fetchProgressOnly();
      } else {
        fetchModels();
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [hasActiveDownloads, fetchProgressOnly, fetchModels]);

  const triggerDownloadApi = async (modelId: string) => {
    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/models/download/${modelId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to start download (${res.status})`);
      }
      await fetchProgressOnly();
    } catch (e: any) {
      console.error('Failed to start download:', e);
      setError(e.message || 'Failed to start download');
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleStartDownload = async (modelId: string) => {
    const target = models.find(m => m.id === modelId);
    if (target?.gated && !target.license_acknowledged) {
      setAckModalModel(target);
      setAckChecked(false);
      return;
    }

    await triggerDownloadApi(modelId);
  };

  const handleConfirmGatedAcknowledgment = async () => {
    if (!ackModalModel || !ackChecked) return;
    setIsAcknowledging(true);
    const modelId = ackModalModel.id;
    try {
      const res = await fetch(`${API_BASE}/api/v1/packs/acknowledge-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId, acknowledged: true }),
      });
      if (res.ok) {
        setAckModalModel(null);
        setModels(prev => prev.map(m => m.id === modelId ? { ...m, license_acknowledged: true } : m));
        await triggerDownloadApi(modelId);
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to record license acknowledgment');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to record license acknowledgment');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleVerifyModel = async (modelId: string) => {
    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/packs/verify/${modelId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.is_valid) {
        setSuccessMsg(`✓ ${data.message || 'Model verified valid'}`);
        await fetchModels();
      } else {
        setError(data.message || 'Model integrity verification failed');
      }
    } catch (e: any) {
      setError(e.message || 'Verification request failed');
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      await fetch(`${API_BASE}/api/v1/models/cancel/${modelId}`, {
        method: 'POST',
      });
      await fetchProgressOnly();
    } catch (e) {
      console.error('Failed to cancel download:', e);
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!window.confirm('Are you sure you want to delete this AI model from disk? You can download it again anytime.')) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      await fetch(`${API_BASE}/api/v1/models/${modelId}`, {
        method: 'DELETE',
      });
      await fetchModels();
    } catch (e) {
      console.error('Failed to delete model:', e);
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const visibleModels = models
    .filter((m) => !isMobile || !m.desktop_only)
    .filter((m) => {
      if (activeCategoryTab === 'core') return !m.category.toLowerCase().includes('capability pack');
      if (activeCategoryTab === 'packs') return m.category.toLowerCase().includes('capability pack');
      return true;
    });

  const handleDownloadAll = async () => {
    const missing = visibleModels.filter((m) => !m.is_downloaded && m.progress?.status !== 'downloading' && !m.gated);
    for (const m of missing) {
      handleStartDownload(m.id);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bps: number): string => {
    if (!bps || bps <= 0) return '0 B/s';
    return `${formatBytes(bps)}/s`;
  };

  const formatDuration = (seconds?: number | null): string => {
    if (seconds === undefined || seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDiskUsed = models.reduce((acc, m) => acc + (m.is_downloaded ? m.disk_size_bytes : 0), 0);
  const downloadedCount = models.filter((m) => m.is_downloaded).length;

  return (
    <div className="flex flex-col gap-6 text-gray-100 font-sans pb-12">
      {/* ── Summary & Stats Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Cpu size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">On-Demand AI Models & Capability Packs</h2>
            <p className="text-xs text-gray-400">
              Download models locally for offline vision search, background cutout, and face identification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <HardDrive size={14} className="text-gray-400" />
            <span>Disk Used: <strong className="text-white">{formatBytes(totalDiskUsed)}</strong></span>
            <span className="text-gray-500">({downloadedCount}/{models.length} ready)</span>
          </div>

          <button
            onClick={handleDownloadAll}
            disabled={downloadedCount === models.length || hasActiveDownloads}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all"
          >
            <Download size={14} />
            <span>Download Ungated</span>
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        <button
          onClick={() => setActiveCategoryTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeCategoryTab === 'all' ? 'bg-white/15 text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          All Models ({models.length})
        </button>
        <button
          onClick={() => setActiveCategoryTab('core')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeCategoryTab === 'core' ? 'bg-white/15 text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Core AI ({models.filter(m => !m.category.toLowerCase().includes('capability pack')).length})
        </button>
        <button
          onClick={() => setActiveCategoryTab('packs')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeCategoryTab === 'packs' ? 'bg-white/15 text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Capability Packs: BG Removal ({models.filter(m => m.category.toLowerCase().includes('capability pack')).length})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Model Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleModels.map((model) => {
          const Icon = MODEL_ICONS[model.id] || Sparkles;
          const progress = model.progress;
          const isDownloading = progress?.status === 'downloading';
          const isCompleted = model.is_downloaded || progress?.status === 'completed';
          const isError = progress?.status === 'error';
          const isPaused = progress?.status === 'paused';
          const isBusy = actionLoading[model.id];

          const pct = progress?.progress_percent ?? (isCompleted ? 100 : 0);

          return (
            <div
              key={model.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-4 ${
                isDownloading
                  ? 'bg-blue-500/[0.04] border-blue-500/30 shadow-lg shadow-blue-500/5'
                  : isCompleted
                  ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  : 'bg-white/[0.01] border-white/5 opacity-85 hover:opacity-100'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : isDownloading
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 animate-pulse'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white tracking-tight">{model.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-mono">
                        {model.category}
                      </span>
                      {model.license && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                          model.gated 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {model.license}
                        </span>
                      )}
                      {model.gated && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold uppercase">
                          Gated Pack
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{model.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono text-gray-300 font-medium">
                    {formatBytes(model.total_size_bytes)}
                  </span>
                </div>
              </div>

              {/* Gated Notice */}
              {model.gated && !model.is_downloaded && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-normal flex items-start gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Non-commercial license required. You may acknowledge the creative terms to download or drop your own model weights into <code className="text-amber-200 bg-amber-950/40 px-1 py-0.5 rounded font-mono">models/packs/background-removal/</code>.
                  </span>
                </div>
              )}

              {/* Real-time Telemetry Dashboard */}
              {isDownloading && progress && (
                <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-blue-400 font-medium">{pct.toFixed(1)}%</span>
                    <span className="text-gray-400">
                      {formatBytes(progress.bytes_downloaded)} / {formatBytes(progress.total_bytes)}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-gray-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Gauge size={13} className="text-blue-400" />
                      <span>{formatSpeed(progress.download_speed_bps)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Timer size={13} className="text-purple-400" />
                      <span>Elapsed: {formatDuration(progress.elapsed_seconds)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock size={13} className="text-amber-400" />
                      <span>ETA: {progress.eta_seconds !== undefined && progress.eta_seconds !== null ? `~${formatDuration(progress.eta_seconds)}` : 'Calculating...'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {isError && progress?.error_message && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="truncate">{progress.error_message}</span>
                </div>
              )}

              {/* Card Footer & Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs">
                  {isCompleted ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 size={15} />
                      <span>Installed on Disk</span>
                    </span>
                  ) : isDownloading ? (
                    <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Downloading in Background...</span>
                    </span>
                  ) : isPaused ? (
                    <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <Pause size={13} />
                      <span>Download Paused</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">Not Downloaded</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {model.category.toLowerCase().includes('capability pack') && (
                    <button
                      onClick={() => handleVerifyModel(model.id)}
                      disabled={isBusy}
                      title="Verify SHA256 integrity or detect manually placed file"
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <ShieldCheck size={13} />
                      <span>Verify File</span>
                    </button>
                  )}

                  {isDownloading ? (
                    <button
                      onClick={() => handleCancelDownload(model.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Pause size={13} />
                      <span>Pause</span>
                    </button>
                  ) : isCompleted ? (
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      disabled={isBusy}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors"
                      title="Delete model to reclaim disk space"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartDownload(model.id)}
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Gated Model License Acknowledgment Modal ── */}
      {ackModalModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-400">
                <ShieldAlert size={22} />
                <h3 className="text-base font-semibold text-white">License Acknowledgment Required</h3>
              </div>
              <button
                onClick={() => setAckModalModel(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <p>
                <strong className="text-white">{ackModalModel.name}</strong> is released under the{' '}
                <span className="text-amber-300 font-mono font-semibold">{ackModalModel.license || 'Non-Commercial License'}</span>.
              </p>
              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 font-sans text-gray-300 space-y-2">
                <p>• <strong>Permitted:</strong> Personal, research, non-profit, and non-commercial creative image editing.</p>
                <p>• <strong>Prohibited:</strong> Direct commercial redistribution or monetization without a separate commercial license from BRIA AI.</p>
              </div>
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input
                  type="checkbox"
                  checked={ackChecked}
                  onChange={(e) => setAckChecked(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-blue-500 focus:ring-0 bg-black/40"
                />
                <span className="text-xs text-gray-200">
                  I understand and acknowledge that I will use this model exclusively for personal and non-commercial purposes.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAckModalModel(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ackChecked || isAcknowledging}
                onClick={handleConfirmGatedAcknowledgment}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all"
              >
                {isAcknowledging ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Agree & Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
