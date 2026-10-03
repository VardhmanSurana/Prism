import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  Cpu,
  Folder,
  Search,
  Sliders,
  Filter,
  ShieldAlert,
  Upload,
  Layers,
} from 'lucide-react';
import { API_BASE } from '../../constants';
import { settingsRegistry, type ResolvedSetting } from '@/services/settingsRegistry';
import { useSafeModeStore } from '@/store/safeModeStore';

interface AdvancedConfig {
  upload_dir?: string | null;
  thumbnails_dir?: string | null;
  models_dir?: string | null;
  plugins_dir?: string | null;
  map_cache_dir?: string | null;
  gpu_mode?: string | null;
  updater_enabled: boolean;
  updater_check_interval_minutes: number;
  updater_android_manifest_url?: string | null;
  updater_desktop_manifest_url?: string | null;
}

interface AdvancedSettingsResponse {
  config: AdvancedConfig;
  secrets: {
    api_key_masked: string;
    agent_api_key_masked: string;
  };
  vault_initialized: boolean;
  backend: string;
  port: number;
}

const DEFAULT_DESKTOP_MANIFEST =
  'https://github.com/VardhmanSurana/Prism/releases/latest/download/latest.json';
const DEFAULT_ANDROID_MANIFEST =
  'https://github.com/VardhmanSurana/Prism/releases/latest/download/android-latest.json';

const LAYER_BADGES = {
  default: { label: 'Default', bg: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  user: { label: 'User', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  workspace: { label: 'Workspace', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  project: { label: 'Project', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export const AdvancedSettings: React.FC = () => {
  const [config, setConfig] = useState<AdvancedConfig | null>(null);
  const [masked, setMasked] = useState<AdvancedSettingsResponse['secrets'] | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [agentKeyInput, setAgentKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | 'info'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Security Key Reveal / Copy / Regenerate state
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);

  // Safe Mode Store
  const { isSafeMode, toggleSafeMode, safeModeReason } = useSafeModeStore();

  // Registry Settings
  const [registrySettings, setRegistrySettings] = useState<ResolvedSetting[]>([]);

  const reloadRegistry = useCallback(() => {
    setRegistrySettings(settingsRegistry.resolveAll());
  }, []);

  useEffect(() => {
    reloadRegistry();
    return settingsRegistry.subscribe(reloadRegistry);
  }, [reloadRegistry]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/advanced`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AdvancedSettingsResponse;
      setConfig(data.config);
      setMasked(data.secrets);
    } catch (e) {
      console.error('[AdvancedSettings] load failed:', e);
      setStatus({ type: 'error', message: 'Failed to load advanced settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const update = (patch: Partial<AdvancedConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c));

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          api_key: apiKeyInput ? apiKeyInput : undefined,
          agent_api_key: agentKeyInput ? agentKeyInput : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApiKeyInput('');
      setAgentKeyInput('');
      setRevealedKey(null);
      setStatus({ type: 'ok', message: 'Settings saved. Changes to storage directories or GPU mode apply after restart.' });
      await fetchSettings();
    } catch (e) {
      console.error('[AdvancedSettings] save failed:', e);
      setStatus({ type: 'error', message: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRevealKey = async () => {
    if (revealedKey) {
      setRevealedKey(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/security/reveal`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRevealedKey(data.api_key);
    } catch (e) {
      console.error('[AdvancedSettings] reveal key failed:', e);
      setStatus({ type: 'error', message: 'Failed to reveal API key.' });
    } finally {
      setRevealing(false);
    }
  };

  const handleCopyKey = async () => {
    let keyToCopy = revealedKey;
    if (!keyToCopy) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/settings/security/reveal`);
        if (res.ok) {
          const data = await res.json();
          keyToCopy = data.api_key;
        }
      } catch {
        // fallback
      }
    }
    if (keyToCopy) {
      await navigator.clipboard.writeText(keyToCopy);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Regenerate API key? Existing clients using the old key will need the new key.')) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/security/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRevealedKey(data.api_key);
      setStatus({ type: 'ok', message: 'New API key generated and encrypted in vault.' });
      await fetchSettings();
    } catch (e) {
      console.error('[AdvancedSettings] regenerate key failed:', e);
      setStatus({ type: 'error', message: 'Failed to regenerate API key.' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleCheckUpdateNow = async () => {
    setCheckingUpdate(true);
    setUpdateStatusText('Checking for latest updates...');
    try {
      const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

      if (isTauri && !isAndroid) {
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const result = await check();
          if (result) {
            setUpdateStatusText(`Update ${result.version} is available! Use the update notification to install.`);
          } else {
            setUpdateStatusText('Your desktop application is up to date.');
          }
        } catch (err) {
          setUpdateStatusText(`Desktop updater check: ${String(err)}`);
        }
      } else {
        const endpoint = isAndroid
          ? config?.updater_android_manifest_url || DEFAULT_ANDROID_MANIFEST
          : config?.updater_desktop_manifest_url || DEFAULT_DESKTOP_MANIFEST;

        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const version = data.version || 'available';
          setUpdateStatusText(`Latest release verified on endpoint: v${version}.`);
        } else {
          setUpdateStatusText(`Release endpoint check returned HTTP ${res.status}.`);
        }
      }
    } catch (e) {
      setUpdateStatusText(`Update check error: ${String(e)}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleExportSanitized = () => {
    const json = settingsRegistry.exportSanitized();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prism-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ type: 'ok', message: 'Sanitized preferences exported (no secrets included).' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const res = settingsRegistry.importValidated(text);
      if (res.success) {
        setStatus({ type: 'ok', message: `Imported ${res.importedCount} settings successfully.` });
        reloadRegistry();
      } else {
        setStatus({ type: 'error', message: `Import failed: ${res.errors.join(', ')}` });
      }
    };
    input.click();
  };

  // Filter registry settings by search, category, and onlyChanged
  const filteredRegistry = useMemo(() => {
    return registrySettings.filter((s) => {
      if (onlyChanged && !s.isCustomized) return false;
      if (selectedCategory !== 'all' && s.definition.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.definition.label.toLowerCase().includes(q) ||
        s.definition.description.toLowerCase().includes(q) ||
        s.definition.id.toLowerCase().includes(q)
      );
    });
  }, [registrySettings, onlyChanged, selectedCategory, searchQuery]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    registrySettings.forEach((s) => set.add(s.definition.category));
    return ['all', ...Array.from(set)];
  }, [registrySettings]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-[#78716c] p-4">
        <RefreshCw size={14} className="animate-spin" /> Loading advanced settings...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="font-mono text-xs text-[#f87171] p-4">
        Advanced settings unavailable (backend not reachable).
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl pb-12">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716c]" />
          <input
            type="text"
            placeholder="Search all settings (e.g. preview, proxy, theme, vault)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-xl pl-9 pr-3 py-2 text-xs text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyChanged(!onlyChanged)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-mono transition ${
              onlyChanged
                ? 'border-[#e5a93c] bg-[#e5a93c]/10 text-[#e5a93c]'
                : 'border-[rgba(255,255,255,0.06)] bg-[#171615] text-[#a8a29e] hover:border-white/20'
            }`}
          >
            <Filter size={13} />
            <span>Changed from Defaults {onlyChanged && '✓'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportSanitized}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#171615] px-3 py-2 text-xs font-mono text-[#a8a29e] hover:border-white/20 transition"
            title="Export sanitized configuration without passwords/API keys"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#171615] px-3 py-2 text-xs font-mono text-[#a8a29e] hover:border-white/20 transition"
            title="Import configuration JSON"
          >
            <Upload size={13} />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Safe Mode Troubleshooting Card */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isSafeMode ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-[#a8a29e]'}`}>
            <ShieldAlert size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-[#f5f0ed]">
                Troubleshooting Safe Mode
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                isSafeMode
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {isSafeMode ? 'SAFE MODE ACTIVE' : 'Standard Mode'}
              </span>
            </div>
            <p className="text-[11px] text-[#78716c] mt-0.5">
              Temporarily isolates third-party plugins and custom layouts for recovery without losing any media.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSafeMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
            isSafeMode
              ? 'bg-amber-500 text-black hover:bg-amber-400'
              : 'border border-[rgba(255,255,255,0.06)] bg-[#171615] text-[#a8a29e] hover:text-white'
          }`}
        >
          {isSafeMode ? 'Exit Safe Mode' : 'Enter Safe Mode'}
        </button>
      </section>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-2.5 py-1 transition uppercase text-[10px] tracking-wider whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[#e5a93c] text-black font-semibold'
                : 'bg-[#171615] text-[#78716c] hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Layered Settings Registry View */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-[#e5a93c]" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] font-medium">
              Layered Preferences ({filteredRegistry.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#78716c] font-mono">
            Defaults → User → Workspace → Project
          </span>
        </div>

        <div className="space-y-4 divide-y divide-[rgba(255,255,255,0.06)]">
          {filteredRegistry.map((setting) => {
            const badge = LAYER_BADGES[setting.effectiveLayer];
            return (
              <div key={setting.definition.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#f5f0ed]">
                        {setting.definition.label}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${badge.bg}`}>
                        {badge.label} Layer
                      </span>
                      {setting.isCustomized && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Customized
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#78716c] mt-0.5">
                      {setting.definition.description}
                    </p>
                  </div>

                  {setting.isCustomized && (
                    <button
                      type="button"
                      onClick={() => settingsRegistry.resetUserValue(setting.definition.id)}
                      className="text-[11px] font-mono text-[#78716c] hover:text-amber-400 transition inline-flex items-center gap-1 shrink-0"
                      title="Reset setting to built-in default"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Control Element */}
                <div className="w-full max-w-md">
                  {setting.definition.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!setting.value}
                        onChange={(e) => settingsRegistry.setUserValue(setting.definition.id, e.target.checked)}
                        className="h-4 w-4 accent-[#e5a93c]"
                      />
                      <span className="text-xs font-mono text-[#a8a29e]">
                        {setting.value ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  )}

                  {setting.definition.type === 'select' && (
                    <select
                      value={setting.value}
                      onChange={(e) => settingsRegistry.setUserValue(setting.definition.id, e.target.value)}
                      className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
                    >
                      {setting.definition.options?.map((opt) => (
                        <option key={String(opt.value)} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {setting.definition.type === 'number' && (
                    <input
                      type="number"
                      min={setting.definition.min}
                      max={setting.definition.max}
                      step={setting.definition.step}
                      value={setting.value}
                      onChange={(e) => settingsRegistry.setUserValue(setting.definition.id, Number(e.target.value))}
                      className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
                    />
                  )}

                  {setting.definition.type === 'string' && (
                    <input
                      type="text"
                      value={setting.value || ''}
                      onChange={(e) => settingsRegistry.setUserValue(setting.definition.id, e.target.value)}
                      className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Zero-.env Cryptographic Security Vault */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#e5a93c]" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] font-medium">
              Security & Cryptography
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={12} /> AES-256-GCM Active
          </span>
        </div>

        <p className="text-xs text-[#78716c]">
          All sensitive keys are automatically generated using hardware/OS entropy and encrypted at rest with AES-256-GCM. No .env file or manual configuration is required.
        </p>

        {/* Backend API Key Management */}
        <div className="space-y-2 pt-1 border-t border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Auto-Generated API Key
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRevealKey}
                disabled={revealing}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#a8a29e] hover:text-[#e5a93c] transition"
              >
                {revealedKey ? <EyeOff size={13} /> : <Eye size={13} />}
                {revealedKey ? 'Hide' : 'Reveal'}
              </button>
              <button
                type="button"
                onClick={handleCopyKey}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#a8a29e] hover:text-[#e5a93c] transition"
              >
                {copiedKey ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateKey}
                disabled={regenerating}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#a8a29e] hover:text-[#f87171] transition"
              >
                <RotateCcw size={13} className={regenerating ? 'animate-spin' : ''} />
                Regenerate
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 font-mono text-sm text-[#f5f0ed] select-all truncate">
              {revealedKey || masked?.api_key_masked || '••••••••'}
            </div>
          </div>
        </div>

        {/* Optional custom override for API key */}
        <label className="block space-y-1 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
            Custom API Key Override (optional — leave empty to keep auto-generated key)
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder="Paste custom key to replace auto-generated key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </label>

        {/* AI Agent Provider API Key */}
        <label className="block space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              AI Agent Provider API Key (encrypted at rest)
            </span>
            {masked?.agent_api_key_masked && (
              <span className="font-mono text-[10px] text-[#78716c]">
                Current: {masked.agent_api_key_masked}
              </span>
            )}
          </div>
          <input
            type="password"
            autoComplete="off"
            placeholder={masked?.agent_api_key_masked ? 'Leave empty to keep current key' : 'Optional provider key (e.g. OpenAI/Anthropic)'}
            value={agentKeyInput}
            onChange={(e) => setAgentKeyInput(e.target.value)}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </label>
      </section>

      {/* In-App Auto Updates */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-[#e5a93c]" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] font-medium">
              In-App Auto Updates (Desktop & Mobile)
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCheckUpdateNow}
            disabled={checkingUpdate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#171615] px-3 py-1.5 text-xs font-mono text-[#f5f0ed] hover:border-[#e5a93c] transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={checkingUpdate ? 'animate-spin' : ''} />
            Check for Updates Now
          </button>
        </div>

        {updateStatusText && (
          <div className="rounded-lg bg-[#171615] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-xs font-mono text-[#a8a29e]">
            {updateStatusText}
          </div>
        )}

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="text-sm text-[#f5f0ed]">Automatic update checks</span>
            <p className="text-xs text-[#78716c]">
              Automatically checks for new desktop & mobile builds and prompts for 1-click update.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.updater_enabled}
            onChange={(e) => update({ updater_enabled: e.target.checked })}
            className="h-4 w-4 accent-[#e5a93c]"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
            Check interval (minutes)
          </span>
          <input
            type="number"
            min={30}
            value={config.updater_check_interval_minutes}
            onChange={(e) => update({ updater_check_interval_minutes: Math.max(30, Number(e.target.value) || 720) })}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
            Desktop update manifest URL (optional override)
          </span>
          <input
            type="url"
            placeholder={DEFAULT_DESKTOP_MANIFEST}
            value={config.updater_desktop_manifest_url ?? ''}
            onChange={(e) => update({ updater_desktop_manifest_url: e.target.value || null })}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
            Android APK update manifest URL (optional override)
          </span>
          <input
            type="url"
            placeholder={DEFAULT_ANDROID_MANIFEST}
            value={config.updater_android_manifest_url ?? ''}
            onChange={(e) => update({ updater_android_manifest_url: e.target.value || null })}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          />
        </label>
      </section>

      {/* Compute & Hardware Acceleration */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-[#e5a93c]" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] font-medium">
            Compute & Hardware Acceleration
          </h3>
        </div>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
            GPU Acceleration Mode <span className="normal-case">(applied on restart)</span>
          </span>
          <select
            value={config.gpu_mode ?? 'auto'}
            onChange={(e) => update({ gpu_mode: e.target.value })}
            className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
          >
            <option value="auto">Auto-detect best hardware accelerator</option>
            <option value="cuda">NVIDIA CUDA (Dedicated GPU)</option>
            <option value="cpu">CPU Only (Low power / no dedicated GPU)</option>
            <option value="vulkan">Vulkan (Cross-platform compute)</option>
            <option value="rocm">AMD ROCm (Radeon GPU)</option>
            <option value="sycl">Intel SYCL (Intel Arc / Iris Xe)</option>
          </select>
        </label>
      </section>

      {/* Storage directories */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#211f1e] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Folder size={16} className="text-[#e5a93c]" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] font-medium">
            Storage Directories <span className="text-[#78716c] normal-case">(applied on restart)</span>
          </h3>
        </div>

        {([
          ['upload_dir', 'Upload directory'],
          ['thumbnails_dir', 'Thumbnails cache directory'],
          ['models_dir', 'AI models directory'],
          ['plugins_dir', 'Plugins directory'],
          ['map_cache_dir', 'Offline map tile cache directory'],
        ] as const).map(([field, label]) => (
          <label key={field} className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">{label}</span>
            <input
              type="text"
              value={config[field] ?? ''}
              onChange={(e) => update({ [field]: e.target.value || null } as Partial<AdvancedConfig>)}
              className="w-full bg-[#171615] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f5f0ed] focus:outline-none focus:border-[#e5a93c]"
            />
          </label>
        ))}
      </section>

      {status && (
        <div
          className={`flex items-center gap-2 font-mono text-xs rounded-lg px-3 py-2 border ${
            status.type === 'ok'
              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
              : 'text-[#f87171] border-red-500/20 bg-red-500/10'
          }`}
        >
          {status.type === 'ok' ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {status.message}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-[#e5a93c] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Saving...' : 'Save Advanced Settings'}
      </button>
    </div>
  );
};
