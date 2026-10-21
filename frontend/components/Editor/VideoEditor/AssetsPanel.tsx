/**
 * AssetsPanel — Left panel for browsing and importing media assets.
 * Shows the source video being edited + assets imported for this project.
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { API_BASE, resolveUrl } from '@/constants';
import { useNLEStore, type ProjectAsset } from '@/store/nleStore';
import { formatDuration } from '@/utils/formatDuration';

import type { Photo } from '@/types';
import {
  List,
  LayoutGrid,
  UploadCloud,
  Search,
  Trash2,
  Plus,
  Music,
  Film,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

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
      className={`w-72 bg-[#1d1b1a] border-r border-white/10 flex flex-col shrink-0 transition-colors ${
        isDraggingOver ? 'ring-2 ring-inset ring-[#e5a93c]/50 bg-[#e5a93c]/10' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-3.5 border-b border-white/10 shrink-0">
        <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Assets</span>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'list'
                ? 'text-[#151312] bg-[#e5a93c] font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'grid'
                ? 'text-[#151312] bg-[#e5a93c] font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Import button */}
      <div className="p-2.5 border-b border-white/10 shrink-0">
        <button
          onClick={handleImportClick}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-white/15 rounded-xl text-zinc-300 text-xs font-medium hover:border-[#e5a93c]/60 hover:text-[#e5a93c] hover:bg-[#e5a93c]/5 transition-all duration-150 disabled:opacity-30 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#e5a93c]" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4 text-[#e5a93c]" />
              <span>Import Media</span>
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
        <div className="px-2.5 py-2 border-b border-white/10 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#151312] text-[#f5f0ed] text-[11px] border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 outline-none focus:border-[#e5a93c]/60 transition-all duration-150 placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 mx-3 mt-3 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
            <UploadCloud className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-zinc-400 text-[11px] text-center px-4">
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors duration-150 text-left group cursor-pointer border-b border-white/[0.03]"
                >
                  <div className="w-12 h-8 bg-[#151312] rounded-md overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
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
                      <Music className="w-4 h-4 text-zinc-500" />
                    ) : asset.type === 'video' ? (
                      <Film className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-200 text-[11px] font-medium truncate group-hover:text-white transition-colors">
                      {asset.filename}
                    </div>
                    <div className="text-zinc-500 text-[10px]">
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
                      className="p-1 text-zinc-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1 text-zinc-400 group-hover:text-[#e5a93c] transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 gap-2 p-2.5">
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
                  className="group relative aspect-video bg-[#151312] rounded-lg overflow-hidden border border-white/10 hover:border-[#e5a93c]/60 transition-all duration-150 cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProjectAsset(asset.id);
                    }}
                    title="Remove asset"
                    className="absolute top-1 right-1 z-20 p-1 bg-black/80 text-zinc-300 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  >
                    <Trash2 className="w-3 h-3" />
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
                        <Film className="w-6 h-6 text-zinc-600" />
                      ) : asset.type === 'audio' ? (
                        <Music className="w-6 h-6 text-zinc-600" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                  )}
                  {asset.duration != null && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-zinc-200 text-[9px] px-1 rounded font-mono">
                      {formatDuration(asset.duration)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-[#e5a93c]/0 group-hover:bg-[#e5a93c]/15 transition-colors flex items-center justify-center pointer-events-none">
                    <Plus className="w-6 h-6 text-[#e5a93c] opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
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
