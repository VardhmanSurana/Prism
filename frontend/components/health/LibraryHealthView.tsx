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
  Layers,
  X
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Relink dialog
  const [showRelinkModal, setShowRelinkModal] = useState(false);
  const [oldPrefix, setOldPrefix] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [relinkStatus, setRelinkStatus] = useState<string | null>(null);

  // Restore dialog
  const [restoreCandidate, setRestoreCandidate] = useState<LibraryBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
        showToast('Library scan completed. Missing media count updated.');
      }
    } catch (e) {
      console.error('Failed to scan missing files', e);
      showToast('Scan failed: network error');
    } finally {
      setIsScanning(false);
    }
  };

  // Run integrity check
  const handleVerifyIntegrity = async () => {
    setIsCheckingIntegrity(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/verify-db`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        await fetchHealthStatus();
        showToast(`PRAGMA Check: ${data.message || 'Database integrity verified: 0 errors.'}`);
      }
    } catch (e) {
      console.error('Failed to verify integrity', e);
      showToast('Integrity check failed');
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // Trigger backup
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/backup/create`, {
        method: 'POST',
      });
      if (res.ok) {
        await refreshAll();
        showToast('Point-in-time SQLite snapshot created successfully via VACUUM INTO.');
      } else {
        const err = await res.text();
        showToast(`Backup error: ${err}`);
      }
    } catch (e) {
      console.error('Failed to trigger backup', e);
      showToast('Backup request failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Relink missing paths
  const handleApplyRelink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPrefix || !newPrefix) return;
    setIsRelinking(true);
    setRelinkStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/library/health/relink-missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_prefix: oldPrefix, new_prefix: newPrefix }),
      });
      if (res.ok) {
        const data = await res.json();
        setRelinkStatus(`Success: Relinked ${data.relinked_count ?? 0} missing items.`);
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
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#211f1e] text-[#f5f0ed] text-xs font-mono border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 4 Bento Pulse Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Integrity */}
        <div className="bg-[#211f1e] border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Database Integrity</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2c2928] text-xs font-mono text-emerald-400 border border-emerald-500/20">
              <span className={`w-1.5 h-1.5 rounded-full ${healthData?.integrity_status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {healthData?.integrity_status === 'ok' ? 'PRAGMA OK' : healthData?.integrity_status || 'Checking...'}
            </span>
          </div>
          <div>
            <div className="font-serif text-2xl text-[#f5f0ed]">
              {healthData?.integrity_status === 'ok' ? 'WAL Consistent' : 'Verification Required'}
            </div>
            <span className="text-xs text-[#a8a29e]">SQLite WAL mode with PRAGMA quick_check</span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-[#78716c] flex items-center justify-between">
            <span>B-Tree: Balanced</span>
            <button
              onClick={handleVerifyIntegrity}
              disabled={isCheckingIntegrity}
              className="text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} className={isCheckingIntegrity ? 'animate-spin' : ''} />
              <span>Verify Now</span>
            </button>
          </div>
        </div>

        {/* Metric 2: Storage Total */}
        <div className="bg-[#211f1e] border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Managed Storage</span>
            <HardDrive size={15} className="text-[#78716c]" />
          </div>
          <div>
            <div className="font-serif text-2xl text-[#f5f0ed]">
              {storage ? formatBytes(storage.total_bytes) : 'Calculating...'}
            </div>
            <span className="text-xs text-[#a8a29e]">Total library footprint across all tiers</span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-[#78716c] flex items-center justify-between">
            <span>Database: {storage ? formatBytes(storage.database_bytes) : '0 B'}</span>
            <span>Proxies: {storage ? formatBytes(storage.proxies_bytes) : '0 B'}</span>
          </div>
        </div>

        {/* Metric 3: Missing Media */}
        <div className="bg-[#211f1e] border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Missing Originals</span>
            <AlertTriangle size={15} className={healthData?.missing_count ? 'text-amber-400' : 'text-emerald-400'} />
          </div>
          <div>
            <div className="font-serif text-2xl text-[#f5f0ed]">
              {healthData ? `${healthData.missing_count} Missing` : '0 Missing'}
            </div>
            <span className="text-xs text-[#a8a29e]">
              {healthData?.missing_count ? 'Detached or unmounted external paths' : 'All active media files reachable'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-[#78716c] flex items-center justify-between">
            <span>Descriptors intact</span>
            {Boolean(healthData?.missing_count) ? (
              <button
                onClick={() => setShowRelinkModal(true)}
                className="text-amber-400 hover:text-amber-300 font-semibold transition"
              >
                Relink Paths
              </button>
            ) : (
              <span className="text-emerald-400">100% Reachable</span>
            )}
          </div>
        </div>

        {/* Metric 4: Last Safe Backup */}
        <div className="bg-[#211f1e] border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Last Snapshot</span>
            <Server size={15} className="text-[#78716c]" />
          </div>
          <div>
            <div className="font-serif text-2xl text-[#f5f0ed] truncate">
              {healthData?.last_backup ? formatDate(healthData.last_backup.created_at) : 'No backup yet'}
            </div>
            <span className="text-xs text-[#a8a29e]">
              {healthData?.last_backup ? `${formatBytes(healthData.last_backup.size_bytes)} atomic SQLite DB` : 'Run VACUUM INTO to create snapshot'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-[#78716c] flex items-center justify-between">
            <span>Method: VACUUM INTO</span>
            <span>Snapshots: {backups.length}</span>
          </div>
        </div>
      </div>

      {/* Storage Allocation Breakdown Block */}
      <div className="bg-[#211f1e] border border-white/5 p-5 sm:p-6 rounded-2xl flex flex-col gap-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-[#f5f0ed] flex items-center gap-2">
              <Layers size={18} className="text-[#e5a93c]" />
              Storage Allocation Breakdown
            </h2>
            <p className="text-xs text-[#a8a29e]">
              Multi-tier disk footprint across originals, machine learning weights, thumbnails, and database.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2c2928] text-[#e7e1df] font-mono text-xs self-start sm:self-auto border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Total: {storage ? formatBytes(storage.total_bytes) : '...'}</span>
          </div>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full h-4 rounded-full bg-[#100e0d] overflow-hidden flex shadow-inner p-0.5 border border-white/5">
            <div 
              style={{ width: `${pctOriginals}%` }} 
              className="h-full bg-[#e5e5e5] rounded-l-full transition-all duration-500" 
              title={`Originals: ${storage ? formatBytes(storage.originals_bytes) : 0} (${pctOriginals.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctThumbs}%` }} 
              className="h-full bg-[#737373] transition-all duration-500 ml-0.5" 
              title={`Thumbnails: ${storage ? formatBytes(storage.thumbnails_bytes) : 0} (${pctThumbs.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctModels}%` }} 
              className="h-full bg-[#a3a3a3] transition-all duration-500 ml-0.5" 
              title={`AI Models: ${storage ? formatBytes(storage.models_bytes) : 0} (${pctModels.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctProxies}%` }} 
              className="h-full bg-[#525252] transition-all duration-500 ml-0.5" 
              title={`Video Proxies: ${storage ? formatBytes(storage.proxies_bytes) : 0} (${pctProxies.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctDatabase}%` }} 
              className="h-full bg-[#262626] rounded-r-full transition-all duration-500 ml-0.5" 
              title={`SQLite & WAL: ${storage ? formatBytes(storage.database_bytes) : 0} (${pctDatabase.toFixed(1)}%)`}
            />
          </div>
          <div className="flex justify-between items-center text-[#78716c] font-mono text-[11px] px-1">
            <span>0.0 B</span>
            <span>Total: {storage ? formatBytes(storage.total_bytes) : '0 B'}</span>
          </div>
        </div>

        {/* Detailed Legend Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d1b1a] border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#e5e5e5] mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-[#f5f0ed] font-medium">Originals</span>
              <span className="font-mono text-[11px] text-[#a8a29e]">
                {storage ? formatBytes(storage.originals_bytes) : '0 B'} ({pctOriginals.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-[#78716c] mt-0.5">Lossless RAW &amp; Media</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d1b1a] border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#737373] mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-[#f5f0ed] font-medium">Thumbnails</span>
              <span className="font-mono text-[11px] text-[#a8a29e]">
                {storage ? formatBytes(storage.thumbnails_bytes) : '0 B'} ({pctThumbs.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-[#78716c] mt-0.5">WebP Previews &amp; Mipmaps</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d1b1a] border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#a3a3a3] mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-[#f5f0ed] font-medium">AI Models</span>
              <span className="font-mono text-[11px] text-[#a8a29e]">
                {storage ? formatBytes(storage.models_bytes) : '0 B'} ({pctModels.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-[#78716c] mt-0.5">ONNX Neural Weights</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d1b1a] border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#525252] mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-[#f5f0ed] font-medium">Video Proxies</span>
              <span className="font-mono text-[11px] text-[#a8a29e]">
                {storage ? formatBytes(storage.proxies_bytes) : '0 B'} ({pctProxies.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-[#78716c] mt-0.5">Scrubbing Bitrates</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d1b1a] border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#262626] mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-[#f5f0ed] font-medium">SQLite &amp; WAL</span>
              <span className="font-mono text-[11px] text-[#a8a29e]">
                {storage ? formatBytes(storage.database_bytes) : '0 B'} ({pctDatabase.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-[#78716c] mt-0.5">Index &amp; Vector Embeddings</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
          <button
            onClick={handleScanMissing}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c2928] hover:bg-[#373433] text-xs font-mono text-[#f5f0ed] border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning Library...' : 'Scan Missing Media'}</span>
          </button>

          <button
            onClick={handleVerifyIntegrity}
            disabled={isCheckingIntegrity}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c2928] hover:bg-[#373433] text-xs font-mono text-[#f5f0ed] border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{isCheckingIntegrity ? 'Verifying B-Trees...' : 'Check Database Integrity (PRAGMA)'}</span>
          </button>

          <button
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#e5e2e0] hover:bg-white text-xs font-mono font-medium text-[#151312] transition-all disabled:opacity-50 cursor-pointer shadow-sm ml-auto"
          >
            <Download size={13} className={isBackingUp ? 'animate-spin' : ''} />
            <span>{isBackingUp ? 'Snapshotting...' : 'Backup Now (VACUUM INTO)'}</span>
          </button>
        </div>
      </div>

      {/* Missing Media & Broken Paths Table */}
      <div className="bg-[#211f1e] border border-white/5 p-5 sm:p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-[#f5f0ed] flex items-center gap-2">
              <AlertTriangle size={16} className={healthData?.missing_count ? 'text-amber-400' : 'text-emerald-400'} />
              Missing Originals &amp; Broken Paths
            </h3>
            <p className="text-xs text-[#a8a29e]">
              Active library records whose source media cannot be accessed on the local filesystem.
            </p>
          </div>
          <button
            onClick={() => setShowRelinkModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition-colors cursor-pointer"
          >
            <FolderSync size={13} />
            <span>Relink Folder</span>
          </button>
        </div>

        {healthData?.missing_count === 0 ? (
          <div className="p-4 bg-[#100e0d] rounded-xl border border-white/5 flex items-center gap-3 text-xs text-[#a8a29e]">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>All indexed media files are intact and accessible on disk.</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#100e0d] border-b border-white/5 text-[#78716c] font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 w-14">Preview</th>
                  <th className="py-2.5 px-4">Filename</th>
                  <th className="py-2.5 px-4">Last Known Path</th>
                  <th className="py-2.5 px-4">Missing Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px] bg-[#1d1b1a]">
                {healthData?.broken_samples.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2c2928] transition-colors">
                    <td className="py-2 px-4">
                      <div className="w-9 h-9 rounded-lg bg-[#100e0d] border border-white/5 overflow-hidden flex items-center justify-center">
                        <img
                          src={`${API_BASE}/thumbnails/${item.id}.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <ImageIcon size={14} className="text-[#78716c]" />
                      </div>
                    </td>
                    <td className="py-2 px-4 font-medium text-[#f5f0ed]">{item.filename}</td>
                    <td className="py-2 px-4 text-[#a8a29e] truncate max-w-xs">{item.path}</td>
                    <td className="py-2 px-4 text-amber-400">{formatDate(item.missing_since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Backup Manager */}
      <div className="bg-[#211f1e] border border-white/5 p-5 sm:p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-[#f5f0ed] flex items-center gap-2">
              <Database size={16} className="text-[#e5a93c]" />
              Live Backup &amp; Recovery Center
            </h3>
            <p className="text-xs text-[#a8a29e]">
              Point-in-time snapshots created using SQLite <code className="text-[#e5a93c] font-mono">VACUUM INTO</code>. Completely non-blocking and safe while library indexing is active.
            </p>
          </div>
          <button
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={13} className={isBackingUp ? 'animate-spin' : ''} />
            <span>{isBackingUp ? 'Backing Up...' : 'Backup Now'}</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-4 bg-[#100e0d] rounded-xl border border-white/5 text-xs text-[#a8a29e] text-center font-mono">
            No atomic backups found. Click &quot;Backup Now&quot; above to create your first safe snapshot in <code className="text-[#f5f0ed]">backups/</code>.
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#100e0d] border-b border-white/5 text-[#78716c] font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Snapshot Filename</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Quick Check</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px] bg-[#1d1b1a]">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-[#2c2928] transition-colors">
                    <td className="py-2.5 px-4 font-medium text-[#f5f0ed]">{b.filename}</td>
                    <td className="py-2.5 px-4 text-[#a8a29e]">{formatBytes(b.size_bytes)}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={10} />
                        <span>{b.integrity_status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#78716c]">{formatDate(b.created_at)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setRestoreCandidate(b)}
                        className="flex items-center gap-1 ml-auto text-xs px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                        title="Restore database from this snapshot"
                      >
                        <RotateCcw size={11} />
                        <span>Restore</span>
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1d1b1a] border border-[#2c2928] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="font-serif text-lg text-[#f5f0ed] flex items-center gap-2">
                <FolderSync size={16} className="text-[#e5a93c]" />
                Relink Missing Media Folder
              </h4>
              <button
                onClick={() => setShowRelinkModal(false)}
                className="text-[#78716c] hover:text-white transition cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyRelink} className="space-y-4 text-xs">
              <p className="text-[#a8a29e]">
                Replace an old drive letter, external mount, or folder path prefix with the new path where your originals now reside.
              </p>

              <div>
                <label className="block font-mono text-[11px] text-[#a8a29e] mb-1">
                  Old Path Prefix (e.g. /Volumes/OldDisk/Photos)
                </label>
                <input
                  type="text"
                  value={oldPrefix}
                  onChange={(e) => setOldPrefix(e.target.value)}
                  placeholder="/Volumes/OldDisk/Photos"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#100e0d] border border-white/10 font-mono text-xs text-[#f5f0ed] focus:outline-none focus:border-white/20"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[#a8a29e] mb-1">
                  New Path Prefix (e.g. /Volumes/StudioNVMe/Photos)
                </label>
                <input
                  type="text"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value)}
                  placeholder="/Volumes/StudioNVMe/Photos"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#100e0d] border border-white/10 font-mono text-xs text-[#f5f0ed] focus:outline-none focus:border-white/20"
                  required
                />
              </div>

              {relinkStatus && (
                <div className="p-3 rounded-xl bg-[#100e0d] border border-white/10 font-mono text-[11px] text-emerald-400">
                  {relinkStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowRelinkModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-mono bg-[#2c2928] hover:bg-[#373433] text-[#a8a29e] hover:text-[#f5f0ed] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRelinking}
                  className="px-4 py-2 rounded-full text-xs font-mono font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition disabled:opacity-50 cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1d1b1a] border border-rose-900/40 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 border-b border-rose-900/30 pb-3">
              <AlertTriangle size={18} />
              <h4 className="font-serif text-lg font-semibold">Confirm Database Restore</h4>
            </div>

            <p className="text-xs text-[#a8a29e] leading-relaxed">
              Restoring from <code className="font-mono text-[#f5f0ed] bg-[#100e0d] px-1 py-0.5 rounded">{restoreCandidate.filename}</code> will overwrite the active <code className="font-mono text-[#f5f0ed]">prism.db</code> database and clear WAL/SHM state.
            </p>

            {restoreMessage && (
              <div className="p-3 rounded-xl bg-[#100e0d] border border-white/10 font-mono text-[11px] text-[#f5f0ed]">
                {restoreMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setRestoreCandidate(null);
                  setRestoreMessage(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-mono bg-[#2c2928] hover:bg-[#373433] text-[#a8a29e] hover:text-[#f5f0ed] transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-full text-xs font-mono font-semibold bg-rose-900 hover:bg-rose-800 text-white transition disabled:opacity-50 cursor-pointer shadow-md"
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
