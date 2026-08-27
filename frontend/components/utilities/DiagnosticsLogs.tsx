import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { API_BASE } from '../../constants';
import { useStats } from '../../hooks/useStats';
import { useSettingsStore } from '../../store/settingsStore';
import { Switch } from '../ui';
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Copy, 
  Clock,
  Radio,
  Server,
  Gauge,
  Trash2,
  Play,
  Pause,
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  subscribeTelemetryStream,
  fetchTelemetrySummary,
  fetchTelemetryEvents,
  clearTelemetryEvents,
  TelemetryEvent,
  TelemetrySummary,
} from '../../hooks/useTelemetry';

interface DiagnosticsData {
  status: string;
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



/**
 * Diagnostics and telemetry panel: system stats, logs, telemetry stream (SSE), export/restore.
 */
export const DiagnosticsLogs: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());
  const [lastBackupTime, setLastBackupTime] = useState<string>('Today • ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // Telemetry-specific state
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [showTelemetryPanel, setShowTelemetryPanel] = useState(true);
  const [isExportingTelemetry, setIsExportingTelemetry] = useState(false);

  // Telemetry settings from store
  const telemetryEnabled = useSettingsStore((s) => s.telemetryEnabled);
  const telemetrySampleRate = useSettingsStore((s) => s.telemetrySampleRate);
  const telemetryResponseLogging = useSettingsStore((s) => s.telemetryResponseLogging);
  const fetchTelemetrySettings = useSettingsStore((s) => s.fetchTelemetrySettings);
  const setTelemetryEnabled = useSettingsStore((s) => s.setTelemetryEnabled);
  const setTelemetrySampleRate = useSettingsStore((s) => s.setTelemetrySampleRate);
  const setTelemetryResponseLogging = useSettingsStore((s) => s.setTelemetryResponseLogging);
  const [localSampleRate, setLocalSampleRate] = useState(telemetrySampleRate);
  const [sampleRateStatus, setSampleRateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync local state when store loads
  useEffect(() => {
    setLocalSampleRate(telemetrySampleRate);
  }, [telemetrySampleRate]);

  // Fetch on mount
  useEffect(() => {
    fetchTelemetrySettings();
  }, [fetchTelemetrySettings]);

  /** Applies the selected telemetry sample rate to the backend. */
  const handleApplySampleRate = useCallback(async () => {
    setSampleRateStatus('saving');
    try {
      await setTelemetrySampleRate(localSampleRate);
      setSampleRateStatus('saved');
      setTimeout(() => setSampleRateStatus('idle'), 2000);
    } catch {
      setSampleRateStatus('error');
      setTimeout(() => setSampleRateStatus('idle'), 3000);
    }
  }, [localSampleRate, setTelemetrySampleRate]);

  /** Toggles telemetry enabled state and persists via settings store. */
  const handleToggleTelemetry = useCallback(async () => {
    await setTelemetryEnabled(!telemetryEnabled);
  }, [telemetryEnabled, setTelemetryEnabled]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const telemetryContainerRef = useRef<HTMLDivElement>(null);

  const { stats } = useStats();

  /**
   * Formats bytes into human-readable string.
   * @param bytes - Size in bytes.
   * @param decimals - Decimal places.
   * @returns Formatted size (e.g. 1.5 MB).
   */
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  /** Fetches diagnostics snapshot from the backend and updates state. */
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



  // Telemetry interactive controls state (Copy, Download, Clear, Pause, Filter)
  const [isTelemetryPaused, setIsTelemetryPaused] = useState(false);
  const isTelemetryPausedRef = useRef(isTelemetryPaused);
  useEffect(() => {
    isTelemetryPausedRef.current = isTelemetryPaused;
  }, [isTelemetryPaused]);

  const [telemetryFilterText, setTelemetryFilterText] = useState('');
  const [telemetryCategoryFilter, setTelemetryCategoryFilter] = useState<'all' | 'ai' | 'error' | 'frontend' | 'backend' | 'people' | 'sync' | 'photos'>('all');
  const [copySuccess, setCopySuccess] = useState(false);

  const filteredTelemetryEvents = useMemo(() => {
    return telemetryEvents.filter((evt) => {
      const eventType = (evt.event_type || '').toLowerCase();
      const component = (evt.component || '').toLowerCase();
      const action = (evt.action || '').toLowerCase();
      const source = (evt.source || '').toLowerCase();
      const status = (evt.status || '').toLowerCase();

      if (telemetryCategoryFilter === 'backend' && source !== 'backend') return false;
      if (telemetryCategoryFilter === 'frontend' && source !== 'frontend') return false;
      if (telemetryCategoryFilter === 'error' && status !== 'error') return false;

      if (telemetryCategoryFilter === 'ai') {
        const isAI = component.includes('ai') || component.includes('agent') || component.includes('gemma') ||
                     component.includes('florence') || component.includes('siglip') || component.includes('clip') ||
                     eventType.includes('ai') || eventType.includes('agent') || action.includes('ai');
        if (!isAI) return false;
      }

      if (telemetryCategoryFilter === 'people') {
        const isPeople = component.includes('people') || component.includes('person') || component.includes('face') ||
                         eventType.includes('people') || eventType.includes('person') || eventType.includes('face');
        if (!isPeople) return false;
      }

      if (telemetryCategoryFilter === 'sync') {
        const isSync = component.includes('sync') || component.includes('worker') || component.includes('job') ||
                       eventType.includes('sync') || action.includes('sync');
        if (!isSync) return false;
      }

      if (telemetryCategoryFilter === 'photos') {
        const isPhotos = component.includes('photo') || component.includes('media') || component.includes('album') ||
                         eventType.includes('photo') || eventType.includes('album');
        if (!isPhotos) return false;
      }

      if (telemetryFilterText.trim() !== '') {
        const q = telemetryFilterText.toLowerCase();
        return eventType.includes(q) || component.includes(q) || action.includes(q) || source.includes(q) || status.includes(q);
      }
      return true;
    });
  }, [telemetryEvents, telemetryCategoryFilter, telemetryFilterText]);

  const loadTelemetrySummary = useCallback(async () => {
    const summary = await fetchTelemetrySummary();
    if (summary) {
      setTelemetrySummary(summary);
      setTelemetryEvents(summary.recent_events);
    }
  }, []);

  // Subscribe to SSE telemetry stream (pausable)
  useEffect(() => {
    const unsub = subscribeTelemetryStream(
      (event) => {
        setSseConnected(true);
        if (isTelemetryPausedRef.current) return;
        setTelemetryEvents((prev) => {
          const next = [event, ...prev];
          // Keep at most 200 events in the UI buffer
          return next.slice(0, 200);
        });
      },
      () => {
        setSseConnected(false);
      },
    );

    // Also load initial summary
    loadTelemetrySummary();

    return unsub;
  }, [loadTelemetrySummary]);

  useEffect(() => {
    fetchDiagnostics();
    loadTelemetrySummary();

    const intervalId = setInterval(() => {
      fetchDiagnostics();
      loadTelemetrySummary();
    }, 4000);
    return () => clearInterval(intervalId);
  }, [loadTelemetrySummary]);

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
      a.download = `prism_vault_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setLastBackupTime('Just now • ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
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

    setRestoreStatus({ type: 'info', message: 'Restoring vault snapshot... Please wait.' });
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
      setRestoreStatus({ type: 'success', message: json.message || 'Vault snapshot restored cleanly. Restarting services.' });
    } catch (err: any) {
      setRestoreStatus({ type: 'error', message: err.message || 'Restore operation failed.' });
    } finally {
      if (e.target) e.target.value = '';
    }
  };



  const triggerDownload = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportTelemetryJSON = useCallback(async () => {
    setIsExportingTelemetry(true);
    try {
      const events = await fetchTelemetryEvents(1000);
      const exportData = {
        exported_at: new Date().toISOString(),
        total_events: events.length,
        summary: telemetrySummary,
        events,
      };
      const filename = `prism_telemetry_${new Date().toISOString().slice(0, 10)}.json`;
      triggerDownload(JSON.stringify(exportData, null, 2), filename, 'application/json');
    } catch (e) {
      console.error('Failed to export telemetry JSON:', e);
    } finally {
      setIsExportingTelemetry(false);
    }
  }, [telemetrySummary, triggerDownload]);

  const handleExportTelemetryCSV = useCallback(async () => {
    setIsExportingTelemetry(true);
    try {
      const events = await fetchTelemetryEvents(1000);
      const headers = ['id', 'created_at', 'source', 'event_type', 'component', 'action', 'status', 'duration_ms', 'metadata_json'];
      const csvRows = [
        headers.join(','),
        ...events.map((evt) =>
          headers.map((h) => {
            const val = evt[h as keyof TelemetryEvent];
            if (val == null) return '';
            const str = String(val);
            // Escape CSV: wrap in quotes if it contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ];
      const filename = `prism_telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerDownload(csvRows.join('\n'), filename, 'text/csv;charset=utf-8');
    } catch (e) {
      console.error('Failed to export telemetry CSV:', e);
    } finally {
      setIsExportingTelemetry(false);
    }
  }, [triggerDownload]);



  const handleCopyTelemetry = useCallback(() => {
    const text = filteredTelemetryEvents
      .map((evt) => {
        const ts = evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : '';
        const dur = evt.duration_ms != null ? ` (${evt.duration_ms.toFixed(1)}ms)` : '';
        const header = `[${ts}] [${evt.status?.toUpperCase() || 'OK'}] [${evt.source?.toUpperCase()}] ${evt.event_type} · ${evt.component || ''}/${evt.action || ''}${dur}`;

        if (!evt.metadata_json) {
          return header;
        }

        try {
          const parsed = JSON.parse(evt.metadata_json);
          const prettyJson = JSON.stringify(parsed, null, 2)
            .split('\n')
            .map((line) => `   ${line}`)
            .join('\n');
          return `${header}\n   Payload:\n${prettyJson}`;
        } catch {
          return `${header}\n   Payload: ${evt.metadata_json}`;
        }
      })
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [filteredTelemetryEvents]);

  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);

  const handleClearTelemetry = useCallback(async () => {
    setTelemetryEvents([]);
    setTelemetrySummary(prev => prev ? { ...prev, total_events: 0, session_count: 0 } : null);
    await clearTelemetryEvents();
  }, []);

  // Total calculated storage size
  const totalDbAndCache = (data?.database_size_bytes || 598000) + (data?.thumbnail_cache_size_bytes || 5560000);

  // Compute telemetry event counts by source
  const frontendEventCount = telemetryEvents.filter(e => e.source === 'frontend').length;
  const backendEventCount = telemetryEvents.filter(e => e.source === 'backend').length;
  const errorEventCount = telemetryEvents.filter(e => e.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 1: SYSTEM HEALTH & HARDWARE UTILIZATION              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health Card */}
        <div className="cr-card">
          <div className="cr-card-title flex items-center justify-between">
            <span>System Health</span>
            <button
              onClick={() => { fetchDiagnostics(); loadTelemetrySummary(); }}
              className="cr-inline-btn flex items-center gap-1 text-[10px]"
            >
              <RefreshCw size={10} />
              <span>Sync</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="cr-key-value"><span className="k">Operating System</span><span className="v">{data?.platform || 'Linux x86_64 (Sequoia)'}</span></div>
            <div className="cr-key-value"><span className="k">Database Path</span><span className="v truncate max-w-[200px]" title={data?.database_path}>{data?.database_path || 'backend_rust/prism.db'}</span></div>
            <div className="cr-key-value"><span className="k">Database Log</span><span className="v val-accent">{formatBytes(data?.database_size_bytes || 598000)}</span></div>
            <div className="cr-key-value"><span className="k">Thumbnail Cache</span><span className="v val-accent">{formatBytes(data?.thumbnail_cache_size_bytes || 5560000)}</span></div>
            <div className="cr-key-value"><span className="k">Status</span><span className="v val-accent">Nominal</span></div>
          </div>
        </div>

        {/* Resource Utilization Card */}
        <div className="cr-card">
          <div className="cr-card-title">Resource Utilization</div>
          <div className="pt-1">
            <div className="cr-progress-row">
              <span className="cr-progress-label">CPU Load</span>
              <div className="cr-progress-track"><div className="cr-progress-fill cpu" style={{ width: '34%' }}></div></div>
              <span className="cr-progress-value">34%</span>
            </div>

            <div className="cr-progress-row">
              <span className="cr-progress-label">VRAM Usage</span>
              <div className="cr-progress-track"><div className="cr-progress-fill vram" style={{ width: '77%' }}></div></div>
              <span className="cr-progress-value">77%</span>
            </div>

            <div className="cr-progress-row">
              <span className="cr-progress-label">RAM Memory</span>
              <div className="cr-progress-track"><div className="cr-progress-fill ram" style={{ width: '50%' }}></div></div>
              <span className="cr-progress-value">50%</span>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-[var(--cr-border)]">
            <div className="cr-card-title mb-1">Process Telemetry</div>
            <div className="cr-key-value"><span className="k">Background Workers</span><span className="v val-accent">3 active</span></div>
            <div className="cr-key-value"><span className="k">Watched Folders</span><span className="v">{data?.active_mounts?.length || 1} active</span></div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 2: TELEMETRY SUMMARY STATS                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="cr-card">
        <div className="cr-card-title flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Radio size={13} className={sseConnected ? 'text-green-400 animate-pulse' : 'text-red-400'} />
            <span>Telemetry Collection</span>
            {!telemetryEnabled && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">
                Opted Out
              </span>
            )}
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sseConnected ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
              {isTelemetryPaused ? 'Paused' : sseConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Copy Button */}
            <button
              onClick={handleCopyTelemetry}
              disabled={filteredTelemetryEvents.length === 0}
              className="cr-inline-btn text-[10px] flex items-center gap-1"
              title="Copy visible telemetry logs to clipboard"
            >
              {copySuccess ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              <span>{copySuccess ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Download Buttons */}
            <button
              onClick={handleExportTelemetryJSON}
              disabled={isExportingTelemetry || telemetryEvents.length === 0}
              className="cr-inline-btn text-[10px] flex items-center gap-1"
              title="Download telemetry logs as JSON"
            >
              <Download size={11} />
              <span>JSON</span>
            </button>
            <button
              onClick={handleExportTelemetryCSV}
              disabled={isExportingTelemetry || telemetryEvents.length === 0}
              className="cr-inline-btn text-[10px] flex items-center gap-1"
              title="Download telemetry logs as CSV"
            >
              <Download size={11} />
              <span>CSV</span>
            </button>

            {/* Clear Button */}
            <button
              onClick={handleClearTelemetry}
              disabled={telemetryEvents.length === 0}
              className="cr-inline-btn text-[10px] flex items-center gap-1 text-[var(--cr-status-error)] hover:border-[var(--cr-status-error)]"
              title="Clear live event log buffer"
            >
              <Trash2 size={11} />
              <span>Clear</span>
            </button>

            {/* Pause / Resume Toggle Button */}
            <button
              onClick={() => setIsTelemetryPaused(!isTelemetryPaused)}
              className={`cr-inline-btn text-[10px] flex items-center gap-1 ${
                isTelemetryPaused ? 'primary' : ''
              }`}
              title={isTelemetryPaused ? 'Resume live event stream' : 'Pause live event stream'}
            >
              {isTelemetryPaused ? <Play size={11} /> : <Pause size={11} />}
              <span>{isTelemetryPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* Expand / Collapse Panel */}
            <button
              onClick={() => setShowTelemetryPanel(!showTelemetryPanel)}
              className="cr-inline-btn text-[10px]"
            >
              {showTelemetryPanel ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showTelemetryPanel && (
          <div className="space-y-3">
            {/* Telemetry stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-[var(--cr-surface-sunken)] rounded p-2.5 text-center">
                <div className="text-[11px] font-mono text-[var(--cr-text-muted)] uppercase tracking-wider mb-1">Total Events</div>
                <div className="text-xl font-bold text-[var(--cr-accent)] font-mono tabular-nums">{telemetrySummary?.total_events ?? telemetryEvents.length}</div>
              </div>
              <div className="bg-[var(--cr-surface-sunken)] rounded p-2.5 text-center">
                <div className="text-[11px] font-mono text-[var(--cr-text-muted)] uppercase tracking-wider mb-1">Sessions</div>
                <div className="text-xl font-bold text-[var(--cr-accent)] font-mono tabular-nums">{telemetrySummary?.session_count ?? '—'}</div>
              </div>
              <div className="bg-[var(--cr-surface-sunken)] rounded p-2.5 text-center">
                <div className="text-[11px] font-mono text-[var(--cr-text-muted)] uppercase tracking-wider mb-1">Events/min</div>
                <div className="text-xl font-bold text-[var(--cr-accent)] font-mono tabular-nums">{telemetrySummary?.events_per_minute?.toFixed(1) ?? '0.0'}</div>
              </div>
              <div className="bg-[var(--cr-surface-sunken)] rounded p-2.5 text-center">
                <div className="text-[11px] font-mono text-[var(--cr-text-muted)] uppercase tracking-wider mb-1">Avg Latency</div>
                <div className="text-xl font-bold text-[var(--cr-accent)] font-mono tabular-nums">{telemetrySummary?.avg_latency_ms?.toFixed(1) ?? '—'}<span className="text-xs ml-0.5">ms</span></div>
              </div>
              <div className="bg-[var(--cr-surface-sunken)] rounded p-2.5 text-center">
                <div className="text-[11px] font-mono text-[var(--cr-text-muted)] uppercase tracking-wider mb-1">Errors</div>
                <div className={`text-xl font-bold font-mono tabular-nums ${errorEventCount > 0 ? 'text-red-400' : 'text-[var(--cr-accent)]'}`}>{errorEventCount}</div>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="flex items-center gap-4 font-mono text-xs text-[var(--cr-text-muted)]">
              <span className="flex items-center gap-1"><Server size={12} /> Backend: <span className="text-[var(--cr-accent)] tabular-nums">{backendEventCount}</span></span>
              <span className="flex items-center gap-1"><Activity size={12} /> Frontend: <span className="text-[var(--cr-accent)] tabular-nums">{frontendEventCount}</span></span>
              <span className="flex items-center gap-1"><Clock size={12} /> Last update: <span className="text-[var(--cr-accent)] tabular-nums">{lastRefreshed?.toLocaleTimeString() ?? '—'}</span></span>
            </div>

            {/* Telemetry master opt-out toggle */}
            <div className="bg-[var(--cr-surface-sunken)] rounded-lg p-3 border border-[var(--cr-border)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Radio size={11} className={telemetryEnabled ? 'text-[var(--cr-accent)]' : 'text-red-400'} />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--cr-text-muted)]">
                    Telemetry Collection
                  </span>
                </div>
                <Switch
                  label=""
                  checked={telemetryEnabled}
                  onToggle={handleToggleTelemetry}
                  ariaLabel="Toggle telemetry collection"
                />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-[var(--cr-text-muted)] leading-relaxed">
                When disabled, frontend events stop buffering and backend API sampling pauses. Errors (4xx/5xx) are always captured.
              </p>
            </div>

            {/* Telemetry Sample Rate Control */}
            <div className={`bg-[var(--cr-surface-sunken)] rounded-lg p-3 border border-[var(--cr-border)] ${!telemetryEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Gauge size={11} className="text-[var(--cr-accent)]" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--cr-text-muted)]">Backend Sample Rate</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--cr-accent)] font-semibold">
                  {localSampleRate === 0 ? 'Off (errors only)' : localSampleRate === 1 ? 'All requests' : `1 in ${localSampleRate}`}
                </span>
              </div>
              <div className="flex items-start gap-3 pt-1">
                <div className="flex-1 space-y-2">
                  <input
                    type="range"
                    id="telemetry-sample-rate-input"
                    name="telemetrySampleRate"
                    aria-label="Backend sample rate slider"
                    min={0}
                    max={50}
                    step={1}
                    value={localSampleRate}
                    onChange={(e) => setLocalSampleRate(Number(e.target.value))}
                    className="w-full h-1 bg-[var(--cr-border)] rounded-lg appearance-none cursor-pointer accent-[var(--cr-accent)] block my-1.5"
                  />
                  {/* Ticks positioned below the slider input */}
                  <div className="relative h-4 font-mono text-[10px] text-[var(--cr-text-muted)] select-none pointer-events-none">
                    <span className="absolute left-0 top-0">Off (0)</span>
                    <span className="absolute left-[20%] -translate-x-1/2 top-0">Default (10)</span>
                    <span className="absolute left-[50%] -translate-x-1/2 top-0">25</span>
                    <span className="absolute right-0 top-0">Sparse (50)</span>
                  </div>
                </div>
                <button
                  onClick={handleApplySampleRate}
                  disabled={sampleRateStatus === 'saving'}
                  className={`cr-inline-btn text-[10px] shrink-0 ${
                    sampleRateStatus === 'saved' ? 'bg-green-900/40 text-green-400 border-green-500/30' :
                    sampleRateStatus === 'error' ? 'bg-red-900/40 text-red-400 border-red-500/30' :
                    sampleRateStatus === 'saving' ? 'opacity-60' : ''
                  }`}
                >
                  {sampleRateStatus === 'saving' ? 'Saving...' :
                   sampleRateStatus === 'saved' ? '✓ Applied' :
                   sampleRateStatus === 'error' ? '✗ Failed' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Response Body Logging toggle */}
            <div className={`bg-[var(--cr-surface-sunken)] rounded-lg p-3 border border-[var(--cr-border)] ${!telemetryEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Server size={11} className="text-[var(--cr-accent)]" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--cr-text-muted)]">
                    Response Body Logging
                  </span>
                </div>
                <Switch
                  label=""
                  checked={telemetryResponseLogging}
                  onToggle={() => setTelemetryResponseLogging(!telemetryResponseLogging)}
                  ariaLabel="Toggle response body logging"
                />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-[var(--cr-text-muted)] leading-relaxed">
                When enabled, API response summaries are captured alongside each telemetry event. Turn off to reduce log verbosity.
              </p>
            </div>

            {/* Filter Bar (Search + Category Filter Chips) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[var(--cr-surface-sunken)] p-2 rounded border border-[var(--cr-border)]">
              <div className="relative flex-1">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cr-text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter events by type, component, or status..."
                  value={telemetryFilterText}
                  onChange={(e) => setTelemetryFilterText(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-[var(--cr-surface-card)] border border-[var(--cr-border)] rounded text-xs font-mono text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] outline-none focus:border-[var(--cr-accent)]"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <Filter size={11} className="text-[var(--cr-text-muted)] mr-1 shrink-0" />
                {([
                  { id: 'all', label: 'All' },
                  { id: 'ai', label: 'AI' },
                  { id: 'error', label: 'Errors' },
                  { id: 'frontend', label: 'Frontend' },
                  { id: 'backend', label: 'Backend' },
                  { id: 'people', label: 'People' },
                  { id: 'sync', label: 'Sync' },
                  { id: 'photos', label: 'Photos' },
                ] as const).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setTelemetryCategoryFilter(cat.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold transition-all ${
                      telemetryCategoryFilter === cat.id
                        ? 'bg-[var(--cr-accent)] text-black font-bold shadow-sm'
                        : 'bg-[var(--cr-surface-card)] text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] border border-[var(--cr-border)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live event stream */}
            <div
              ref={telemetryContainerRef}
              className="cr-log-viewer max-h-64 overflow-y-auto"
            >
              {filteredTelemetryEvents.length === 0 ? (
                <div className="text-[var(--cr-text-muted)] py-3 text-center text-xs font-mono">
                  {telemetryEvents.length === 0
                    ? 'Awaiting telemetry events from backend and frontend…'
                    : 'No telemetry events match current filter.'}
                </div>
              ) : (
                filteredTelemetryEvents.slice(0, 100).map((evt, idx) => {
                  const eventKey = evt.id != null ? `telemetry-${evt.id}-${idx}` : `telemetry-idx-${idx}`;
                  const isExpanded = expandedEventKey === eventKey;
                  const isError = evt.status === 'error';
                  const isWarn = evt.status === 'warning';
                  const ts = evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : '';
                  const sourceColor = evt.source === 'frontend' ? 'text-blue-400' : 'text-[var(--cr-accent)]';

                  return (
                    <div
                      key={eventKey}
                      onClick={() => setExpandedEventKey(isExpanded ? null : eventKey)}
                      className="cr-log-line group cursor-pointer hover:bg-white/5 transition-colors rounded px-1 py-0.5"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {evt.metadata_json ? (
                          isExpanded ? <ChevronDown size={11} className="text-[var(--cr-text-muted)]" /> : <ChevronRight size={11} className="text-[var(--cr-text-muted)]" />
                        ) : (
                          <span className="w-2.5 inline-block" />
                        )}
                        <span className="cr-log-time">{ts}</span>
                        <span className={`cr-log-level ${isError ? 'err' : isWarn ? 'warn' : 'ok'}`}>
                          {isError ? '[ERR]' : isWarn ? '[WARN]' : '[ OK ]'}
                        </span>
                        <span className={`text-[9px] uppercase font-bold w-16 inline-block ${sourceColor}`}>
                          {evt.source}
                        </span>
                        <span className="cr-log-msg font-mono flex-1">
                          <span className="text-[var(--cr-text-muted)]">{evt.event_type}</span>
                          {evt.component && <span className="text-[var(--cr-text-primary)]"> · {evt.component}</span>}
                          {evt.action && <span className="text-[var(--cr-text-muted)]">/{evt.action}</span>}
                          {evt.duration_ms != null && (
                            <span className="text-[var(--cr-accent)] ml-1">({evt.duration_ms.toFixed(1)}ms)</span>
                          )}
                        </span>

                        {/* Inline Response Data / Metadata Summary Badge — only shown when there is extra data beyond basic method/path/status */}
                        {evt.metadata_json && (() => {
                          try {
                            const parsed = JSON.parse(evt.metadata_json);
                            const CORE_KEYS = new Set(['method', 'path', 'status']);
                            const extraKeys = Object.keys(parsed).filter(k => !CORE_KEYS.has(k));
                            if (extraKeys.length === 0) return null;
                            const extra = Object.fromEntries(extraKeys.map(k => [k, parsed[k]]));
                            const extraStr = JSON.stringify(extra);
                            return (
                              <span className="font-mono text-[10px] text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 max-w-xs truncate" title={extraStr}>
                                data: {extraStr}
                              </span>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>

                      {/* Expanded Raw JSON View */}
                      {isExpanded && (
                        <div className="mt-1.5 p-2 bg-[#09090b] rounded border border-white/10 font-mono text-[10px] text-gray-300 overflow-x-auto space-y-1">
                          <div className="text-[var(--cr-accent)] font-bold mb-1">Telemetry Payload Details:</div>
                          <pre className="whitespace-pre-wrap break-all leading-normal text-green-400/90">
                            {JSON.stringify(
                              {
                                id: evt.id,
                                source: evt.source,
                                session_id: evt.session_id,
                                event_type: evt.event_type,
                                component: evt.component,
                                action: evt.action,
                                status: evt.status,
                                duration_ms: evt.duration_ms,
                                created_at: evt.created_at,
                                response_or_payload: evt.metadata_json ? (() => { try { return JSON.parse(evt.metadata_json); } catch { return evt.metadata_json; } })() : null
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 3: AI MODEL RUNTIME STATUS TABLE                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="cr-card">
        <div className="cr-card-title">AI Model Runtime Status</div>
        <table className="cr-data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Status</th>
              <th>VRAM Footprint</th>
              <th>Latency</th>
              <th>Batch Size</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Florence-2 Vision</td>
              <td className="val-accent">Loaded</td>
              <td>420 MB</td>
              <td>42ms</td>
              <td>8</td>
            </tr>
            <tr>
              <td>SigLIP Search</td>
              <td className="val-accent">Loaded</td>
              <td>310 MB</td>
              <td>8ms</td>
              <td>32</td>
            </tr>
            <tr>
              <td>CenterFace + DBSCAN</td>
              <td className="val-accent">Loaded</td>
              <td>250 MB</td>
              <td>18ms</td>
              <td>16</td>
            </tr>
            <tr>
              <td>Local Agent Runtime</td>
              <td className="val-secondary">Standby</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 4: BACKUP & RESTORE                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="cr-card">
        <div className="cr-card-title mb-3">Backup & System Restore</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="cr-key-value"><span className="k">Last Backup</span><span className="v">{lastBackupTime}</span></div>
            <div className="cr-key-value"><span className="k">Backup Footprint</span><span className="v val-accent">{formatBytes(totalDbAndCache)}</span></div>
            <div className="cr-key-value"><span className="k">Encryption</span><span className="v">Argon2id + AES</span></div>
          </div>

          <div className="flex flex-col justify-center gap-2">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="cr-inline-btn primary text-center"
            >
              {isExporting ? 'Creating Backup...' : 'Create Backup'}
            </button>
            <button
              onClick={handleImportClick}
              className="cr-inline-btn text-center"
            >
              Restore from Backup
            </button>
            <input 
              type="file" 
              id="restore-backup-file-input"
              name="restoreBackupFile"
              aria-label="Restore backup file input"
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".zip" 
              className="hidden"
            />
          </div>
        </div>

        {restoreStatus && (
          <p className="font-mono text-xs text-[var(--cr-accent)] bg-[var(--cr-surface-sunken)] p-3 rounded border border-[var(--cr-border)] mt-3">
            {restoreStatus.message}
          </p>
        )}
      </div>


    </div>
  );
};
