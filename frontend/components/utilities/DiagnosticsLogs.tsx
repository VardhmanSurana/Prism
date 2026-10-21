import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Switch } from '../ui';
import {
  Activity,
  Download,
  Copy,
  Radio,
  Server,
  Gauge,
  Trash2,
  Play,
  Pause,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import {
  subscribeTelemetryStream,
  fetchTelemetrySummary,
  fetchTelemetryEvents,
  clearTelemetryEvents,
  TelemetryEvent,
  TelemetrySummary,
} from '../../hooks/useTelemetry';

/**
 * DiagnosticsLogs — live SSE telemetry stream, controls, stats, and settings.
 * Resides in Utilities -> Diagnostics & Logs.
 */
export const DiagnosticsLogs: React.FC = () => {
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const telemetryEnabled = useSettingsStore((s) => s.telemetryEnabled);
  const telemetrySampleRate = useSettingsStore((s) => s.telemetrySampleRate);
  const telemetryResponseLogging = useSettingsStore((s) => s.telemetryResponseLogging);
  const fetchTelemetrySettings = useSettingsStore((s) => s.fetchTelemetrySettings);
  const setTelemetryEnabled = useSettingsStore((s) => s.setTelemetryEnabled);
  const setTelemetrySampleRate = useSettingsStore((s) => s.setTelemetrySampleRate);
  const setTelemetryResponseLogging = useSettingsStore((s) => s.setTelemetryResponseLogging);
  const [localSampleRate, setLocalSampleRate] = useState(telemetrySampleRate);
  const [sampleRateStatus, setSampleRateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => { setLocalSampleRate(telemetrySampleRate); }, [telemetrySampleRate]);
  useEffect(() => { fetchTelemetrySettings(); }, [fetchTelemetrySettings]);

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

  const handleToggleTelemetry = useCallback(async () => {
    await setTelemetryEnabled(!telemetryEnabled);
  }, [telemetryEnabled, setTelemetryEnabled]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Telemetry interactive controls
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const [filterText, setFilterText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ai' | 'error' | 'frontend' | 'backend' | 'people' | 'sync' | 'photos'>('all');
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter((evt) => {
      const eventType = (evt.event_type || '').toLowerCase();
      const component = (evt.component || '').toLowerCase();
      const action = (evt.action || '').toLowerCase();
      const source = (evt.source || '').toLowerCase();
      const status = (evt.status || '').toLowerCase();

      if (categoryFilter === 'backend' && source !== 'backend') return false;
      if (categoryFilter === 'frontend' && source !== 'frontend') return false;
      if (categoryFilter === 'error' && status !== 'error') return false;
      if (categoryFilter === 'ai') {
        const isAI = component.includes('ai') || component.includes('agent') || component.includes('gemma') ||
                     component.includes('florence') || component.includes('siglip') || component.includes('clip') ||
                     eventType.includes('ai') || eventType.includes('agent') || action.includes('ai');
        if (!isAI) return false;
      }
      if (categoryFilter === 'people') {
        const isPeople = component.includes('people') || component.includes('person') || component.includes('face') ||
                         eventType.includes('people') || eventType.includes('person') || eventType.includes('face');
        if (!isPeople) return false;
      }
      if (categoryFilter === 'sync') {
        const isSync = component.includes('sync') || component.includes('worker') || component.includes('job') ||
                       eventType.includes('sync') || action.includes('sync');
        if (!isSync) return false;
      }
      if (categoryFilter === 'photos') {
        const isPhotos = component.includes('photo') || component.includes('media') || component.includes('album') ||
                         eventType.includes('photo') || eventType.includes('album');
        if (!isPhotos) return false;
      }
      if (filterText.trim() !== '') {
        const q = filterText.toLowerCase();
        return eventType.includes(q) || component.includes(q) || action.includes(q) || source.includes(q) || status.includes(q);
      }
      return true;
    });
  }, [telemetryEvents, categoryFilter, filterText]);

  const loadSummary = useCallback(async () => {
    const summary = await fetchTelemetrySummary();
    if (summary) {
      setTelemetrySummary(summary);
      setTelemetryEvents(summary.recent_events);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeTelemetryStream(
      (event) => {
        setSseConnected(true);
        if (isPausedRef.current) return;
        setTelemetryEvents((prev) => [event, ...prev].slice(0, 300));
      },
      () => setSseConnected(false),
    );
    loadSummary();
    return unsub;
  }, [loadSummary]);

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

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const events = await fetchTelemetryEvents(1000);
      const exportData = { exported_at: new Date().toISOString(), total_events: events.length, summary: telemetrySummary, events };
      triggerDownload(JSON.stringify(exportData, null, 2), `prism_telemetry_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    } catch (e) { console.error('Failed to export telemetry JSON:', e); }
    finally { setIsExporting(false); }
  }, [telemetrySummary, triggerDownload]);

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
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
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
          }).join(',')
        ),
      ];
      triggerDownload(csvRows.join('\n'), `prism_telemetry_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    } catch (e) { console.error('Failed to export telemetry CSV:', e); }
    finally { setIsExporting(false); }
  }, [triggerDownload]);

  const handleCopy = useCallback(() => {
    const text = filteredEvents
      .map((evt) => {
        const ts = evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : '';
        const dur = evt.duration_ms != null ? ` (${evt.duration_ms.toFixed(1)}ms)` : '';
        const header = `[${ts}] [${evt.status?.toUpperCase() || 'OK'}] [${evt.source?.toUpperCase()}] ${evt.event_type} · ${evt.component || ''}/${evt.action || ''}${dur}`;
        if (!evt.metadata_json) return header;
        try {
          const parsed = JSON.parse(evt.metadata_json);
          const prettyJson = JSON.stringify(parsed, null, 2).split('\n').map((line) => `   ${line}`).join('\n');
          return `${header}\n   Payload:\n${prettyJson}`;
        } catch { return `${header}\n   Payload: ${evt.metadata_json}`; }
      })
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [filteredEvents]);

  const handleClear = useCallback(async () => {
    setTelemetryEvents([]);
    setTelemetrySummary((prev) => (prev ? { ...prev, total_events: 0, session_count: 0 } : null));
    await clearTelemetryEvents();
  }, []);

  const frontendCount = telemetryEvents.filter((e) => e.source === 'frontend').length;
  const backendCount = telemetryEvents.filter((e) => e.source === 'backend').length;
  const errorCount = telemetryEvents.filter((e) => e.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={16} className={sseConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'} />
            <h3 className="text-sm font-semibold text-[#f5f0ed]">Telemetry & Diagnostics Stream</h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${sseConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {isPaused ? 'Stream Paused' : sseConnected ? 'Live SSE Connected' : 'Disconnected'}
            </span>
            {!telemetryEnabled && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Collection Opted Out
              </span>
            )}
          </div>
          <p className="text-xs text-[#78716c] mt-1">
            Real-time event bus capturing backend API operations, AI inference telemetry, and frontend diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadSummary}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[#a8a29e] hover:text-white transition-colors flex items-center gap-1.5"
            title="Refresh Summary"
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleCopy}
            disabled={filteredEvents.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[#a8a29e] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
            title="Copy visible logs"
          >
            {copySuccess ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copySuccess ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            disabled={isExporting || telemetryEvents.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[#a8a29e] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
            title="Export JSON"
          >
            <Download size={12} />
            <span>JSON</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting || telemetryEvents.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[#a8a29e] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download size={12} />
            <span>CSV</span>
          </button>
          <button
            onClick={handleClear}
            disabled={telemetryEvents.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            title="Clear buffer"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isPaused ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 hover:bg-white/10 text-[#a8a29e]'
            }`}
            title={isPaused ? 'Resume Streaming' : 'Pause Streaming'}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Total Events</div>
          <div className="text-base font-bold text-[#f5f0ed] font-mono">
            {telemetrySummary?.total_events ?? telemetryEvents.length}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Sessions</div>
          <div className="text-base font-bold text-[#f5f0ed] font-mono">
            {telemetrySummary?.session_count ?? '—'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Velocity (/min)</div>
          <div className="text-base font-bold text-[#f5f0ed] font-mono">
            {telemetrySummary?.events_per_minute?.toFixed(1) ?? '0.0'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Avg Latency</div>
          <div className="text-base font-bold text-[#f5f0ed] font-mono">
            {telemetrySummary?.avg_latency_ms?.toFixed(1) ? `${telemetrySummary.avg_latency_ms.toFixed(1)}ms` : '—'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Errors</div>
          <div className={`text-base font-bold font-mono ${errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {errorCount}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#78716c] uppercase tracking-wider mb-1">Source Distribution</div>
          <div className="text-xs font-mono text-[#a8a29e] flex items-center justify-between">
            <span>BE: {backendCount}</span>
            <span>FE: {frontendCount}</span>
          </div>
        </div>
      </div>

      {/* Telemetry Settings */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-[rgba(255,255,255,0.06)] space-y-3">
        <h4 className="text-xs font-mono uppercase tracking-wider text-[#a8a29e] font-medium">
          Telemetry & Diagnostic Collection Configuration
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <Radio size={14} className={telemetryEnabled ? 'text-emerald-400' : 'text-rose-400'} />
              <div>
                <div className="text-xs font-medium text-[#f5f0ed]">Collection</div>
                <div className="text-[10px] text-[#78716c]">Enable telemetry bus</div>
              </div>
            </div>
            <Switch label="" checked={telemetryEnabled} onToggle={handleToggleTelemetry} ariaLabel="Toggle telemetry" />
          </div>

          <div className={`flex items-center justify-between p-3 rounded-lg bg-black/20 border border-[rgba(255,255,255,0.06)] ${!telemetryEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <Gauge size={14} className="text-primary" />
              <div>
                <div className="text-xs font-medium text-[#f5f0ed]">Sample Rate</div>
                <div className="text-[10px] text-[#78716c] font-mono">
                  {localSampleRate === 0 ? 'Off' : localSampleRate === 1 ? 'Capture All' : `1/${localSampleRate}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={localSampleRate}
                onChange={(e) => setLocalSampleRate(Number(e.target.value))}
                className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <button
                onClick={handleApplySampleRate}
                disabled={sampleRateStatus === 'saving'}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  sampleRateStatus === 'saved'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : sampleRateStatus === 'error'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-white/5 text-[#a8a29e] border-white/10 hover:text-white'
                }`}
              >
                {sampleRateStatus === 'saving' ? '...' : sampleRateStatus === 'saved' ? '✓' : sampleRateStatus === 'error' ? '✗' : 'Apply'}
              </button>
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-lg bg-black/20 border border-[rgba(255,255,255,0.06)] ${!telemetryEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <Server size={14} className="text-primary" />
              <div>
                <div className="text-xs font-medium text-[#f5f0ed]">Response Logging</div>
                <div className="text-[10px] text-[#78716c]">Log full payload responses</div>
              </div>
            </div>
            <Switch
              label=""
              checked={telemetryResponseLogging}
              onToggle={() => setTelemetryResponseLogging(!telemetryResponseLogging)}
              ariaLabel="Toggle response logging"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search events, actions, components..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-black/20 border border-[rgba(255,255,255,0.06)] rounded-lg text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { id: 'all', label: 'All' },
            { id: 'ai', label: 'AI' },
            { id: 'error', label: 'Errors' },
            { id: 'backend', label: 'Backend' },
            { id: 'frontend', label: 'Frontend' },
            { id: 'people', label: 'People' },
            { id: 'sync', label: 'Sync' },
            { id: 'photos', label: 'Photos' },
          ] as const).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                categoryFilter === cat.id
                  ? 'bg-primary text-black font-semibold'
                  : 'bg-black/20 text-[#78716c] hover:text-white border border-[rgba(255,255,255,0.06)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Stream Terminal */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-black/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-[#78716c]">
            <Terminal size={12} />
            <span>Event Stream Output</span>
            <span className="text-[10px] text-gray-600">({filteredEvents.length} events matching filter)</span>
          </div>
        </div>

        <div ref={containerRef} className="max-h-[500px] overflow-y-auto p-2 font-mono text-xs space-y-1">
          {filteredEvents.length === 0 ? (
            <div className="text-[#78716c] py-12 text-center">
              {telemetryEvents.length === 0 ? 'Awaiting telemetry events...' : 'No events match current filter.'}
            </div>
          ) : (
            filteredEvents.slice(0, 150).map((evt, idx) => {
              const eventKey = evt.id != null ? `evt-${evt.id}-${idx}` : `evt-idx-${idx}`;
              const isExpanded = expandedEventKey === eventKey;
              const isError = evt.status === 'error';
              const isWarn = evt.status === 'warning';
              const ts = evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : '';

              return (
                <div
                  key={eventKey}
                  onClick={() => setExpandedEventKey(isExpanded ? null : eventKey)}
                  className="px-2 py-1.5 hover:bg-white/[0.03] cursor-pointer rounded transition-colors border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {evt.metadata_json ? (
                      isExpanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />
                    ) : (
                      <span className="w-3 inline-block" />
                    )}
                    <span className="text-gray-500 w-16">{ts}</span>
                    <span
                      className={`w-12 text-center text-[10px] font-bold py-0.5 rounded ${
                        isError
                          ? 'bg-rose-500/20 text-rose-400'
                          : isWarn
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {isError ? 'ERROR' : isWarn ? 'WARN' : 'OK'}
                    </span>
                    <span className={`w-14 uppercase font-bold text-[10px] ${evt.source === 'frontend' ? 'text-blue-400' : 'text-primary'}`}>
                      [{evt.source}]
                    </span>
                    <span className="flex-1 text-[#f5f0ed] truncate">
                      <span className="text-[#78716c]">{evt.event_type}</span>
                      {evt.component && <span className="text-white"> · {evt.component}</span>}
                      {evt.action && <span className="text-[#78716c]">/{evt.action}</span>}
                      {evt.duration_ms != null && (
                        <span className="text-primary ml-1.5 font-bold">({evt.duration_ms.toFixed(1)}ms)</span>
                      )}
                    </span>
                  </div>

                  {isExpanded && evt.metadata_json && (
                    <div className="mt-2 p-3 bg-black/60 rounded-lg border border-[rgba(255,255,255,0.06)] text-xs text-gray-300 overflow-x-auto">
                      <div className="text-[10px] text-gray-500 mb-1 font-sans">Payload Metadata:</div>
                      <pre className="whitespace-pre-wrap break-all text-emerald-400 font-mono text-[11px]">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(evt.metadata_json!), null, 2);
                          } catch {
                            return evt.metadata_json;
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
