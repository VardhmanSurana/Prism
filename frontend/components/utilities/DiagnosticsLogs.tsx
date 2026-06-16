import React, { useState, useEffect, useRef } from 'react';
import { Activity, Download, Upload, Terminal, RefreshCw, Server, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE } from '../../constants';

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
        // Scroll to bottom on load
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

  // Poll for logs & diagnostics
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
      let colorClass = 'text-gray-400';
      if (line.includes('ERROR') || line.includes('✗')) {
        colorClass = 'text-rose-400 font-bold';
      } else if (line.includes('WARNING')) {
        colorClass = 'text-yellow-400';
      } else if (line.includes('INFO') || line.includes('✓')) {
        colorClass = 'text-emerald-400/90';
      } else if (line.includes('DEBUG')) {
        colorClass = 'text-blue-400/80';
      }
      return (
        <div key={idx} className={`${colorClass} leading-5`}>
          {line}
        </div>
      );
    });
  };

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Diagnostics Grid */}
      <section className="reveal-item space-y-6" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-primary" />
          <h3 className="text-xl font-serif italic text-white">System Diagnostics</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardware & Environment */}
          <div className="bg-surface border border-white/5 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-medium mb-2">
              <Server size={16} className="text-primary" />
              <span>Environment & System</span>
            </div>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">Platform</span>
                <span className="text-gray-300 text-right max-w-[180px] truncate">{data?.platform || 'Loading...'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">Python Version</span>
                <span className="text-gray-300 text-right max-w-[180px] truncate">{data?.python_version.split(' ')[0] || 'Loading...'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">DB Path</span>
                <span className="text-gray-300 text-right max-w-[180px] truncate" title={data?.database_path}>
                  {data ? data.database_path.replace(/\/home\/[^/]+/, '~') : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">DB Size</span>
                <span className="text-primary font-bold">{data ? formatBytes(data.database_size_bytes) : 'Loading...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cache Size</span>
                <span className="text-primary font-bold">{data ? formatBytes(data.thumbnail_cache_size_bytes) : 'Loading...'}</span>
              </div>
            </div>
          </div>

          {/* AI Intelligence & Models Status */}
          <div className="bg-surface border border-white/5 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-medium mb-2">
              <Activity size={16} className="text-primary" />
              <span>AI Models & Settings</span>
            </div>
            <div className="space-y-3 text-xs font-mono">
              {/* Feature Flags */}
              <div className="border-b border-white/5 pb-3">
                <span className="text-gray-500 block mb-2">AI Modules Status</span>
                <div className="flex flex-wrap gap-2">
                  {data?.features_enabled && Object.entries(data.features_enabled).map(([key, enabled]) => (
                    <span 
                      key={key} 
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full border font-bold
                        ${enabled 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-white/5 border-white/5 text-gray-500'}`}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>

              {/* Models Loaded */}
              <div className="space-y-2 pt-1">
                <span className="text-gray-500 block">Active VRAM / Models</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Florence (Vision Pipeline)</span>
                  <span className="flex items-center gap-1.5">
                    {data?.models_loaded.florence ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider">Loaded</span>
                      </>
                    ) : (
                      <span className="text-gray-600 uppercase text-[9px] tracking-wider">Idle / Unloaded</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">SigLIP (Semantic Search)</span>
                  <span className="flex items-center gap-1.5">
                    {data?.models_loaded.siglip ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider">Loaded</span>
                      </>
                    ) : (
                      <span className="text-gray-600 uppercase text-[9px] tracking-wider">Idle / Unloaded</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Backup & Restore */}
      <section className="reveal-item space-y-6" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-3">
          <Download size={20} className="text-primary" />
          <h3 className="text-xl font-serif italic text-white">Vault backup & recovery</h3>
        </div>

        <div className="bg-surface border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <p className="text-xs text-gray-400">
            Export the system settings, library directory settings, face configuration datasets, and catalog index files to a singular zip backup. Reconstruct your catalog at any point.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button 
              onClick={handleExportBackup}
              disabled={isExporting}
              title="Download a ZIP backup of your database and settings"
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-xs font-bold uppercase tracking-wider py-3.5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              {isExporting ? (
                <RefreshCw size={14} className="animate-spin text-primary" />
              ) : (
                <Download size={14} className="text-primary" />
              )}
              <span>Export System Backup</span>
            </button>

            <button 
              onClick={handleImportClick}
              title="Upload a previously exported Prism backup ZIP file"
              className="flex-1 flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold uppercase tracking-wider py-3.5 px-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/15 active:scale-98"
            >
              <Upload size={14} />
              <span>Import System Backup</span>
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
            <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-1
              ${restoreStatus.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : restoreStatus.type === 'error' 
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
            >
              {restoreStatus.type === 'success' && <CheckCircle2 size={16} />}
              {restoreStatus.type === 'error' && <XCircle size={16} />}
              {restoreStatus.type === 'info' && <RefreshCw size={16} className="animate-spin" />}
              <span className="text-xs font-mono">{restoreStatus.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Live Logs Tailing */}
      <section className="reveal-item space-y-6" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-primary" />
            <h3 className="text-xl font-serif italic text-white">Live logs stream</h3>
          </div>
          
          <div className="flex items-center gap-4">
            {lastRefreshed && (
              <span className="text-[9px] font-mono text-gray-600" title="Last refreshed timestamp">
                {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none" title="Toggle automatic 5-second refresh interval">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-white/10 bg-black/40 text-primary focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[10px] uppercase font-mono tracking-widest text-gray-500 hover:text-gray-300 transition-colors">Auto-Refresh</span>
            </label>

            <button 
              onClick={fetchLogs}
              disabled={isRefreshing}
              title="Force refresh logs and diagnostics"
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
        </div>

        <div className="bg-[#070707] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden flex flex-col h-[320px]">
          <div className="absolute top-4 left-6 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[8px] font-mono tracking-widest text-gray-600 uppercase">Live Output</span>
          </div>

          <div 
            ref={logContainerRef}
            className="flex-1 overflow-y-auto mt-4 pr-2 font-mono text-[10px] text-gray-400 custom-scrollbar select-text space-y-1"
          >
            {highlightLogs(logs)}
          </div>
        </div>
      </section>
    </div>
  );
};
