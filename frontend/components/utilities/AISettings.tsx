import React, { useEffect, useState } from 'react';
import { Play, Square, Zap } from 'lucide-react';
import { API_BASE } from '../../constants';
import { Switch } from '../ui';
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

  AGENT_PROVIDER?: string;
  AGENT_BASE_URL?: string;
  AGENT_API_KEY?: string;
  AGENT_MODEL_NAME?: string;
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

/**
 * Settings panel for AI/background worker: GPU mode, background jobs, and agent provider config.
 * Fetches general settings and worker status, polls status, and persists changes.
 */
export const AISettings: React.FC = () => {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);

  const setAgentEnabled = useSettingsStore(s => s.setAgentEnabled);

  useEffect(() => {
    fetchSettings();
    fetchWorkerStatus();
  }, []);

  // Poll status
  useEffect(() => {
    const statusInterval = setInterval(fetchWorkerStatus, 3000);
    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  /** Fetches general settings from the backend and syncs local state. */
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

  /** Fetches background worker status and updates polling state. */
  const fetchWorkerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/background-jobs/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (typeof data.paused === 'boolean') {
          setManualPaused(data.paused);
        }
      }
    } catch (err) {
      console.error('Failed to fetch worker status', err);
    }
  };

  /**
   * Persists updated general settings to the backend.
   * @param updated - Full settings object to save.
   */
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

  /**
   * Toggles a boolean setting and saves the result.
   * @param key - Settings key to flip.
   */
  const handleToggle = (key: keyof GeneralSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveSettings(updated);
  };

  /**
   * Updates GPU mode selection and saves.
   * @param val - Selected GPU mode value.
   */
  const handleSelectChange = (val: string) => {
    if (!settings) return;
    const updated = { ...settings, GPU_MODE: val };
    setSettings(updated);
    saveSettings(updated);
  };

  /** Starts the background worker and refreshes status. */
  const handleStartWorker = async () => {
    setManualPaused(false);
    try {
      setIsSaving(true);
      await fetch(`${API_BASE}/api/v1/utilities/background-jobs/start`, { method: 'POST' });
      await fetchWorkerStatus();
    } catch (err) {
      console.error('Failed to start workers:', err);
    } finally {
      setIsSaving(false);
    }
  };

  /** Stops/pauses the background worker and refreshes status. */
  const handleStopWorker = async () => {
    setManualPaused(true);
    try {
      setIsSaving(true);
      await fetch(`${API_BASE}/api/v1/utilities/background-jobs/stop`, { method: 'POST' });
      await fetchWorkerStatus();
    } catch (err) {
      console.error('Failed to stop workers:', err);
    } finally {
      setIsSaving(false);
    }
  };

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
  const isWorkerPaused = manualPaused !== null ? manualPaused : (status?.paused ?? false);
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



  return (
    <div className="space-y-4">
      {/* ═══════ GRID ROW 1: GPU ACCELERATION & BACKGROUND WORKERS ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: GPU Acceleration */}
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
          <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title flex items-center justify-between">
            <span>GPU Acceleration</span>
            <span className="font-mono text-[10px] text-[#e5a93c] font-bold">
              {settings.GPU_MODE !== 'cpu' ? 'Active' : 'Standby'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Device Selection</span>
              <span className="text-[11px] text-[#78716c]">Runtime backend for PyTorch & local inference models</span>
            </div>
            <select
              className="px-3 py-1.5 rounded-xl bg-[#1d1b1a] border border-white/10 text-xs font-mono text-[#f5f0ed] focus:outline-none focus:border-white/20"
              id="gpu-mode-select"
              name="gpuMode"
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

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Mixed Precision</span>
              <span className="text-[11px] text-[#78716c]">FP16 inference for reduced VRAM footprint</span>
            </div>
            <Switch
              label=""
              checked={settings.GPU_MODE !== 'cpu'}
              disabled={true}
              onToggle={() => { }}
              ariaLabel="Mixed Precision FP16 inference status"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Magic Eraser & Video AI</span>
              <span className="text-[11px] text-[#78716c]">Smart object removal & multi-track timeline AI</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_INPAINTING}
              onToggle={() => handleToggle('ENABLE_AI_INPAINTING')}
              ariaLabel="Toggle Magic Eraser & Video AI"
            />
          </div>
        </div>

        {/* Card 2: Background Workers */}
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
          <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title flex justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span>Background Workers</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${statusBadgeStyle}`}>
                {statusText}
              </span>
            </div>

            {isWorkerPaused ? (
              <button
                type="button"
                onClick={handleStartWorker}
                className="px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition shadow-sm uppercase font-mono font-bold flex items-center gap-1.5"
              >
                <Play size={11} className="fill-current" />
                START WORKERS
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopWorker}
                className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition font-mono font-bold text-[#f87171] border-[#f87171]/40 hover:bg-[#f87171]/10 flex items-center gap-1.5"
              >
                <Square size={11} className="fill-current text-[#f87171]" />
                PAUSE WORKERS
              </button>
            )}
          </div>

          <div className="bg-[#100e0d] border border-[rgba(255,255,255,0.06)] rounded p-3 my-3 text-xs text-[#a8a29e] leading-relaxed">
            💡 <strong>How Background Workers operate:</strong> Workers run automatically in the background to index photos, generate embeddings, and detect faces. If status shows <em>Active (Idle)</em>, workers are active and listening for new imports. Click <strong>Pause Workers</strong> to temporarily halt processing.
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Auto-Index & Background Sync</span>
              <span className="text-[11px] text-[#78716c]">Index new media assets upon import</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_IMAGE_BG_PROCESS}
              onToggle={() => handleToggle('ENABLE_IMAGE_BG_PROCESS')}
              ariaLabel="Toggle Auto-Index & Background Sync"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Face Recognition & Clustering</span>
              <span className="text-[11px] text-[#78716c]">Detect & cluster faces when system is idle</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_FACE}
              onToggle={() => handleToggle('ENABLE_AI_FACE')}
              ariaLabel="Toggle Face Recognition & Clustering"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Video Keyframe Processing</span>
              <span className="text-[11px] text-[#78716c]">Automated video face & speech subtitles</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_VIDEO_BG_PROCESS}
              onToggle={() => handleToggle('ENABLE_VIDEO_BG_PROCESS')}
              ariaLabel="Toggle Video Keyframe Processing"
            />
          </div>
        </div>
      </div>

      {/* ═══════ GRID ROW 2: AI MODEL CONFIGURATION ═══════ */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title mb-3">AI Model Configuration & Pipelines</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0 border-none">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">SigLIP Semantic Search</span>
              <span className="text-[11px] text-[#78716c]">Vector indexing for natural language query</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_CLIP}
              onToggle={() => handleToggle('ENABLE_AI_CLIP')}
              ariaLabel="Toggle SigLIP Semantic Search"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0 border-none">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Gemma Scene Captioning</span>
              <span className="text-[11px] text-[#78716c]">Detailed scene description generation</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_CAPTION}
              onToggle={() => handleToggle('ENABLE_AI_CAPTION')}
              ariaLabel="Toggle Gemma Scene Captioning"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0 border-none">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">OCR Text Extraction</span>
              <span className="text-[11px] text-[#78716c]">Index embedded text in screenshots & receipts</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_OCR}
              onToggle={() => handleToggle('ENABLE_AI_OCR')}
              ariaLabel="Toggle OCR Text Extraction"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0 border-none">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Conversational AI Agent</span>
              <span className="text-[11px] text-[#78716c]">Interactive photo query assistant</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_AGENT}
              onToggle={() => handleToggle('ENABLE_AI_AGENT')}
              ariaLabel="Toggle Conversational AI Agent"
            />
          </div>
        </div>
      </div>

      {/* ═══════ GRID ROW 2.5: PRISM AI AGENT MODEL & PROVIDER ═══════ */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title flex items-center justify-between mb-3">
          <span>Prism AI Agent Model & Provider</span>
          <span className="font-mono text-[10px] text-[#e5a93c] font-bold uppercase">
            {(settings.AGENT_PROVIDER || 'local') === 'local' ? 'Local Gemma 4B' : 'Cloud Endpoint'}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0 border-none">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#f5f0ed]">Agent Model Provider</span>
              <span className="text-[11px] text-[#78716c]">Choose between local offline Gemma 4B or external ChatGPT-compatible cloud endpoints</span>
            </div>
            <select
              className="px-3 py-1.5 rounded-xl bg-[#1d1b1a] border border-white/10 text-xs font-mono text-[#f5f0ed] focus:outline-none focus:border-white/20"
              value={settings.AGENT_PROVIDER || 'local'}
              onChange={(e) => {
                const updated = { ...settings, AGENT_PROVIDER: e.target.value };
                setSettings(updated);
                saveSettings(updated);
              }}
              aria-label="Agent Model Provider"
            >
              <option value="local">Local Gemma 4B (llama-server)</option>
              <option value="cloud">Cloud Endpoint (ChatGPT / OpenAI Format)</option>
            </select>
          </div>

          {(settings.AGENT_PROVIDER || 'local') === 'cloud' && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold text-[11px]">Cloud Base URL (OpenAI / ChatGPT Specification)</label>
                <input
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  value={settings.AGENT_BASE_URL || ''}
                  onChange={(e) => {
                    const updated = { ...settings, AGENT_BASE_URL: e.target.value };
                    setSettings(updated);
                  }}
                  onBlur={() => saveSettings(settings)}
                  className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold text-[11px]">API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={settings.AGENT_API_KEY || ''}
                  onChange={(e) => {
                    const updated = { ...settings, AGENT_API_KEY: e.target.value };
                    setSettings(updated);
                  }}
                  onBlur={() => saveSettings(settings)}
                  className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold text-[11px]">Model Name</label>
                <input
                  type="text"
                  placeholder="gpt-4o / gemini-1.5-flash / qwen2.5"
                  value={settings.AGENT_MODEL_NAME || 'gemma-4b'}
                  onChange={(e) => {
                    const updated = { ...settings, AGENT_MODEL_NAME: e.target.value };
                    setSettings(updated);
                  }}
                  onBlur={() => saveSettings(settings)}
                  className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};