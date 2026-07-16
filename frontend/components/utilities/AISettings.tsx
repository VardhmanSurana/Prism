import React, { useEffect, useState, useRef } from 'react';
import { Play, Square, RefreshCw, Terminal } from 'lucide-react';
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

  useEffect(() => {
    fetchSettings();
    fetchWorkerStatus();
    fetchLogs();
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

  if (!settings) {
    return (
      <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6 flex justify-center items-center h-48">
        <span className="text-xs text-[#8a8f98] font-mono animate-pulse">
          Loading AI Core Settings...
        </span>
      </section>
    );
  }

  // Determine worker status styling
  const isWorkerPaused = status?.paused ?? false;
  const isWorkerProcessing = status ? (status.queue.pending > 0 || status.queue.processing > 0) : false;

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

  return (
    <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6 relative">
      {/* Header with saving status */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-serif font-semibold text-[#f7f8f8] text-lg leading-tight">
              AI & Hardware Configuration
            </h3>
            <span className="px-2 py-0.5 bg-[#141516] border border-[#23252a] rounded-full text-[9px] font-mono uppercase tracking-wider text-[#8a8f98]">
              Prism Core
            </span>
          </div>
          <p className="text-xs text-[#8a8f98] mt-1.5 leading-relaxed">
            Manage dynamic hardware acceleration backends and background pipeline workers.
          </p>
        </div>

        {/* Dynamic Saving/Error indicator */}
        <div className="text-[10px] font-mono shrink-0">
          {isSaving && <span className="text-[#5e6ad2] animate-pulse">Saving...</span>}
          {error && <span className="text-[#e5484d]">{error}</span>}
          {!isSaving && !error && <span className="text-[#62666d]">All changes saved</span>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Hardware Acceleration Select */}
        <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-md">
              <h4 className="text-sm font-medium text-[#f7f8f8]">Hardware Acceleration</h4>
              <p className="text-xs text-[#8a8f98] mt-1 leading-relaxed">
                Choose the hardware backend matching your GPU. PyTorch and llama-server will target this acceleration runtime.
              </p>
            </div>
            <div className="w-full md:w-64 shrink-0">
              <Select
                options={GPU_OPTIONS}
                value={settings.GPU_MODE}
                onChange={handleSelectChange}
                ariaLabel="GPU processing mode"
              />
            </div>
          </div>
        </div>

        {/* Background Services Control and Real-time Logs */}
        <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <div className="flex flex-col gap-4">
            {/* Status and Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#23252a]/55">
              <div>
                <h4 className="text-sm font-medium text-[#f7f8f8] flex items-center gap-2">
                  Background Services Status
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${statusBadgeStyle}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyle}`} />
                    {statusText}
                  </span>
                </h4>
                <p className="text-xs text-[#8a8f98] mt-1 max-w-lg leading-relaxed">
                  Toggle dynamic queue worker processing for background uploads and imports. Start will automatically scan and catch up on any unfinished media files.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {isWorkerPaused ? (
                  <button
                    onClick={handleStartWorker}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#5e6ad2] hover:bg-[#828fff] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors duration-150"
                  >
                    <Play size={10} className="fill-white" />
                    Start Services
                  </button>
                ) : (
                  <button
                    onClick={handleStopWorker}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1c1e] hover:bg-[#2e3135] border border-[#23252a] text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors duration-150"
                  >
                    <Square size={10} className="fill-red-400" />
                    Stop Services
                  </button>
                )}
              </div>
            </div>

            {/* Log Terminal Window */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#8a8f98] flex items-center gap-1.5">
                  <Terminal size={12} />
                  System Execution Logs (backend.log)
                </span>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[#62666d]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefreshLogs}
                      onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                      className="rounded border-[#23252a] bg-[#0c0c0c] text-[#5e6ad2] focus:ring-[#5e6ad2]"
                    />
                    Auto-refresh
                  </label>
                  <button
                    onClick={fetchLogs}
                    className="hover:text-[#f7f8f8] flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={10} />
                    Refresh
                  </button>
                </div>
              </div>

              <div
                ref={logTerminalRef}
                className="bg-[#020202] border border-[#23252a] rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px] leading-relaxed text-[#8a8f98] scrollbar-thin select-text whitespace-pre-wrap"
              >
                {logs}
              </div>
            </div>
          </div>
        </div>

        {/* Background workers toggles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image workers card */}
          <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-sm font-medium text-[#f7f8f8]">Image Background Processes</h4>
                <div className="scale-90">
                  <Switch
                    label=""
                    checked={settings.ENABLE_IMAGE_BG_PROCESS}
                    onToggle={() => handleToggle('ENABLE_IMAGE_BG_PROCESS')}
                    ariaLabel="Enable image background processes"
                  />
                </div>
              </div>
              <p className="text-xs text-[#8a8f98] leading-relaxed mb-4">
                Automated cataloging pipelines running when new images are discovered.
              </p>
            </div>

            {/* Sub-processes */}
            <div
              className={`space-y-1.5 border-t border-[#23252a]/50 pt-3.5 transition-all duration-300 ${
                settings.ENABLE_IMAGE_BG_PROCESS ? 'opacity-100' : 'opacity-30 pointer-events-none'
              }`}
            >
              <Switch
                label="Semantic Search (SigLIP)"
                checked={settings.ENABLE_AI_CLIP}
                onToggle={() => handleToggle('ENABLE_AI_CLIP')}
                disabled={!settings.ENABLE_IMAGE_BG_PROCESS}
              />
              <Switch
                label="Face Detection & Clustering"
                checked={settings.ENABLE_AI_FACE}
                onToggle={() => handleToggle('ENABLE_AI_FACE')}
                disabled={!settings.ENABLE_IMAGE_BG_PROCESS}
              />
              <Switch
                label="Gemma Image Captioning"
                checked={settings.ENABLE_AI_CAPTION}
                onToggle={() => handleToggle('ENABLE_AI_CAPTION')}
                disabled={!settings.ENABLE_IMAGE_BG_PROCESS}
              />
              <Switch
                label="Text Extraction (OCR)"
                checked={settings.ENABLE_AI_OCR}
                onToggle={() => handleToggle('ENABLE_AI_OCR')}
                disabled={!settings.ENABLE_IMAGE_BG_PROCESS}
              />
            </div>
          </div>

          {/* Video workers card */}
          <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-sm font-medium text-[#f7f8f8]">Video Background Processes</h4>
                <div className="scale-90">
                  <Switch
                    label=""
                    checked={settings.ENABLE_VIDEO_BG_PROCESS}
                    onToggle={() => handleToggle('ENABLE_VIDEO_BG_PROCESS')}
                    ariaLabel="Enable video background processes"
                  />
                </div>
              </div>
              <p className="text-xs text-[#8a8f98] leading-relaxed mb-4">
                Automated analysis pipelines running when new video assets are added.
              </p>
            </div>

            {/* Sub-processes */}
            <div
              className={`space-y-1.5 border-t border-[#23252a]/50 pt-3.5 transition-all duration-300 ${
                settings.ENABLE_VIDEO_BG_PROCESS ? 'opacity-100' : 'opacity-30 pointer-events-none'
              }`}
            >
              <Switch
                label="Video Face Tracking"
                checked={settings.ENABLE_VIDEO_FACE}
                onToggle={() => handleToggle('ENABLE_VIDEO_FACE')}
                disabled={!settings.ENABLE_VIDEO_BG_PROCESS}
              />
              <Switch
                label="Subtitle Generation (Whisper)"
                checked={settings.ENABLE_AI_SUBTITLES}
                onToggle={() => handleToggle('ENABLE_AI_SUBTITLES')}
                disabled={!settings.ENABLE_VIDEO_BG_PROCESS}
              />
              {/* Spacer matching heights */}
              <div className="h-[72px]" />
            </div>
          </div>
        </div>

        {/* Feature Switches Card */}
        <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">AI Agent & Application Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div>
              <Switch
                label="AI Chat Agent"
                checked={settings.ENABLE_AI_AGENT}
                onToggle={() => handleToggle('ENABLE_AI_AGENT')}
              />
              <p className="text-[10px] text-[#8a8f98] mt-1 pl-1 leading-relaxed">
                Unlock natural language interaction and query understanding.
              </p>
            </div>
            <div>
              <Switch
                label="AI Object Removal"
                checked={settings.ENABLE_AI_INPAINTING}
                onToggle={() => handleToggle('ENABLE_AI_INPAINTING')}
              />
              <p className="text-[10px] text-[#8a8f98] mt-1 pl-1 leading-relaxed">
                Smart inpainting editor to clean, replace, or outpaint canvas.
              </p>
            </div>
            <div>
              <Switch
                label="Video Editor AI"
                checked={settings.ENABLE_VIDEO_EDITOR_AI}
                onToggle={() => handleToggle('ENABLE_VIDEO_EDITOR_AI')}
              />
              <p className="text-[10px] text-[#8a8f98] mt-1 pl-1 leading-relaxed">
                Multi-track video timeline and local composition export tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
