import React, { useState, useEffect, useRef } from 'react';
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
  Wand2,
  Camera,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { usePluginStore, PLUGIN_FEATURES_REGISTRY } from '@/store/pluginStore';

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
      usePluginStore.getState().fetchPlugins().catch(() => {});
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
                const thumbnailUrl = plugin.config?.settings?.thumbnail_url;
                return (
                  <div
                    key={plugin.id}
                    className="p-4 rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface-card)] hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      {/* Top row: Icon, Name, Active Toggle */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {thumbnailUrl ? (
                            <img
                              src={resolveUrl(thumbnailUrl)}
                              alt={plugin.manifest.name}
                              className="w-10 h-10 rounded-xl object-cover border border-white/15 shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
                              {IconComponent}
                            </div>
                          )}
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

      {/* ── Plugin Config Modal with Sub-Features Toggles ── */}
      {configModalPlugin && (() => {
        const features = PLUGIN_FEATURES_REGISTRY[configModalPlugin.id] || [];
        const currentFeatures = configModalPlugin.config?.settings?.features || {};

        const handleToggleSubFeature = async (featureKey: string) => {
          const isEnabled = currentFeatures[featureKey] !== false;
          const updatedFeatures = { ...currentFeatures, [featureKey]: !isEnabled };
          const newSettings = { ...(configModalPlugin.config?.settings || {}), features: updatedFeatures };

          try {
            const res = await fetch(`${API_BASE}/api/v1/plugins/config/${configModalPlugin.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ settings: newSettings }),
            });
            if (res.ok) {
              const updatedPlugin: InstalledPlugin = {
                ...configModalPlugin,
                config: {
                  ...configModalPlugin.config,
                  settings: newSettings,
                },
              };
              setConfigModalPlugin(updatedPlugin);
              setInstalledPlugins((prev) =>
                prev.map((p) => (p.id === updatedPlugin.id ? updatedPlugin : p))
              );
              usePluginStore.getState().fetchPlugins();
            }
          } catch (e) {
            console.error('Failed to toggle sub-feature:', e);
          }
        };

        const handleResetSubFeatures = async () => {
          const newSettings = { ...(configModalPlugin.config?.settings || {}), features: {} };
          try {
            const res = await fetch(`${API_BASE}/api/v1/plugins/config/${configModalPlugin.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ settings: newSettings }),
            });
            if (res.ok) {
              const updatedPlugin: InstalledPlugin = {
                ...configModalPlugin,
                config: {
                  ...configModalPlugin.config,
                  settings: newSettings,
                },
              };
              setConfigModalPlugin(updatedPlugin);
              setInstalledPlugins((prev) =>
                prev.map((p) => (p.id === updatedPlugin.id ? updatedPlugin : p))
              );
              usePluginStore.getState().fetchPlugins();
            }
          } catch (e) {
            console.error('Failed to reset sub-features:', e);
          }
        };

        const thumbnailInputRef = useRef<HTMLInputElement>(null);
        const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

        const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setIsUploadingThumbnail(true);
          const reader = new FileReader();
          reader.onload = async () => {
            const b64 = reader.result as string;
            try {
              const res = await fetch(`${API_BASE}/api/v1/plugins/thumbnail/${configModalPlugin.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_base64: b64 }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.plugin) {
                  setConfigModalPlugin(data.plugin);
                  setInstalledPlugins((prev) =>
                    prev.map((p) => (p.id === data.plugin.id ? data.plugin : p))
                  );
                  usePluginStore.getState().fetchPlugins();
                }
              }
            } catch (err) {
              console.error('Failed to upload plugin thumbnail:', err);
            } finally {
              setIsUploadingThumbnail(false);
            }
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        };

        const handleDeleteThumbnail = async () => {
          setIsUploadingThumbnail(true);
          try {
            const res = await fetch(`${API_BASE}/api/v1/plugins/thumbnail/${configModalPlugin.id}`, {
              method: 'DELETE',
            });
            if (res.ok) {
              const data = await res.json();
              if (data.plugin) {
                setConfigModalPlugin(data.plugin);
                setInstalledPlugins((prev) =>
                  prev.map((p) => (p.id === data.plugin.id ? data.plugin : p))
                );
                usePluginStore.getState().fetchPlugins();
              }
            }
          } catch (err) {
            console.error('Failed to delete plugin thumbnail:', err);
          } finally {
            setIsUploadingThumbnail(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
            <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border border-white/15 bg-[#16171d] text-white shadow-2xl overflow-hidden animate-scaleIn">
              {/* Modal Header with Thumbnail Uploader */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#121318]">
                <div className="flex items-center gap-3.5">
                  <input
                    type="file"
                    ref={thumbnailInputRef}
                    onChange={handleThumbnailFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {/* Thumbnail Avatar / Icon Button */}
                  <div
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="relative group/thumb cursor-pointer shrink-0"
                    title="Click to upload custom plugin thumbnail image"
                  >
                    {configModalPlugin.config?.settings?.thumbnail_url ? (
                      <img
                        src={resolveUrl(configModalPlugin.config.settings.thumbnail_url)}
                        alt={configModalPlugin.manifest.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-white/20 shadow-md transition-transform group-hover/thumb:scale-105"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner transition-transform group-hover/thumb:scale-105">
                        {ICON_MAP[configModalPlugin.manifest.icon || ''] || <Sliders size={22} />}
                      </div>
                    )}
                    
                    {/* Hover Camera Overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 text-white">
                      {isUploadingThumbnail ? (
                        <RefreshCw size={14} className="animate-spin text-blue-400" />
                      ) : (
                        <>
                          <Camera size={14} />
                          <span className="text-[8.5px] font-medium">Edit</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white leading-tight">{configModalPlugin.manifest.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10">
                        v{configModalPlugin.manifest.version}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModalPlugin(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
                {/* Sub-Features Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-gray-200">Studio Sub-Features & Capabilities</h4>
                      <p className="text-[10px] text-gray-400">Enable or disable specific engines to optimize memory and workflow</p>
                    </div>
                    {features.length > 0 && (
                      <button
                        onClick={handleResetSubFeatures}
                        className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        Reset to Defaults
                      </button>
                    )}
                  </div>

                  {features.length > 0 ? (
                    <div className="space-y-2.5">
                      {features.map((feat) => {
                        const isEnabled = currentFeatures[feat.key] !== false;
                        const FeatIcon = ICON_MAP[feat.icon] || <Sparkles size={16} className="text-blue-400" />;
                        return (
                          <div
                            key={feat.key}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3.5 ${
                              isEnabled
                                ? 'bg-[#1a1c24] border-blue-500/30 shadow-sm'
                                : 'bg-[#121318] border-white/5 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                                isEnabled
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                  : 'bg-white/5 border-white/10 text-gray-500'
                              }`}>
                                {FeatIcon}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold text-xs ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                                    {feat.name}
                                  </span>
                                  <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-gray-400">
                                    {feat.key}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                                  {feat.description}
                                </p>
                              </div>
                            </div>

                            {/* Toggle Switch */}
                            <button
                              type="button"
                              onClick={() => handleToggleSubFeature(feat.key)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isEnabled ? 'bg-blue-600' : 'bg-white/10'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/5 text-center text-gray-400 text-xs">
                      No configurable sub-features defined for this plugin.
                    </div>
                  )}
                </div>

                {/* System & Location Details */}
                <div className="p-3.5 rounded-2xl bg-[#121318] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Plugin ID</span>
                    <span className="font-mono text-white text-[11px]">{configModalPlugin.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Storage Directory</span>
                    <span className="font-mono text-white text-[10px] truncate max-w-[280px]">
                      {configModalPlugin.path}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Installed At</span>
                    <span className="font-mono text-white text-[10px]">
                      {new Date(configModalPlugin.config.installed_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-white/10 bg-[#121318]">
                <span className="text-[11px] text-gray-400">
                  Settings are persisted automatically to <code className="font-mono text-[10px] text-gray-300">config.json</code>
                </span>
                <button
                  onClick={() => setConfigModalPlugin(null)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

