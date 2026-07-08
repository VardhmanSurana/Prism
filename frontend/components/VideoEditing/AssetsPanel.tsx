/**
 * AssetsPanel — Left panel for browsing and importing media assets.
 * Shows the source video being edited + assets imported for this project.
 */
import React, { useState, useCallback, useRef } from 'react';
import { API_BASE, resolveUrl } from '@/constants';
import { useNLEStore, type ProjectAsset } from '@/store/nleStore';
import { formatDuration } from '@/utils/formatDuration';

import type { Photo } from '@/types';

interface AssetsPanelProps {
  isOpen: boolean;
  coverPhoto?: Photo;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({ isOpen, coverPhoto }) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const addClipFromLibrary = useNLEStore((s) => s.addClipFromLibrary);
  const addProjectAsset = useNLEStore((s) => s.addProjectAsset);
  const projectAssets = useNLEStore((s) => s.projectAssets);
  const tracks = useNLEStore((s) => s.tracks);
  const selectedTrackId = useNLEStore((s) => s.selectedTrackId);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTrackId = selectedTrackId ?? tracks[0]?.id ?? '';

  // Extract the source video from the cover photo or timeline clips
  const sourceAsset: ProjectAsset | null = (() => {
    if (coverPhoto) {
      return {
        id: Number(coverPhoto.id),
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

  // Combine source + imported assets, filter by search
  const allAssets: ProjectAsset[] = [
    ...(sourceAsset ? [sourceAsset] : []),
    ...projectAssets,
  ];
  const filteredAssets = allAssets.filter((a) =>
    !search || a.filename?.toLowerCase().includes(search.toLowerCase())
  );

  // Drag-and-drop import handler
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

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
          // Determine asset type
          let assetType: 'video' | 'image' | 'audio' = 'video';
          if (file.type.startsWith('image/')) assetType = 'image';
          else if (file.type.startsWith('audio/')) assetType = 'audio';

          addProjectAsset({
            id: photo.id,
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter((f) =>
      f.type.startsWith('video/') || f.type.startsWith('image/') || f.type.startsWith('audio/') ||
      /\.(mp4|mov|avi|mkv|webm|flv|wmv|jpg|jpeg|png|gif|webp|mp3|wav|flac|ogg)$/i.test(f.name)
    );

    if (supportedFiles.length === 0) return;
    await handleFiles(supportedFiles);
  }, [handleFiles]);

  const handleAddClip = useCallback(async (asset: ProjectAsset) => {
    if (!activeTrackId) return;
    await addClipFromLibrary(activeTrackId, {
      id: asset.id,
      path: asset.path,
      filename: asset.filename,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      fps: asset.fps,
    });
  }, [activeTrackId, addClipFromLibrary]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Assets</span>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${viewMode === 'list' ? 'text-[#3b82f6]' : 'text-[#666] hover:text-[#999]'}`}
            title="List view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded ${viewMode === 'grid' ? 'text-[#3b82f6]' : 'text-[#666] hover:text-[#999]'}`}
            title="Grid view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          {/* Sort */}
          <button className="p-1 text-[#666] hover:text-[#999] rounded" title="Sort">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Import button */}
      <div className="p-2 border-b border-[#2a2a2a]">
        <button
          onClick={handleImportClick}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#444] rounded-lg text-[#999] text-xs hover:border-[#666] hover:text-[#ccc] transition-colors disabled:opacity-50"
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
        <div className="px-2 py-1 border-b border-[#2a2a2a]">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#222] text-[#ccc] text-[11px] border border-[#333] rounded px-2 py-1 outline-none focus:border-[#3b82f6]"
          />
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {filteredAssets.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-40 mx-3 mt-2 border border-dashed border-[#333] rounded-lg">
            <svg className="w-8 h-8 text-[#444] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-[#666] text-[11px] text-center px-4">
              {search ? 'No matching assets' : 'Import videos, images, or audio'}
            </p>
            <p className="text-[#555] text-[10px] text-center px-4 mt-1">
              or drag and drop files here
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List view */
          <div className="py-1">
            {filteredAssets.map((asset) => (
              <button
                key={`${asset.type}-${asset.id}`}
                onClick={() => handleAddClip(asset)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#222] transition-colors text-left group"
              >
                <div className="w-12 h-8 bg-[#222] rounded overflow-hidden shrink-0 flex items-center justify-center">
                  {asset.thumbnailUrl ? (
                    <img
                      src={resolveUrl(asset.thumbnailUrl)}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : asset.type === 'audio' ? (
                    <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#ccc] text-[11px] truncate">{asset.filename}</div>
                  <div className="text-[#666] text-[10px]">
                    {asset.duration != null ? formatDuration(asset.duration) : asset.type}
                  </div>
                </div>
                <svg className="w-4 h-4 text-[#444] group-hover:text-[#3b82f6] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 gap-1 p-2">
            {filteredAssets.map((asset) => (
              <button
                key={`${asset.type}-${asset.id}`}
                onClick={() => handleAddClip(asset)}
                className="group relative aspect-video bg-[#222] rounded overflow-hidden border border-[#333] hover:border-[#3b82f6] transition-colors"
              >
                {asset.thumbnailUrl ? (
                  <img
                    src={resolveUrl(asset.thumbnailUrl)}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </div>
                )}
                {asset.duration != null && (
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded">
                    {formatDuration(asset.duration)}
                  </span>
                )}
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                  <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPanel;
