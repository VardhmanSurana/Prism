import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Download, 
  Trash2, 
  RefreshCw, 
  Settings, 
  Check, 
  AlertCircle, 
  Folder, 
  Search, 
  Sparkles, 
  Scissors, 
  User, 
  Clapperboard, 
  MapPin, 
  Sliders, 
  ExternalLink,
  Info,
  Layers,
  X,
  Eraser,
  Maximize,
  Aperture,
  Moon,
  Film,
  Frame,
  Palette,
  Stamp,
  ShieldCheck,
  PenTool,
  Wand2
} from 'lucide-react';
import { API_BASE } from '@/constants';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  icon?: string;
  homepage?: string;
  capabilities: string[];
  entrypoint?: string;
}

export interface PluginConfig {
  enabled: boolean;
  installed_at: string;
  updated_at: string;
  settings: Record<string, any>;
}

export interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  config: PluginConfig;
  path: string;
  is_active: boolean;
  has_models: boolean;
}

export interface PluginCatalogItem {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  is_installed: boolean;
  is_active: boolean;
  size_display: string;
  tags: string[];
  manifest: PluginManifest;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Scissors: <Scissors size={20} className="text-blue-400" />,
  User: <User size={20} className="text-purple-400" />,
  Clapperboard: <Clapperboard size={20} className="text-amber-400" />,
  MapPin: <MapPin size={20} className="text-emerald-400" />,
  Sparkles: <Sparkles size={20} className="text-cyan-400" />,
  Eraser: <Eraser size={20} className="text-rose-400" />,
  Maximize: <Maximize size={20} className="text-green-400" />,
  Aperture: <Aperture size={20} className="text-teal-400" />,
  Moon: <Moon size={20} className="text-indigo-400" />,
  Film: <Film size={20} className="text-orange-400" />,
  Frame: <Frame size={20} className="text-yellow-400" />,
  Palette: <Palette size={20} className="text-pink-400" />,
  Stamp: <Stamp size={20} className="text-violet-400" />,
  ShieldCheck: <ShieldCheck size={20} className="text-emerald-500" />,
  PenTool: <PenTool size={20} className="text-sky-400" />,
  Package: <Package size={20} className="text-indigo-400" />,
};

export const PluginManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'installed' | 'catalog'>('installed');
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [catalogItems, setCatalogItems] = useState<PluginCatalogItem[]>([]);
  const [pluginsDir, setPluginsDir] = useState<string>('plugins');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [configModalPlugin, setConfigModalPlugin] = useState<InstalledPlugin | null>(null);

  const fetchPlugins = async () => {
    setIsLoading(true);
    try {
      const [installedRes, catalogRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/plugins`),
        fetch(`${API_BASE}/api/v1/plugins/catalog`),
      ]);

      if (installedRes.ok) {
        const data = await installedRes.json();
        setInstalledPlugins(data.plugins || []);
        if (data.plugins_dir) {
          setPluginsDir(data.plugins_dir);
        }
      }

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCatalogItems(data.catalog || []);
      }
    } catch (err: any) {
      console.error('Failed to load plugins:', err);
      setNotification({ type: 'error', message: 'Failed to communicate with plugin manager server' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleInstall = async (pluginId: string) => {
    setInstallingId(pluginId);
    setNotification(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/install/${pluginId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          message: `Plugin '${pluginId}' installed into ${pluginsDir}/${pluginId}`,
        });
        await fetchPlugins();
        setActiveTab('installed');
      } else {
        throw new Error(data.error || 'Installation failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to install plugin' });
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm(`Are you sure you want to uninstall '${pluginId}'? Its files in plugins/${pluginId}/ will be removed.`)) {
      return;
    }
    setUninstallingId(pluginId);
    setNotification(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/uninstall/${pluginId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          message: `Plugin '${pluginId}' successfully uninstalled from disk.`,
        });
        await fetchPlugins();
      } else {
        throw new Error(data.error || 'Uninstallation failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to uninstall plugin' });
    } finally {
      setUninstallingId(null);
    }
  };

  const handleToggle = async (pluginId: string, currentEnabled: boolean) => {
    setTogglingId(pluginId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugins/toggle/${pluginId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        await fetchPlugins();
      }
    } catch (err) {
      console.error('Failed to toggle plugin state:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const categories = ['all', ...Array.from(new Set(catalogItems.map((c) => c.category)))];

  const filteredCatalog = catalogItems.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--cr-border)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--cr-text-primary)] tracking-tight">Plugin Management</h2>
              <p className="text-xs text-[var(--cr-text-secondary)]">
                Discover, install, and manage modular extensions in <code className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[11px]">{pluginsDir}</code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPlugins}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-card)] hover:bg-white/5 text-xs font-medium text-[var(--cr-text-primary)] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Notification Banner ── */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Main Tab Navigation ── */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--cr-border)]">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('installed')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'installed'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            <span>My Plugins</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-[var(--cr-text-primary)]">
              {installedPlugins.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'catalog'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            <span>Plugin Catalog</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300">
              {catalogItems.length} Available
            </span>
          </button>
        </div>
      </div>

      {/* ════════════ TAB 1: INSTALLED PLUGINS ════════════ */}
      {activeTab === 'installed' && (
        <div className="space-y-4 animate-fadeIn">
          {installedPlugins.length === 0 ? (
            <div className="p-12 rounded-3xl border border-dashed border-[var(--cr-border)] bg-[var(--cr-surface-card)] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center border border-blue-500/20">
                <Package size={24} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-semibold text-[var(--cr-text-primary)] text-sm">No Plugins Installed Yet</h3>
                <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
                  Enhance Prism with AI matting backdrops, face retouching, 3D LUT profiles, and smart geotagging from the Plugin Catalog.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('catalog')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all inline-flex items-center gap-2"
              >
                <Download size={14} />
                <span>Browse Plugin Catalog</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installedPlugins.map((plugin) => {
                const IconComponent = ICON_MAP[plugin.manifest.icon || ''] || <Package size={20} className="text-blue-400" />;
                return (
                  <div
                    key={plugin.id}
                    className="p-4 rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface-card)] hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      {/* Top row: Icon, Name, Active Toggle */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
                            {IconComponent}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm text-[var(--cr-text-primary)] leading-tight">
                                {plugin.manifest.name}
                              </h3>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[var(--cr-text-secondary)] border border-white/10">
                                v{plugin.manifest.version}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--cr-text-secondary)] mt-0.5">
                              by {plugin.manifest.author}
                            </p>
                          </div>
                        </div>

                        {/* Active Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${plugin.is_active ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {plugin.is_active ? 'Active' : 'Disabled'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={plugin.is_active}
                              onChange={() => handleToggle(plugin.id, plugin.is_active)}
                              disabled={togglingId === plugin.id}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed line-clamp-2">
                        {plugin.manifest.description}
                      </p>

                      {/* Capabilities chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {plugin.manifest.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer: Folder Path and Action Buttons */}
                    <div className="pt-3 border-t border-[var(--cr-border)] flex items-center justify-between text-[11px] text-[var(--cr-text-secondary)]">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400 truncate max-w-[200px]" title={plugin.path}>
                        <Folder size={12} className="shrink-0" />
                        <span className="truncate">{pluginsDir}/{plugin.id}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfigModalPlugin(plugin)}
                          className="p-1.5 rounded-lg border border-[var(--cr-border)] hover:bg-white/5 text-[var(--cr-text-secondary)] hover:text-white transition-colors"
                          title="Configure plugin"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          disabled={uninstallingId === plugin.id}
                          className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Uninstall plugin and delete directory"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB 2: PLUGIN CATALOG ════════════ */}
      {activeTab === 'catalog' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-[var(--cr-surface-card)] border border-[var(--cr-border)] text-[var(--cr-text-secondary)] hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search catalog plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-card)] text-xs text-[var(--cr-text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCatalog.map((item) => {
              const IconComponent = ICON_MAP[item.icon] || <Package size={20} className="text-blue-400" />;
              const isInstalling = installingId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface-card)] hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
                          {IconComponent}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-[var(--cr-text-primary)]">
                              {item.name}
                            </h3>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[var(--cr-text-secondary)] border border-white/10">
                              v{item.version}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-sans">
                            {item.category} • by {item.author}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10 shrink-0">
                        {item.size_display}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-gray-300 border border-white/10"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="pt-3 border-t border-[var(--cr-border)] flex items-center justify-between">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Info size={12} />
                      <span>Installs into <code className="font-mono text-[10px]">plugins/{item.id}</code></span>
                    </div>

                    {item.is_installed ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                        <Check size={13} />
                        <span>Installed</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInstall(item.id)}
                        disabled={isInstalling}
                        className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                      >
                        {isInstalling ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Installing...</span>
                          </>
                        ) : (
                          <>
                            <Download size={13} />
                            <span>Install Plugin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Plugin Config Modal ── */}
      {configModalPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--cr-border)] bg-[#18181c] p-6 text-[var(--cr-text-primary)] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Settings size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm">Configure {configModalPlugin.manifest.name}</h3>
              </div>
              <button
                onClick={() => setConfigModalPlugin(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Plugin ID</span>
                  <span className="font-mono text-white">{configModalPlugin.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Filesystem Location</span>
                  <span className="font-mono text-white text-[11px] truncate max-w-[280px]">
                    {configModalPlugin.path}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Installed At</span>
                  <span className="font-mono text-white text-[11px]">
                    {new Date(configModalPlugin.config.installed_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-300 block mb-1.5">
                  Manifest Details (plugin.json)
                </label>
                <pre className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 custom-scrollbar">
                  {JSON.stringify(configModalPlugin.manifest, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setConfigModalPlugin(null)}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

