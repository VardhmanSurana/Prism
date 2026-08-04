import React from 'react';
import {
  Star,
  Clock,
  X,
  HardDrive,
  Wifi,
  Plus,
  Home,
  Image as ImageIcon,
  Download,
  FolderOpen,
} from 'lucide-react';
import {
  BrowserMount,
  ExternalLocation,
  RecentFolder,
  ShortcutItem,
  SmartFolder,
} from './types';

interface BrowserShortcutsProps {
  shortcuts: ShortcutItem[];
  recentFolders?: RecentFolder[];
  smartFolders?: SmartFolder[];
  mounts?: BrowserMount[];
  externalLocations?: ExternalLocation[];
  activeSmartFolderId?: string | null;
  onShortcutClick: (path: string) => void;
  onRecentClick?: (path: string) => void;
  onSmartFolderClick?: (folder: SmartFolder) => void;
  onSmartFolderDelete?: (id: string) => void;
  onExternalDelete?: (id: string) => void;
  onAddLocation?: () => void;
  variant?: 'inline' | 'sidebar';
}

function kindIcon(kind: string) {
  if (kind === 'network') return <Wifi size={10} className="shrink-0" />;
  return <HardDrive size={10} className="shrink-0" />;
}

function shortcutIcon(name: string) {
  const key = name.toLowerCase();
  if (key === 'home') return <Home size={14} className="shrink-0" />;
  if (key === 'pictures') return <ImageIcon size={14} className="shrink-0" />;
  if (key === 'downloads') return <Download size={14} className="shrink-0" />;
  return <FolderOpen size={14} className="shrink-0" />;
}

export const BrowserShortcuts: React.FC<BrowserShortcutsProps> = ({
  shortcuts,
  recentFolders = [],
  smartFolders = [],
  mounts = [],
  externalLocations = [],
  activeSmartFolderId,
  onShortcutClick,
  onRecentClick,
  onSmartFolderClick,
  onSmartFolderDelete,
  onExternalDelete,
  onAddLocation,
  variant = 'inline',
}) => {
  const usableExternal = externalLocations.filter(
    (l) => l.enabled !== false && l.mount_path && l.status !== 'scaffold'
  );
  const scaffoldExternal = externalLocations.filter(
    (l) => l.status === 'scaffold' || (!l.mount_path && (l.provider === 's3' || l.provider === 'gdrive'))
  );

  const hasAny =
    shortcuts.length > 0 ||
    recentFolders.length > 0 ||
    smartFolders.length > 0 ||
    mounts.length > 0 ||
    externalLocations.length > 0 ||
    Boolean(onAddLocation);

  if (!hasAny) return null;

  if (variant === 'sidebar') {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 custom-scrollbar">
          {shortcuts.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Quick Access
              </h4>
              <div className="space-y-1">
                {shortcuts.map((s) => (
                  <button
                    key={s.path + s.name}
                    onClick={() => onShortcutClick(s.path)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 transition-all hover:bg-white/6 hover:text-white"
                  >
                    {shortcutIcon(s.name)}
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(mounts.length > 0 || usableExternal.length > 0 || onAddLocation) && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Drives
                </h4>
                {onAddLocation && (
                  <button
                    type="button"
                    onClick={onAddLocation}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/45 transition-all hover:border-white/20 hover:text-white"
                    title="Add network or cloud location"
                  >
                    <Plus size={11} />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {mounts.map((m) => (
                  <button
                    key={m.path}
                    onClick={() => onShortcutClick(m.path)}
                    title={`${m.path}${m.fstype ? ` · ${m.fstype}` : ''} · ${m.kind}`}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 transition-all hover:bg-white/6 hover:text-white"
                  >
                    {kindIcon(m.kind)}
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
                {usableExternal.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/72 transition-all hover:bg-white/6"
                  >
                    <button
                      onClick={() => loc.mount_path && onShortcutClick(loc.mount_path)}
                      disabled={!loc.mount_path || loc.status === 'unavailable'}
                      title={
                        loc.error ||
                        `${loc.mount_path || ''} · ${loc.provider}${loc.status ? ` · ${loc.status}` : ''}`
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                    >
                      {kindIcon(loc.provider === 'smb' ? 'network' : 'volume')}
                      <span className="truncate">{loc.name}</span>
                    </button>
                    {onExternalDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExternalDelete(loc.id);
                        }}
                        className="text-white/28 transition-colors hover:text-red-400"
                        title="Remove location"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {mounts.length === 0 && usableExternal.length === 0 && onAddLocation && (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-white/40">
                    Add a network path or cloud location.
                  </div>
                )}
              </div>
            </section>
          )}

          {recentFolders.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Recent
              </h4>
              <div className="space-y-1">
                {recentFolders.map((r) => (
                  <button
                    key={r.path}
                    onClick={() => (onRecentClick ?? onShortcutClick)(r.path)}
                    title={r.path}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/72 transition-all hover:bg-white/6 hover:text-white"
                  >
                    <Clock size={14} className="shrink-0" />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {smartFolders.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Smart Folders
              </h4>
              <div className="space-y-1">
                {smartFolders.map((sf) => {
                  const isActive = activeSmartFolderId === sf.id;
                  return (
                    <div
                      key={sf.id}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all ${
                        isActive ? 'bg-primary/12 text-primary' : 'text-white/72 hover:bg-white/6 hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => onSmartFolderClick?.(sf)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Star size={14} className="shrink-0" />
                        <span className="truncate">{sf.name}</span>
                      </button>
                      {onSmartFolderDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSmartFolderDelete(sf.id);
                          }}
                          className="text-white/28 transition-colors hover:text-red-400"
                          title="Delete smart folder"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {scaffoldExternal.length > 0 && (
          <div className="border-t border-white/8 px-5 py-4 text-[12px] text-white/35">
            Cloud providers saved but not browseable yet:
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scaffoldExternal.map((loc) => (
                <span
                  key={loc.id}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px]"
                  title={loc.error || `${loc.provider} — not connected yet`}
                >
                  {loc.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1">Quick:</span>
          {shortcuts.map((s) => (
            <button
              key={s.path + s.name}
              onClick={() => onShortcutClick(s.path)}
              className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {(mounts.length > 0 || usableExternal.length > 0) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1 inline-flex items-center gap-1">
            <HardDrive size={10} />
            Drives:
          </span>
          {mounts.map((m) => (
            <button
              key={m.path}
              onClick={() => onShortcutClick(m.path)}
              title={`${m.path}${m.fstype ? ` · ${m.fstype}` : ''} · ${m.kind}`}
              className="px-2.5 py-1 text-[10px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-200/90 hover:text-sky-100 rounded-full border border-sky-500/20 transition-all cursor-pointer max-w-[160px] truncate inline-flex items-center gap-1"
            >
              {kindIcon(m.kind)}
              <span className="truncate">{m.name}</span>
            </button>
          ))}
          {usableExternal.map((loc) => (
            <span
              key={loc.id}
              className={`inline-flex items-center gap-0.5 rounded-full border max-w-[180px]
                ${
                  loc.status === 'available'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200/90'
                    : 'bg-white/[0.03] border-white/10 text-white/50'
                }`}
            >
              <button
                onClick={() => loc.mount_path && onShortcutClick(loc.mount_path)}
                disabled={!loc.mount_path || loc.status === 'unavailable'}
                title={
                  loc.error ||
                  `${loc.mount_path || ''} · ${loc.provider}${loc.status ? ` · ${loc.status}` : ''}`
                }
                className="px-2.5 py-1 text-[10px] truncate cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                {kindIcon(loc.provider === 'smb' ? 'network' : 'volume')}
                <span className="truncate">{loc.name}</span>
              </button>
              {onExternalDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExternalDelete(loc.id);
                  }}
                  className="pr-1.5 py-1 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove location"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {onAddLocation && (
            <button
              type="button"
              onClick={onAddLocation}
              className="px-2 py-1 text-[10px] rounded-full border border-dashed border-white/15 text-white/40 hover:text-white hover:border-white/30 inline-flex items-center gap-1 cursor-pointer"
              title="Add network or cloud location"
            >
              <Plus size={10} />
              Add
            </button>
          )}
        </div>
      )}

      {mounts.length === 0 && usableExternal.length === 0 && onAddLocation && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1 inline-flex items-center gap-1">
            <HardDrive size={10} />
            Drives:
          </span>
          <button
            type="button"
            onClick={onAddLocation}
            className="px-2 py-1 text-[10px] rounded-full border border-dashed border-white/15 text-white/40 hover:text-white hover:border-white/30 inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus size={10} />
            Add network path
          </button>
        </div>
      )}

      {scaffoldExternal.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1">Cloud (soon):</span>
          {scaffoldExternal.map((loc) => (
            <span
              key={loc.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-full border border-white/10 bg-white/[0.03] text-white/40 max-w-[160px]"
              title={loc.error || `${loc.provider} — not connected yet`}
            >
              <span className="truncate">{loc.name}</span>
              {onExternalDelete && (
                <button
                  onClick={() => onExternalDelete(loc.id)}
                  className="text-white/30 hover:text-red-400 cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {recentFolders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1 inline-flex items-center gap-1">
            <Clock size={10} />
            Recent:
          </span>
          {recentFolders.map((r) => (
            <button
              key={r.path}
              onClick={() => (onRecentClick ?? onShortcutClick)(r.path)}
              title={r.path}
              className="px-2.5 py-1 text-[10px] bg-white/[0.03] hover:bg-white/10 text-white/70 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer max-w-[140px] truncate"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {smartFolders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase mr-1 inline-flex items-center gap-1">
            <Star size={10} />
            Smart:
          </span>
          {smartFolders.map((sf) => {
            const isActive = activeSmartFolderId === sf.id;
            return (
              <span
                key={sf.id}
                className={`inline-flex items-center gap-1 rounded-full border transition-all max-w-[180px]
                  ${
                    isActive
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <button
                  onClick={() => onSmartFolderClick?.(sf)}
                  title={
                    [
                      sf.basePath ? `Path: ${sf.basePath}` : null,
                      sf.criteria.namePattern ? `Name: ${sf.criteria.namePattern}` : null,
                      sf.criteria.mediaType && sf.criteria.mediaType !== 'all'
                        ? `Type: ${sf.criteria.mediaType}`
                        : null,
                      sf.criteria.minSizeBytes != null
                        ? `Min: ${sf.criteria.minSizeBytes}B`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || sf.name
                  }
                  className="px-2.5 py-1 text-[10px] truncate cursor-pointer"
                >
                  {sf.name}
                </button>
                {onSmartFolderDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSmartFolderDelete(sf.id);
                    }}
                    className="pr-1.5 py-1 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete smart folder"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
