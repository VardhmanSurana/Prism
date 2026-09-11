import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  FolderSync, 
  Download, 
  RotateCcw, 
  Image as ImageIcon,
  ShieldCheck,
  Server,
  Layers
} from 'lucide-react';
import { API_BASE } from '../../constants';

interface StorageBreakdown {
  originals_bytes: number;
  thumbnails_bytes: number;
  models_bytes: number;
  proxies_bytes: number;
  database_bytes: number;
  total_bytes: number;
}

interface MissingPhotoInfo {
  id: number;
  filename: string;
  path: string;
  missing_since?: string;
}

interface LibraryBackup {
  id: number;
  filename: string;
  path: string;
  size_bytes: number;
  integrity_status: string;
  created_at?: string;
}

interface HealthStatusResponse {
  storage: StorageBreakdown;
  missing_count: number;
  broken_paths_count: number;
  broken_samples: MissingPhotoInfo[];
  last_backup?: LibraryBackup;
  integrity_status: string;
  is_healthy: boolean;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export const LibraryHealthView: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthStatusResponse | null>(null);
  const [backups, setBackups] = useState<LibraryBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);

  // Relink dialog
  const [showRelinkModal, setShowRelinkModal] = useState(false);
  const [oldPrefix, setOldPrefix] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [relinkStatus, setRelinkStatus] = useState<string | null>(null);

  // Restore dialog
  const [restoreCandidate, setRestoreCandidate] = useState<LibraryBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const fetchHealthStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/status`);
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (e) {
      console.error('Failed to fetch health status', e);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/backup/list`);
      if (res.ok) {
        const data = await res.json();
        setBackups(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch backups', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchHealthStatus(), fetchBackups()]);
    setIsLoading(false);
  }, [fetchHealthStatus, fetchBackups]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Scan missing media
  const handleScanMissing = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/scan-missing`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchHealthStatus();
      }
    } catch (e) {
      console.error('Failed to scan missing files', e);
    } finally {
      setIsScanning(false);
    }
  };

  // Run integrity check
  const handleVerifyIntegrity = async () => {
    setIsCheckingIntegrity(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/verify-checksums`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchHealthStatus();
      }
    } catch (e) {
      console.error('Failed to verify checksums', e);
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // Export atomic backup
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/backup/export`, {
        method: 'POST',
      });
      if (res.ok) {
        await Promise.all([fetchHealthStatus(), fetchBackups()]);
      }
    } catch (e) {
      console.error('Failed to export backup', e);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Relink paths
  const handleApplyRelink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPrefix.trim() || !newPrefix.trim()) return;

    setIsRelinking(true);
    setRelinkStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/relink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_prefix: oldPrefix.trim(), new_prefix: newPrefix.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        setRelinkStatus(`Relink complete: ${result.relinked_count} files relinked (${result.failed_count} not found at destination).`);
        await fetchHealthStatus();
        setTimeout(() => {
          setShowRelinkModal(false);
          setRelinkStatus(null);
          setOldPrefix('');
          setNewPrefix('');
        }, 2200);
      } else {
        const err = await res.text();
        setRelinkStatus(`Relink failed: ${err}`);
      }
    } catch (e: any) {
      setRelinkStatus(`Relink error: ${e.message}`);
    } finally {
      setIsRelinking(false);
    }
  };

  // Restore backup
  const handleExecuteRestore = async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    setRestoreMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: restoreCandidate.filename, path: restoreCandidate.path }),
      });
      if (res.ok) {
        setRestoreMessage('Database successfully restored! Please restart or reload Prism.');
        await refreshAll();
      } else {
        const err = await res.text();
        setRestoreMessage(`Restore failed: ${err}`);
      }
    } catch (e: any) {
      setRestoreMessage(`Restore error: ${e.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const storage = healthData?.storage;
  const totalStorage = storage?.total_bytes || 1;

  // Percentage calculations for stacked bar
  const pctOriginals = storage ? Math.max(0, (storage.originals_bytes / totalStorage) * 100) : 0;
  const pctThumbs = storage ? Math.max(0, (storage.thumbnails_bytes / totalStorage) * 100) : 0;
  const pctModels = storage ? Math.max(0, (storage.models_bytes / totalStorage) * 100) : 0;
  const pctProxies = storage ? Math.max(0, (storage.proxies_bytes / totalStorage) * 100) : 0;
  const pctDatabase = storage ? Math.max(0, (storage.database_bytes / totalStorage) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] p-4 rounded-lg">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
            <ShieldCheck className="text-[var(--cr-accent)]" size={16} />
            Library Health & Recovery Engine
          </h2>
          <p className="text-xs text-[var(--cr-text-muted)] mt-0.5">
            Real-time storage allocation, non-blocking SQLite WAL snapshots, and missing media relinker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScanMissing}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] hover:bg-[var(--cr-surface-hover)] text-[var(--cr-text-primary)] transition disabled:opacity-50"
            title="Verify existence of all files on disk"
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin text-[var(--cr-accent)]' : ''} />
            {isScanning ? 'Scanning...' : 'Scan Missing'}
          </button>

          <button
            onClick={handleVerifyIntegrity}
            disabled={isCheckingIntegrity}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] hover:bg-[var(--cr-surface-hover)] text-[var(--cr-text-primary)] transition disabled:opacity-50"
            title="Run PRAGMA quick_check on SQLite"
          >
            <Activity size={13} className={isCheckingIntegrity ? 'animate-spin text-[var(--cr-accent)]' : ''} />
            {isCheckingIntegrity ? 'Checking...' : 'Check Integrity'}
          </button>

          <button
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium rounded bg-[var(--cr-accent)] text-[var(--cr-accent-foreground,#ffffff)] hover:opacity-95 transition disabled:opacity-50 shadow-sm"
          >
            <Download size={13} className={isBackingUp ? 'animate-spin' : ''} />
            {isBackingUp ? 'Snapshotting...' : 'Backup Now (VACUUM INTO)'}
          </button>
        </div>
      </div>

      {/* Bento Pulse Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Integrity */}
        <div className="cr-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--cr-text-muted)]">Database Integrity</span>
            <Database size={15} className="text-[var(--cr-accent)]" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${healthData?.integrity_status === 'ok' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-base font-semibold text-[var(--cr-text-primary)]">
              {healthData?.integrity_status === 'ok' ? 'WAL Consistent (OK)' : healthData?.integrity_status || 'Checking...'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--cr-text-muted)]">SQLite WAL mode with PRAGMA quick_check</p>
        </div>

        {/* Metric 2: Storage Total */}
        <div className="cr-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--cr-text-muted)]">Managed Storage</span>
            <HardDrive size={15} className="text-[var(--cr-accent)]" />
          </div>
          <div className="text-base font-semibold text-[var(--cr-text-primary)] pt-1 tabular-nums font-mono">
            {storage ? formatBytes(storage.total_bytes) : 'Calculating...'}
          </div>
          <p className="text-[11px] text-[var(--cr-text-muted)]">Total library footprint across all tiers</p>
        </div>

        {/* Metric 3: Missing Media */}
        <div className="cr-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--cr-text-muted)]">Missing Originals</span>
            <AlertTriangle size={15} className={healthData?.missing_count ? 'text-amber-500' : 'text-emerald-500'} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className={`text-base font-semibold tabular-nums font-mono ${healthData?.missing_count ? 'text-amber-500' : 'text-emerald-500'}`}>
              {healthData ? healthData.missing_count : 0} items
            </span>
            {Boolean(healthData?.missing_count) && (
              <button
                onClick={() => setShowRelinkModal(true)}
                className="text-[10px] font-mono text-[var(--cr-accent)] underline hover:opacity-80 ml-auto"
              >
                Relink
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--cr-text-muted)]">
            {healthData?.missing_count ? 'Detached or unmounted external paths' : 'All active media files reachable'}
          </p>
        </div>

        {/* Metric 4: Last Safe Backup */}
        <div className="cr-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--cr-text-muted)]">Last Snapshot</span>
            <Server size={15} className="text-[var(--cr-accent)]" />
          </div>
          <div className="text-sm font-semibold text-[var(--cr-text-primary)] pt-1 truncate">
            {healthData?.last_backup ? formatDate(healthData.last_backup.created_at) : 'No backup yet'}
          </div>
          <p className="text-[11px] text-[var(--cr-text-muted)]">
            {healthData?.last_backup ? `${formatBytes(healthData.last_backup.size_bytes)} atomic SQLite DB` : 'Run VACUUM INTO to create initial snapshot'}
          </p>
        </div>
      </div>

      {/* Storage Allocation Stacked Bar */}
      <div className="cr-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
              <Layers size={15} className="text-[var(--cr-accent)]" />
              Storage Allocation Breakdown
            </h3>
            <p className="text-xs text-[var(--cr-text-muted)]">
              Multi-tier disk footprint across originals, machine learning weights, thumbnails, and database.
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--cr-text-secondary)]">
            Total: {storage ? formatBytes(storage.total_bytes) : '...'}
          </span>
        </div>

        {/* The Stacked Bar */}
        <div className="h-4 w-full bg-[var(--cr-surface-sunken)] rounded-full overflow-hidden flex border border-[var(--cr-border)]">
          <div
            style={{ width: `${pctOriginals}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Originals: ${storage ? formatBytes(storage.originals_bytes) : 0} (${pctOriginals.toFixed(1)}%)`}
          />
          <div
            style={{ width: `${pctThumbs}%` }}
            className="bg-sky-500 h-full transition-all duration-500"
            title={`Thumbnails: ${storage ? formatBytes(storage.thumbnails_bytes) : 0} (${pctThumbs.toFixed(1)}%)`}
          />
          <div
            style={{ width: `${pctModels}%` }}
            className="bg-violet-500 h-full transition-all duration-500"
            title={`AI Models: ${storage ? formatBytes(storage.models_bytes) : 0} (${pctModels.toFixed(1)}%)`}
          />
          <div
            style={{ width: `${pctProxies}%` }}
            className="bg-amber-500 h-full transition-all duration-500"
            title={`Video Proxies: ${storage ? formatBytes(storage.proxies_bytes) : 0} (${pctProxies.toFixed(1)}%)`}
          />
          <div
            style={{ width: `${pctDatabase}%` }}
            className="bg-rose-500 h-full transition-all duration-500"
            title={`SQLite & WAL: ${storage ? formatBytes(storage.database_bytes) : 0} (${pctDatabase.toFixed(1)}%)`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cr-text-primary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Originals
            </div>
            <div className="font-mono text-xs text-[var(--cr-text-secondary)]">
              {storage ? formatBytes(storage.originals_bytes) : '0 B'}
              <span className="text-[10px] text-[var(--cr-text-muted)] ml-1">({pctOriginals.toFixed(1)}%)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cr-text-primary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Thumbnails
            </div>
            <div className="font-mono text-xs text-[var(--cr-text-secondary)]">
              {storage ? formatBytes(storage.thumbnails_bytes) : '0 B'}
              <span className="text-[10px] text-[var(--cr-text-muted)] ml-1">({pctThumbs.toFixed(1)}%)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cr-text-primary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              AI Models
            </div>
            <div className="font-mono text-xs text-[var(--cr-text-secondary)]">
              {storage ? formatBytes(storage.models_bytes) : '0 B'}
              <span className="text-[10px] text-[var(--cr-text-muted)] ml-1">({pctModels.toFixed(1)}%)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cr-text-primary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Video Proxies
            </div>
            <div className="font-mono text-xs text-[var(--cr-text-secondary)]">
              {storage ? formatBytes(storage.proxies_bytes) : '0 B'}
              <span className="text-[10px] text-[var(--cr-text-muted)] ml-1">({pctProxies.toFixed(1)}%)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--cr-text-primary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              SQLite & WAL
            </div>
            <div className="font-mono text-xs text-[var(--cr-text-secondary)]">
              {storage ? formatBytes(storage.database_bytes) : '0 B'}
              <span className="text-[10px] text-[var(--cr-text-muted)] ml-1">({pctDatabase.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Media & Broken Paths Table */}
      <div className="cr-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
              <AlertTriangle size={15} className={healthData?.missing_count ? 'text-amber-500' : 'text-emerald-500'} />
              Missing Originals & Broken Paths
            </h3>
            <p className="text-xs text-[var(--cr-text-muted)]">
              Active library records whose source media cannot be accessed on the local filesystem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRelinkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] hover:bg-[var(--cr-surface-hover)] text-[var(--cr-text-primary)] transition"
            >
              <FolderSync size={13} />
              Relink Folder
            </button>
          </div>
        </div>

        {healthData?.missing_count === 0 ? (
          <div className="p-4 bg-[var(--cr-surface-sunken)] rounded border border-[var(--cr-border)] flex items-center gap-3 text-xs text-[var(--cr-text-muted)]">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>All indexed media files are intact and accessible on disk.</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--cr-border)] rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--cr-surface-sunken)] border-b border-[var(--cr-border)] text-[var(--cr-text-muted)] font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-12">Preview</th>
                  <th className="py-2.5 px-3">Filename</th>
                  <th className="py-2.5 px-3">Last Known Path</th>
                  <th className="py-2.5 px-3">Missing Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cr-border)] font-mono text-[11px]">
                {healthData?.broken_samples.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--cr-surface-hover)] transition">
                    <td className="py-2 px-3">
                      <div className="w-8 h-8 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] overflow-hidden flex items-center justify-center">
                        <img
                          src={`${API_BASE}/thumbnails/${item.id}.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <ImageIcon size={14} className="text-[var(--cr-text-muted)]" />
                      </div>
                    </td>
                    <td className="py-2 px-3 font-medium text-[var(--cr-text-primary)]">{item.filename}</td>
                    <td className="py-2 px-3 text-[var(--cr-text-muted)] truncate max-w-xs">{item.path}</td>
                    <td className="py-2 px-3 text-amber-500">{formatDate(item.missing_since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Backup Manager */}
      <div className="cr-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
              <Database size={15} className="text-[var(--cr-accent)]" />
              Live Backup & Recovery Center
            </h3>
            <p className="text-xs text-[var(--cr-text-muted)]">
              Point-in-time snapshots created using SQLite <code className="text-[var(--cr-accent)] font-mono">VACUUM INTO</code>. Completely non-blocking and safe while library indexing is active.
            </p>
          </div>
          <button
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded bg-[var(--cr-accent)] text-white hover:opacity-90 transition disabled:opacity-50"
          >
            <Download size={13} className={isBackingUp ? 'animate-spin' : ''} />
            {isBackingUp ? 'Backing Up...' : 'Backup Now'}
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-4 bg-[var(--cr-surface-sunken)] rounded border border-[var(--cr-border)] text-xs text-[var(--cr-text-muted)] text-center">
            No atomic backups found. Click &quot;Backup Now&quot; above to create your first safe snapshot in <code className="font-mono">backups/</code>.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--cr-border)] rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--cr-surface-sunken)] border-b border-[var(--cr-border)] text-[var(--cr-text-muted)] font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Snapshot Filename</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Quick Check</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cr-border)] font-mono text-[11px]">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--cr-surface-hover)] transition">
                    <td className="py-2 px-3 font-medium text-[var(--cr-text-primary)]">{b.filename}</td>
                    <td className="py-2 px-3 text-[var(--cr-text-secondary)]">{formatBytes(b.size_bytes)}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 size={10} />
                        {b.integrity_status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[var(--cr-text-muted)]">{formatDate(b.created_at)}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setRestoreCandidate(b)}
                        className="flex items-center gap-1 ml-auto text-xs px-2 py-1 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] hover:bg-[var(--cr-surface-hover)] text-[var(--cr-status-error)] transition"
                        title="Restore database from this snapshot"
                      >
                        <RotateCcw size={11} />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Relink Modal Dialog */}
      {showRelinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--cr-border)] pb-3">
              <h4 className="text-sm font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
                <FolderSync size={16} className="text-[var(--cr-accent)]" />
                Relink Missing Media Folder
              </h4>
              <button
                onClick={() => setShowRelinkModal(false)}
                className="text-xs text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyRelink} className="space-y-4 text-xs">
              <p className="text-[var(--cr-text-muted)]">
                Replace an old drive letter, external mount, or folder path prefix with the new path where your originals now reside.
              </p>

              <div>
                <label className="block font-mono text-[11px] text-[var(--cr-text-secondary)] mb-1">
                  Old Path Prefix (e.g. /media/external_drive/Photos)
                </label>
                <input
                  type="text"
                  value={oldPrefix}
                  onChange={(e) => setOldPrefix(e.target.value)}
                  placeholder="/Volumes/OldDisk/Photos"
                  className="w-full px-3 py-1.5 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] font-mono text-xs text-[var(--cr-text-primary)] focus:outline-none focus:border-[var(--cr-accent)]"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[var(--cr-text-secondary)] mb-1">
                  New Path Prefix (e.g. /mnt/nas/Photos)
                </label>
                <input
                  type="text"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value)}
                  placeholder="/mnt/fast_nvme/Photos"
                  className="w-full px-3 py-1.5 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] font-mono text-xs text-[var(--cr-text-primary)] focus:outline-none focus:border-[var(--cr-accent)]"
                  required
                />
              </div>

              {relinkStatus && (
                <div className="p-2.5 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] font-mono text-[11px] text-[var(--cr-accent)]">
                  {relinkStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRelinkModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] text-[var(--cr-text-secondary)] hover:bg-[var(--cr-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRelinking}
                  className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-[var(--cr-accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isRelinking ? 'Relinking...' : 'Apply Relink'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--cr-surface-raised)] border border-[var(--cr-status-error)]/40 rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--cr-status-error)] border-b border-[var(--cr-border)] pb-3">
              <AlertTriangle size={18} />
              <h4 className="text-sm font-semibold">Confirm Database Restore</h4>
            </div>

            <p className="text-xs text-[var(--cr-text-secondary)]">
              Restoring from <code className="font-mono text-[var(--cr-accent)]">{restoreCandidate.filename}</code> will overwrite the active <code className="font-mono">prism.db</code> database and clear WAL/SHM state.
            </p>

            {restoreMessage && (
              <div className="p-2.5 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] font-mono text-[11px] text-[var(--cr-text-primary)]">
                {restoreMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreCandidate(null);
                  setRestoreMessage(null);
                }}
                className="px-3 py-1.5 rounded text-xs font-mono bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] text-[var(--cr-text-secondary)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-3.5 py-1.5 rounded text-xs font-mono font-medium bg-[var(--cr-status-error)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Confirm & Overwrite DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
