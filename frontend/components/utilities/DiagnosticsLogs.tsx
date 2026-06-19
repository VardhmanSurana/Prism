import React, { useState, useEffect, useRef } from 'react';
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
      let colorClass = 'text-[#62666d]';
      if (line.includes('ERROR') || line.includes('CRITICAL') || line.includes('Traceback')) colorClass = 'text-[#e5484d]';
      else if (line.includes('WARNING')) colorClass = 'text-[#f5a623]';
      else if (line.includes('INFO')) colorClass = 'text-[#27a644]';
      else if (line.includes('DEBUG')) colorClass = 'text-[#8a8f98]';
      
      return (
        <div key={idx} className={`${colorClass} leading-relaxed`}>
          {line}
        </div>
      );
    });
  };

  const DiagRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-[#23252a]/50 last:border-0">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#8a8f98]">{label}</span>
      <span className="text-[11px] font-mono text-[#d0d6e0] truncate max-w-[200px]" title={value}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* System Diagnostics */}
      <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6">
        <div className="mb-5">
          <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
            System Diagnostics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-3">
              Environment & System
            </p>
            <div className="space-y-0">
              <DiagRow label="Platform" value={data?.platform || '...'} />
              <DiagRow label="Python" value={data?.python_version.split(' ')[0] || '...'} />
              <DiagRow label="DB Path" value={data ? data.database_path.replace(/\/home\/[^/]+/, '~') : '...'} />
              <DiagRow label="DB Size" value={data ? formatBytes(data.database_size_bytes) : '...'} />
              <DiagRow label="Cache Size" value={data ? formatBytes(data.thumbnail_cache_size_bytes) : '...'} />
            </div>
          </div>

          <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-3">
              AI Models & Settings
            </p>
            
            <div className="mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#8a8f98] mb-2">Active Modules</p>
              <div className="flex flex-wrap gap-1.5">
                {data?.features_enabled && Object.entries(data.features_enabled).map(([key, enabled]) => (
                  <span 
                    key={key}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border ${
                      enabled 
                        ? 'bg-[#27a644]/10 border-[#27a644]/20 text-[#27a644]' 
                        : 'bg-[#141516] border-[#23252a] text-[#62666d]'
                    }`}
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-0">
              <div className="flex items-center justify-between py-2 border-b border-[#23252a]/50">
                <span className="text-[10px] font-mono text-[#8a8f98]">Florence (Vision)</span>
                <span className={`text-[10px] font-mono ${data?.models_loaded.florence ? 'text-[#27a644]' : 'text-[#62666d]'}`}>
                  {data?.models_loaded.florence ? 'Loaded' : 'Idle'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[10px] font-mono text-[#8a8f98]">SigLIP (Search)</span>
                <span className={`text-[10px] font-mono ${data?.models_loaded.siglip ? 'text-[#27a644]' : 'text-[#62666d]'}`}>
                  {data?.models_loaded.siglip ? 'Loaded' : 'Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Backup & Recovery */}
      <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6">
        <div className="mb-4">
          <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
            Vault Backup & Recovery
          </h3>
        </div>

        <p className="text-xs text-[#8a8f98] mb-5 leading-relaxed">
          Export the system settings, library directory settings, face configuration datasets, and catalog index files to a singular zip backup. Reconstruct your catalog at any point.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={handleExportBackup}
            disabled={isExporting}
            title="Download a ZIP backup of your database and settings"
            className="px-5 py-2.5 bg-[#5e6ad2] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#828fff] disabled:opacity-40 transition-colors"
          >
            {isExporting ? 'Exporting...' : 'Export System Backup'}
          </button>

          <button 
            onClick={handleImportClick}
            title="Upload a previously exported Prism backup ZIP file"
            className="px-5 py-2.5 bg-[#0c0c0c] border border-[#23252a] text-[#d0d6e0] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#141516] transition-colors"
          >
            Import System Backup
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
          <div className={`mt-4 px-4 py-3 rounded-lg text-xs font-mono ${
            restoreStatus.type === 'success' ? 'bg-[#27a644]/10 border border-[#27a644]/20 text-[#27a644]' :
            restoreStatus.type === 'error' ? 'bg-[#e5484d]/10 border border-[#e5484d]/20 text-[#e5484d]' :
            'bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2]'
          }`}>
            {restoreStatus.message}
          </div>
        )}
      </section>

      {/* Live Logs */}
      <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
            Live Logs Stream
          </h3>
          
          <div className="flex items-center gap-4">
            {lastRefreshed && (
              <span className="text-[10px] font-mono text-[#62666d]" title="Last refreshed">
                {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer" title="Toggle auto-refresh">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 rounded-full bg-[#1c1d1f] peer-checked:bg-[#5e6ad2] transition-colors">
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-[10px] font-mono text-[#8a8f98] uppercase tracking-wider">Auto</span>
            </label>

            <button 
              onClick={fetchLogs}
              disabled={isRefreshing}
              title="Force refresh logs"
              className="px-3 py-1.5 bg-[#050505] border border-[#23252a] text-[#8a8f98] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:text-[#d0d6e0] hover:border-[#34343a] disabled:opacity-40 transition-all"
            >
              {isRefreshing ? '...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="bg-[#050505] border border-[#23252a] rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-[#23252a]">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d]">Live Output</span>
          </div>
          <div 
            ref={logContainerRef}
            className="p-4 max-h-[400px] overflow-y-auto font-mono text-[11px] leading-relaxed"
          >
            {highlightLogs(logs)}
          </div>
        </div>
      </section>
    </div>
  );
};
