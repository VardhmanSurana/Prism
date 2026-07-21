import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../constants';
import { Terminal, RefreshCw, Activity, HardDrive, Shield, Download, Upload } from 'lucide-react';

interface DiagnosticsData {
  status: string;
  python_version: string;
  platform: string;
  database_path: string;
  database_size_bytes: number;
  thumbnail_cache_size_bytes: number;
  sync_status: {
    is_running?: boolean;
    watched_folders?: string[];
    excluded_folders?: string[];
    queue_size?: number;
    processed_count?: number;
  };
  active_mounts: string[];
  watched_folders: string[];
  excluded_folders: string[];
  models_loaded: {
    florence: boolean;
    siglip: boolean;
  };
  features_enabled: {
    agent: boolean;
    inpainting: boolean;
    face: boolean;
    clip: boolean;
    rembg: boolean;
  };
}

export const DiagnosticsLogs: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [logs, setLogs] = useState<string>('Loading logs...');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/diagnostics`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch diagnostics', e);
    }
  };

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/logs?lines=150`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs);
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }
    } catch (e) {
      setLogs(`Failed to fetch logs: ${e}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    fetchLogs();

    let intervalId: any = null;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchDiagnostics();
        fetchLogs();
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/utilities/backup/export`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prism_backup.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreStatus({ type: 'info', message: 'Restoring backup... Please wait.' });
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/backup/restore`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to restore backup');
      }

      const json = await res.json();
      setRestoreStatus({ type: 'success', message: json.message || 'Backup successfully restored. Application restart is required.' });
    } catch (err: any) {
      setRestoreStatus({ type: 'error', message: err.message || 'Restore failed.' });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const highlightLogs = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let colorClass = 'text-[#8a8f98]';
      if (line.includes('ERROR') || line.includes('CRITICAL') || line.includes('Traceback')) colorClass = 'text-red-400 font-semibold';
      else if (line.includes('WARNING')) colorClass = 'text-amber-400';
      else if (line.includes('INFO')) colorClass = 'text-emerald-400';
      else if (line.includes('DEBUG')) colorClass = 'text-[#62666d]';
      
      return (
        <div key={idx} className={`${colorClass} leading-relaxed`}>
          {line}
        </div>
      );
    });
  };

  const DiagRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500">{label}</span>
      <span className="text-[11px] font-mono text-[#d0d6e0] truncate max-w-[200px]" title={value}>{value}</span>
    </div>
  );

  return (
    <div className="divide-y divide-white/[0.04] space-y-12">
      {/* System Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4 first:pt-0">
        <div className="lg:col-span-1 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className="text-[#5e6ad2]" />
            <h4 className="font-serif italic text-white text-xl leading-tight">
              Diagnostics Metadata
            </h4>
          </div>
          <p className="text-xs text-[#8a8f98] leading-relaxed">
            Monitor real-time engine health metadata, active vision networks, SQLite sizes, database targets, and runtime system models loaded in the memory sandbox.
          </p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-5 shadow-xl">
            <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-gray-500 block mb-3">
              Environment & Database
            </span>
            <div className="space-y-0">
              <DiagRow label="Platform" value={data?.platform || '...'} />
              <DiagRow label="Python" value={data?.python_version.split(' ')[0] || '...'} />
              <DiagRow label="DB Path" value={data ? data.database_path.replace(/\/home\/[^/]+/, '~') : '...'} />
              <DiagRow label="DB Size" value={data ? formatBytes(data.database_size_bytes) : '...'} />
              <DiagRow label="Cache Size" value={data ? formatBytes(data.thumbnail_cache_size_bytes) : '...'} />
            </div>
          </div>

          <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-gray-500 block mb-3">
                AI Models & Settings
              </span>
              
              <div className="mb-3">
                <p className="text-[10px] font-mono text-gray-500 mb-2">Active Modules</p>
                <div className="flex flex-wrap gap-1.5">
                  {data?.features_enabled && Object.entries(data.features_enabled).map(([key, enabled]) => (
                    <span 
                      key={key}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border ${
                        enabled 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-white/[0.02] border-white/[0.05] text-gray-600'
                      }`}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.04] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-500">Florence (Vision)</span>
                <span className={`text-[10px] font-mono font-semibold ${data?.models_loaded.florence ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {data?.models_loaded.florence ? 'Loaded' : 'Idle'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-500">SigLIP (Search)</span>
                <span className={`text-[10px] font-mono font-semibold ${data?.models_loaded.siglip ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {data?.models_loaded.siglip ? 'Loaded' : 'Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup & Recovery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
        <div className="lg:col-span-1 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-[#5e6ad2]" />
            <h4 className="font-serif italic text-white text-xl leading-tight">
              Vault Backup
            </h4>
          </div>
          <p className="text-xs text-[#8a8f98] leading-relaxed">
            Export the system settings, library directory settings, face configuration datasets, and catalog index files to a singular zip backup. Reconstruct your catalog at any point.
          </p>
        </div>

        <div className="lg:col-span-2 bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleExportBackup}
              disabled={isExporting}
              title="Download a ZIP backup of your database and settings"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#5e6ad2] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#828fff] disabled:opacity-40 transition-all duration-150 active:scale-[0.98] shadow-[0_0_15px_rgba(94,106,210,0.3)]"
            >
              <Download size={12} />
              <span>{isExporting ? 'Exporting...' : 'Export Backup ZIP'}</span>
            </button>

            <button 
              onClick={handleImportClick}
              title="Upload a previously exported Prism backup ZIP file"
              className="flex items-center gap-2 px-5 py-2.5 bg-transparent border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02] text-[#d0d6e0] hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-[0.98]"
            >
              <Upload size={12} />
              <span>Import Backup ZIP</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".zip" 
              className="hidden"
            />
          </div>

          {restoreStatus && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-xs font-mono border ${
              restoreStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              restoreStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#828fff]'
            }`}>
              {restoreStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
        <div className="lg:col-span-1 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={16} className="text-[#5e6ad2]" />
            <h4 className="font-serif italic text-white text-xl leading-tight">
              Logs Stream
            </h4>
          </div>
          <p className="text-xs text-[#8a8f98] leading-relaxed">
            Expose raw stdout streams directly from the local background daemon. Check for ingestion errors, model loading speeds, and database queries.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl bg-black">
            {/* macOS style title bar */}
            <div className="bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[10px] font-mono text-gray-500 ml-2">backend.log - stream</span>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-mono text-gray-500">
                {lastRefreshed && (
                  <span className="text-[10px] font-mono text-gray-600" title="Last refreshed">
                    Synced {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                <span className="text-white/10">|</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-300 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={autoRefresh} 
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-white/[0.1] bg-black text-[#5e6ad2] focus:ring-[#5e6ad2] w-3 h-3 cursor-pointer"
                  />
                  <span>Auto-sync</span>
                </label>
                <span className="text-white/10">|</span>
                <button 
                  onClick={fetchLogs}
                  disabled={isRefreshing}
                  className="hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={9} />
                  <span>Sync</span>
                </button>
              </div>
            </div>

            <div 
              ref={logContainerRef}
              className="p-4 h-64 overflow-y-auto font-mono text-[10px] leading-relaxed bg-[#020203] select-text whitespace-pre-wrap custom-scrollbar"
            >
              {highlightLogs(logs)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

