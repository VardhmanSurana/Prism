/**
 * AssetsPanel — Left panel for browsing and importing media assets.
 * Shows the source video being edited + assets imported for this project.
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { API_BASE, resolveUrl } from '@/constants';
import { useNLEStore, type ProjectAsset } from '@/store/nleStore';
import { formatDuration } from '@/utils/formatDuration';

import type { Photo } from '@/types';

interface AssetsPanelProps {
  isOpen: boolean;
  coverPhoto?: Photo;
}

/**
 * AssetsPanel - Renders assets panel.
 */
export const AssetsPanel: React.FC<AssetsPanelProps> = ({ isOpen, coverPhoto }) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [failedAssets, setFailedAssets] = useState<Record<string, boolean>>({});

  /**
   * addClipFromLibrary - Performs add clip from library.
   */
  const addClipFromLibrary = useNLEStore((s) => s.addClipFromLibrary);
  /**
   * addProjectAsset - Performs add project asset.
   */
  const addProjectAsset = useNLEStore((s) => s.addProjectAsset);
  /**
   * removeProjectAsset - Performs remove project asset.
   */
  const removeProjectAsset = useNLEStore((s) => s.removeProjectAsset);
  /**
   * projectAssets - Performs project assets.
   */
  const projectAssets = useNLEStore((s) => s.projectAssets);
  /**
   * tracks - Performs tracks.
   */
  const tracks = useNLEStore((s) => s.tracks);
  /**
   * selectedTrackId - Performs selected track id.
   */
  const selectedTrackId = useNLEStore((s) => s.selectedTrackId);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTrackId = selectedTrackId ?? tracks[0]?.id ?? '';

  // Extract the source video from the cover photo or timeline clips
  /**
   * sourceAsset - Performs source asset.
   */
  const sourceAsset: ProjectAsset | null = (() => {
    if (coverPhoto && coverPhoto.path) {
      return {
        id: coverPhoto.uuid || coverPhoto.id,
        path: coverPhoto.path,
        filename: coverPhoto.filename ?? coverPhoto.path.split('/').pop() ?? 'Source video',
        duration: coverPhoto.duration,
        width: coverPhoto.width,
        height: coverPhoto.height,
        fps: coverPhoto.fps,
        type: (coverPhoto.type as any) ?? 'video',
        thumbnailUrl: coverPhoto.animated_url || coverPhoto.url,
      };
    }
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.sourcePath) {
          return {
            id: clip.sourceId ?? 0,
            path: clip.sourcePath,
            filename: clip.sourcePath.split('/').pop() ?? 'Source video',
            duration: clip.sourceDuration,
            type: 'video',
          };
        }
      }
    }
    return null;
  })();

  // Combine source + imported assets, deduplicate by type and id/path, filter by search
  /**
   * allAssets - Performs all assets.
   */
  const allAssets: ProjectAsset[] = useMemo(() => {
    const list: ProjectAsset[] = [];
    const seenKeys = new Set<string>();

    for (const asset of [...(sourceAsset ? [sourceAsset] : []), ...projectAssets]) {
      const key = `${asset.type}-${asset.id || asset.path}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push(asset);
      }
    }
    return list;
  }, [sourceAsset, projectAssets]);

  /**
   * filteredAssets - Performs filtered assets.
   */
  const filteredAssets = allAssets.filter((a) =>
    !search || a.filename?.toLowerCase().includes(search.toLowerCase())
  );

  // Drag-and-drop import handler
  /**
   * handleDragOver - Handles drag over.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  /**
   * handleDragLeave - Handles drag leave.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  /**
   * handleFiles - Handles files.
   */
  const handleFiles = useCallback(async (files: File[]) => {
    setIsUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${API_BASE}/api/v1/photos/upload`, {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          const photo = data.photo ?? data;
          let assetType: 'video' | 'image' | 'audio' = 'video';
          if (file.type.startsWith('image/')) assetType = 'image';
          else if (file.type.startsWith('audio/')) assetType = 'audio';

          addProjectAsset({
            id: photo.uuid || photo.id,
            path: photo.path,
            filename: photo.filename ?? file.name,
            duration: photo.duration,
            width: photo.width,
            height: photo.height,
            fps: photo.fps,
            type: assetType,
            thumbnailUrl: photo.animated_url || photo.url,
          });
        }
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setIsUploading(false);
    }
  }, [addProjectAsset]);

  /**
   * handleDrop - Handles drop.
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    /**
     * supportedFiles - Performs supported files.
     */
    const supportedFiles = files.filter((f) =>
      f.type.startsWith('video/') || f.type.startsWith('image/') || f.type.startsWith('audio/') ||
      /\.(mp4|mov|avi|mkv|webm|flv|wmv|jpg|jpeg|png|gif|webp|mp3|wav|flac|ogg)$/i.test(f.name)
    );

    if (supportedFiles.length === 0) return;
    await handleFiles(supportedFiles);
  }, [handleFiles]);

  /**
   * handleAddClip - Handles add clip.
   */
  const handleAddClip = useCallback(async (asset: ProjectAsset) => {
    try {
      await addClipFromLibrary(activeTrackId, {
        id: asset.id,
        path: asset.path,
        filename: asset.filename,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        fps: asset.fps,
      });
    } catch (err) {
      console.error('Failed to add clip to timeline:', err);
    }
  }, [activeTrackId, addClipFromLibrary]);

  /**
   * handleImportClick - Handles import click.
   */
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * handleFileInputChange - Handles file input change.
   */
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      await handleFiles(files);
    }
    e.target.value = '';
  }, [handleFiles]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropRef}
      className={`w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0 transition-colors ${
        isDraggingOver ? 'ring-2 ring-inset ring-[#3b82f6]/50 bg-[#1e2a3a]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/[0.06]">
        <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Assets</span>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded-md transition-colors duration-150 ${viewMode === 'list' ? 'text-white/80 bg-white/[0.08]' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'}`}
            title="List view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded-md transition-colors duration-150 ${viewMode === 'grid' ? 'text-white/80 bg-white/[0.08]' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'}`}
            title="Grid view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Import button */}
      <div className="p-2 border-b border-white/[0.06]">
        <button
          onClick={handleImportClick}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-white/[0.12] rounded-lg text-white/40 text-[11px] font-medium hover:border-white/20 hover:text-white/60 hover:bg-white/[0.02] transition-all duration-150 disabled:opacity-30"
        >
          {isUploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Search */}
      {allAssets.length > 0 && (
        <div className="px-2 py-1.5 border-b border-white/[0.06]">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] border border-white/[0.08] rounded-md px-2.5 py-1.5 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all duration-150 placeholder:text-white/25"
          />
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 mx-3 mt-2 border border-dashed border-white/[0.08] rounded-lg">
            <svg className="w-8 h-8 text-white/15 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-white/25 text-[11px] text-center px-4">
              {search ? 'No matching assets' : 'Import videos, images, or audio'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List view */
          <div className="py-1">
            {filteredAssets.map((asset) => {
              const assetKey = `${asset.type}-${asset.id || asset.path}`;
              const isFailed = failedAssets[assetKey];
              const src = isFailed
                ? ''
                : asset.thumbnailUrl
                ? resolveUrl(asset.thumbnailUrl)
                : asset.id
                ? `${API_BASE}/api/v1/photos/${asset.id}/thumbnail`
                : asset.path
                ? resolveUrl(asset.path)
                : '';

              return (
                <div
                  key={assetKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAddClip(asset)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClip(asset)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors duration-150 text-left group cursor-pointer"
                >
                  <div className="w-12 h-8 bg-white/[0.04] rounded-md overflow-hidden shrink-0 flex items-center justify-center border border-white/[0.04]">
                    {src ? (
                      <img
                        src={src}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          setFailedAssets((prev) => ({ ...prev, [assetKey]: true }));
                        }}
                      />
                    ) : asset.type === 'audio' ? (
                      <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    ) : asset.type === 'video' ? (
                      <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/70 text-[11px] truncate">{asset.filename}</div>
                    <div className="text-white/30 text-[10px]">
                      {asset.duration != null ? formatDuration(asset.duration) : asset.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProjectAsset(asset.id);
                      }}
                      title="Remove asset"
                      className="p-1 text-white/25 hover:text-red-400 rounded-md transition-colors duration-150"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg className="w-4 h-4 text-white/25 hover:text-[#3b82f6] transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 gap-1 p-2">
            {filteredAssets.map((asset) => {
              const assetKey = `${asset.type}-${asset.id || asset.path}`;
              const isFailed = failedAssets[assetKey];
              const src = isFailed
                ? ''
                : asset.thumbnailUrl
                ? resolveUrl(asset.thumbnailUrl)
                : asset.id
                ? `${API_BASE}/api/v1/photos/${asset.id}/thumbnail`
                : asset.path
                ? resolveUrl(asset.path)
                : '';

              return (
                <div
                  key={assetKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAddClip(asset)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClip(asset)}
                  className="group relative aspect-video bg-white/[0.03] rounded-md overflow-hidden border border-white/[0.06] hover:border-[#3b82f6]/40 transition-all duration-150 cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProjectAsset(asset.id);
                    }}
                    title="Remove asset"
                    className="absolute top-1 right-1 z-20 p-1 bg-black/80 text-white/70 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  {src ? (
                    <img
                      src={src}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => {
                        setFailedAssets((prev) => ({ ...prev, [assetKey]: true }));
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {asset.type === 'video' ? (
                        <svg className="w-7 h-7 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      ) : asset.type === 'audio' ? (
                        <svg className="w-7 h-7 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      ) : (
                        <svg className="w-7 h-7 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  )}
                  {asset.duration != null && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded">
                      {formatDuration(asset.duration)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center pointer-events-none">
                    <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPanel;
