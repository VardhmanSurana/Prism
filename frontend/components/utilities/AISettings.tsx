import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw, Terminal, Gauge } from 'lucide-react';
import { API_BASE } from '../../constants';
import { Switch, Select } from '../ui';
import { useSettingsStore } from '../../store';

interface GeneralSettings {
  ENABLE_IMAGE_BG_PROCESS: boolean;
  ENABLE_AI_CLIP: boolean;
  ENABLE_AI_FACE: boolean;
  ENABLE_AI_CAPTION: boolean;
  ENABLE_AI_OCR: boolean;

  ENABLE_VIDEO_BG_PROCESS: boolean;
  ENABLE_VIDEO_FACE: boolean;
  ENABLE_AI_SUBTITLES: boolean;

  ENABLE_AI_AGENT: boolean;
  ENABLE_AI_INPAINTING: boolean;
  ENABLE_VIDEO_EDITOR_AI: boolean;

  GPU_MODE: string;
}

interface WorkerStatus {
  total_photos: number;
  paused: boolean;
  clip: { processed: number; total: number; progress: number; is_processing: boolean };
  gemma: { processed: number; total: number; progress: number; is_processing: boolean };
  face: { processed: number; total: number; progress: number; is_processing: boolean };
  queue: { pending: number; processing: number; failed: number; completed: number };
}

const GPU_OPTIONS = [
  { value: 'cuda', label: 'NVIDIA CUDA' },
  { value: 'rocm', label: 'AMD ROCm' },
  { value: 'sycl', label: 'Intel Arc / OneAPI' },
  { value: 'vulkan', label: 'Vulkan (Cross-GPU)' },
  { value: 'cpu', label: 'CPU Only (Low VRAM)' },
];

export const AISettings: React.FC = () => {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [logs, setLogs] = useState<string>('Loading system logs...');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setAgentEnabled = useSettingsStore(s => s.setAgentEnabled);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Telemetry sample rate state
  const telemetrySampleRate = useSettingsStore((s) => s.telemetrySampleRate);
  const fetchTelemetrySettings = useSettingsStore((s) => s.fetchTelemetrySettings);
  const setTelemetrySampleRate = useSettingsStore((s) => s.setTelemetrySampleRate);
  const [localSampleRate, setLocalSampleRate] = useState(telemetrySampleRate);
  const [sampleRateStatus, setSampleRateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setLocalSampleRate(telemetrySampleRate);
  }, [telemetrySampleRate]);

  useEffect(() => {
    fetchSettings();
    fetchWorkerStatus();
    fetchLogs();
    fetchTelemetrySettings();
  }, []);

  // Poll status and logs
  useEffect(() => {
    const statusInterval = setInterval(fetchWorkerStatus, 3000);
    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (!autoRefreshLogs) return;
    const logsInterval = setInterval(fetchLogs, 3000);
    return () => clearInterval(logsInterval);
  }, [autoRefreshLogs]);

  // Auto-scroll logs
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/general`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setAgentEnabled(data.ENABLE_AI_AGENT);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load settings');
    }
  };

  const fetchWorkerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch worker status', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/logs?lines=15`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || 'No log history available.');
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const saveSettings = async (updated: GeneralSettings) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/general`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setAgentEnabled(updated.ENABLE_AI_AGENT);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof GeneralSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSelectChange = (val: string) => {
    if (!settings) return;
    const updated = { ...settings, GPU_MODE: val };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleStartWorker = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/start`, { method: 'POST' });
      if (res.ok) {
        fetchWorkerStatus();
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStopWorker = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/stop`, { method: 'POST' });
      if (res.ok) {
        fetchWorkerStatus();
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

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

  if (!settings) {
    return (
      <section className="bg-[#0c0c0c] border border-[#23252a] rounded-3xl p-6 flex justify-center items-center h-48">
        <span className="text-xs text-[#8a8f98] font-mono animate-pulse">
          Loading AI Core Settings...
        </span>
      </section>
    );
  }

  // Determine worker status styling
  const isWorkerPaused = status?.paused ?? false;
  const isWorkerProcessing = status?.queue ? ((status.queue.pending || 0) > 0 || (status.queue.processing || 0) > 0) : false;

  let statusText = 'Stopped (Paused)';
  let statusBadgeStyle = 'border-red-500/20 bg-red-500/5 text-red-400';
  let statusDotStyle = 'bg-red-400';

  if (!isWorkerPaused) {
    if (isWorkerProcessing) {
      statusText = 'Active (Processing)';
      statusBadgeStyle = 'border-[var(--status-processing)]/20 bg-[var(--status-processing)]/5 text-[var(--status-processing-text)]';
      statusDotStyle = 'bg-[var(--status-processing-text)] animate-pulse';
    } else {
      statusText = 'Active (Idle)';
      statusBadgeStyle = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
      statusDotStyle = 'bg-emerald-400';
    }
  }

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

  return (
    <div className="space-y-4">
      {/* ═══════ GRID ROW 1: GPU ACCELERATION & BACKGROUND WORKERS ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: GPU Acceleration */}
        <div className="cr-card">
          <div className="cr-card-title flex items-center justify-between">
            <span>GPU Acceleration</span>
            <span className="font-mono text-[10px] text-[var(--cr-accent)] font-bold">
              {settings.GPU_MODE !== 'cpu' ? '[ACTIVE]' : '[STANDBY]'}
            </span>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Device Selection</span>
              <span className="cr-toggle-desc">Runtime backend for PyTorch & local inference models</span>
            </div>
            <select
              className="cr-terminal-select"
              value={settings.GPU_MODE}
              onChange={(e) => handleSelectChange(e.target.value)}
              aria-label="GPU processing mode"
            >
              {GPU_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Mixed Precision</span>
              <span className="cr-toggle-desc">FP16 inference for reduced VRAM footprint</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.GPU_MODE !== 'cpu' ? 'on' : 'off'}`}
            >
              {settings.GPU_MODE !== 'cpu' ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Inpainting & Video AI</span>
              <span className="cr-toggle-desc">Smart object removal & multi-track timeline AI</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_INPAINTING ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_INPAINTING')}
            >
              {settings.ENABLE_AI_INPAINTING ? '[ON]' : '[OFF]'}
            </span>
          </div>
        </div>

        {/* Card 2: Background Workers */}
        <div className="cr-card">
          <div className="cr-card-title flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>Background Workers</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${statusBadgeStyle}`}>
                {statusText}
              </span>
            </div>
            {isWorkerPaused ? (
              <button
                onClick={handleStartWorker}
                className="cr-inline-btn primary flex items-center gap-1 text-[9px]"
              >
                <Play size={9} className="fill-current" />
                START
              </button>
            ) : (
              <button
                onClick={handleStopWorker}
                className="cr-inline-btn text-[9px] text-[var(--cr-status-error)] hover:border-[var(--cr-status-error)]"
              >
                <Square size={9} className="fill-current" />
                HALT
              </button>
            )}
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Auto-Index & Background Sync</span>
              <span className="cr-toggle-desc">Index new media assets upon import</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_IMAGE_BG_PROCESS ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_IMAGE_BG_PROCESS')}
            >
              {settings.ENABLE_IMAGE_BG_PROCESS ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Face Recognition & Clustering</span>
              <span className="cr-toggle-desc">Detect & cluster faces when system is idle</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_FACE ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_FACE')}
            >
              {settings.ENABLE_AI_FACE ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Video Keyframe Processing</span>
              <span className="cr-toggle-desc">Automated video face & speech subtitles</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_VIDEO_BG_PROCESS ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_VIDEO_BG_PROCESS')}
            >
              {settings.ENABLE_VIDEO_BG_PROCESS ? '[ON]' : '[OFF]'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════ GRID ROW 2: AI MODEL CONFIGURATION ═══════ */}
      <div className="cr-card">
        <div className="cr-card-title mb-3">AI Model Configuration & Pipelines</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">SigLIP Semantic Search</span>
              <span className="cr-toggle-desc">Vector indexing for natural language query</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_CLIP ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_CLIP')}
            >
              {settings.ENABLE_AI_CLIP ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Gemma Scene Captioning</span>
              <span className="cr-toggle-desc">Detailed scene description generation</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_CAPTION ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_CAPTION')}
            >
              {settings.ENABLE_AI_CAPTION ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">OCR Text Extraction</span>
              <span className="cr-toggle-desc">Index embedded text in screenshots & receipts</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_OCR ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_OCR')}
            >
              {settings.ENABLE_AI_OCR ? '[ON]' : '[OFF]'}
            </span>
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Conversational AI Agent</span>
              <span className="cr-toggle-desc">Interactive photo query assistant</span>
            </div>
            <span
              className={`cr-toggle-indicator ${settings.ENABLE_AI_AGENT ? 'on' : 'off'}`}
              onClick={() => handleToggle('ENABLE_AI_AGENT')}
            >
              {settings.ENABLE_AI_AGENT ? '[ON]' : '[OFF]'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════ GRID ROW 3: TELEMETRY CONFIGURATION ═══════ */}
      <div className="cr-card">
        <div className="cr-card-title flex items-center gap-2 mb-3">
          <Gauge size={13} className="text-[var(--cr-accent)]" />
          <span>Telemetry & Diagnostics</span>
          <span className="font-mono text-[10px] text-[var(--cr-accent)] font-bold ml-auto">
            {localSampleRate === 0 ? '[OFF]' : localSampleRate === 1 ? '[MAX]' : `[1/${localSampleRate}]`}
          </span>
        </div>

        <div className="cr-toggle-row">
          <div className="cr-toggle-info">
            <span className="cr-toggle-label">Backend API Sample Rate</span>
            <span className="cr-toggle-desc">Controls how often backend API requests are logged for diagnostics. Errors (4xx/5xx) are always captured regardless of this setting.</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={localSampleRate}
              onChange={(e) => setLocalSampleRate(Number(e.target.value))}
              className="flex-1 h-1 bg-[var(--cr-border)] rounded-lg appearance-none cursor-pointer accent-[var(--cr-accent)]"
              aria-label="Telemetry sample rate"
            />
            <span className="font-mono text-[10px] text-[var(--cr-text-muted)] w-24 text-right">
              {localSampleRate === 0 ? 'OFF' : localSampleRate === 1 ? 'ALL' : `1 in ${localSampleRate}`}
            </span>
            <button
              onClick={handleApplySampleRate}
              disabled={sampleRateStatus === 'saving'}
              className={`cr-inline-btn text-[9px] px-2 py-0.5 ${
                sampleRateStatus === 'saved' ? 'bg-green-900/40 text-green-400 border-green-500/30' :
                sampleRateStatus === 'error' ? 'bg-red-900/40 text-red-400 border-red-500/30' :
                sampleRateStatus === 'saving' ? 'opacity-60' : ''
              }`}
            >
              {sampleRateStatus === 'saving' ? '...' :
               sampleRateStatus === 'saved' ? '✓' :
               sampleRateStatus === 'error' ? '✗' : 'SET'}
            </button>
          </div>
        </div>

        <div className="cr-toggle-row border-none">
          <div className="cr-toggle-info">
            <span className="cr-toggle-label">Frontend Event Buffering</span>
            <span className="cr-toggle-desc">User actions are batched (800ms debounce) and sent in bulk to minimize network overhead. Errors bypass the buffer and are sent immediately.</span>
          </div>
          <span className="cr-toggle-indicator on">[ON]</span>
        </div>
      </div>

      {/* ═══════ GRID ROW 4: LIVE LOG STREAM ═══════ */}
      <div className="cr-card">
        <div className="cr-card-title flex items-center justify-between mb-2">
          <span className="flex items-center gap-2">
            <Terminal size={12} className="text-[var(--cr-accent)]" />
            LIVE ENGINE LOG STREAM
          </span>
          <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--cr-text-muted)]">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--cr-text-primary)]">
              <input
                type="checkbox"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                className="rounded border-[var(--cr-border)] bg-[var(--cr-surface-sunken)] text-[var(--cr-accent)]"
              />
              <span>AUTO_SYNC</span>
            </label>
            <button
              onClick={fetchLogs}
              className="hover:text-[var(--cr-accent)] flex items-center gap-1"
            >
              <RefreshCw size={9} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        <div
          ref={logTerminalRef}
          className="cr-log-viewer"
        >
          {highlightLogs(logs)}
        </div>
      </div>
    </div>
  );
};



