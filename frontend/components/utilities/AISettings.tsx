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
        if (typeof data.paused === 'boolean') {
          setManualPaused(data.paused);
        }
      }
    } catch (err) {
      console.error('Failed to fetch worker status', err);
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
        <div className="cr-card">
          <div className="cr-card-title flex items-center justify-between">
            <span>GPU Acceleration</span>
            <span className="font-mono text-[10px] text-[var(--cr-accent)] font-bold">
              {settings.GPU_MODE !== 'cpu' ? 'Active' : 'Standby'}
            </span>
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Device Selection</span>
              <span className="cr-toggle-desc">Runtime backend for PyTorch & local inference models</span>
            </div>
            <select
              className="cr-terminal-select"
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

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Mixed Precision</span>
              <span className="cr-toggle-desc">FP16 inference for reduced VRAM footprint</span>
            </div>
            <Switch
              label=""
              checked={settings.GPU_MODE !== 'cpu'}
              disabled={true}
              onToggle={() => { }}
              ariaLabel="Mixed Precision FP16 inference status"
            />
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Magic Eraser & Video AI</span>
              <span className="cr-toggle-desc">Smart object removal & multi-track timeline AI</span>
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
        <div className="cr-card">
          <div className="cr-card-title flex justify-between items-center gap-2">
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
                className="cr-inline-btn primary uppercase font-mono font-bold flex items-center gap-1.5"
              >
                <Play size={11} className="fill-current" />
                START WORKERS
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopWorker}
                className="cr-inline-btn font-mono font-bold text-[var(--cr-status-error)] border-[var(--cr-status-error)]/40 hover:bg-[var(--cr-status-error)]/10 flex items-center gap-1.5"
              >
                <Square size={11} className="fill-current text-[var(--cr-status-error)]" />
                PAUSE WORKERS
              </button>
            )}
          </div>

          <div className="bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] rounded p-3 my-3 text-xs text-[var(--cr-text-secondary)] leading-relaxed">
            💡 <strong>How Background Workers operate:</strong> Workers run automatically in the background to index photos, generate embeddings, and detect faces. If status shows <em>Active (Idle)</em>, workers are active and listening for new imports. Click <strong>Pause Workers</strong> to temporarily halt processing.
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Auto-Index & Background Sync</span>
              <span className="cr-toggle-desc">Index new media assets upon import</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_IMAGE_BG_PROCESS}
              onToggle={() => handleToggle('ENABLE_IMAGE_BG_PROCESS')}
              ariaLabel="Toggle Auto-Index & Background Sync"
            />
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Face Recognition & Clustering</span>
              <span className="cr-toggle-desc">Detect & cluster faces when system is idle</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_FACE}
              onToggle={() => handleToggle('ENABLE_AI_FACE')}
              ariaLabel="Toggle Face Recognition & Clustering"
            />
          </div>

          <div className="cr-toggle-row">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Video Keyframe Processing</span>
              <span className="cr-toggle-desc">Automated video face & speech subtitles</span>
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
      <div className="cr-card">
        <div className="cr-card-title mb-3">AI Model Configuration & Pipelines</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">SigLIP Semantic Search</span>
              <span className="cr-toggle-desc">Vector indexing for natural language query</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_CLIP}
              onToggle={() => handleToggle('ENABLE_AI_CLIP')}
              ariaLabel="Toggle SigLIP Semantic Search"
            />
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Gemma Scene Captioning</span>
              <span className="cr-toggle-desc">Detailed scene description generation</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_CAPTION}
              onToggle={() => handleToggle('ENABLE_AI_CAPTION')}
              ariaLabel="Toggle Gemma Scene Captioning"
            />
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">OCR Text Extraction</span>
              <span className="cr-toggle-desc">Index embedded text in screenshots & receipts</span>
            </div>
            <Switch
              label=""
              checked={settings.ENABLE_AI_OCR}
              onToggle={() => handleToggle('ENABLE_AI_OCR')}
              ariaLabel="Toggle OCR Text Extraction"
            />
          </div>

          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Conversational AI Agent</span>
              <span className="cr-toggle-desc">Interactive photo query assistant</span>
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
      <div className="cr-card">
        <div className="cr-card-title flex items-center justify-between mb-3">
          <span>Prism AI Agent Model & Provider</span>
          <span className="font-mono text-[10px] text-[var(--cr-accent)] font-bold uppercase">
            {(settings.AGENT_PROVIDER || 'local') === 'local' ? 'Local Gemma 4B' : 'Cloud Endpoint'}
          </span>
        </div>

        <div className="space-y-4">
          <div className="cr-toggle-row border-none">
            <div className="cr-toggle-info">
              <span className="cr-toggle-label">Agent Model Provider</span>
              <span className="cr-toggle-desc">Choose between local offline Gemma 4B or external ChatGPT-compatible cloud endpoints</span>
            </div>
            <select
              className="cr-terminal-select"
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