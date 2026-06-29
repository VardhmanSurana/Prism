import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Photo } from '@/types';
import { API_BASE } from '@/constants';
import { eventService } from '@/services/EventService';
import { customConfirm } from '@/services/ConfirmService';

import { useLightboxGestures } from '@/hooks/useLightboxGestures';
import { useImageHighRes } from '@/hooks/useImageHighRes';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';

import { InfoPanel } from './lightbox/InfoPanel';
import { Toolbar } from './lightbox/Toolbar';
import { PhotoMetadataDisplay } from './lightbox/PhotoMetadataDisplay';
import { NavigationArrows } from './lightbox/NavigationArrows';
import { ImageDisplay } from './lightbox/ImageDisplay';
import { Filmstrip } from './lightbox/Filmstrip';
import { VideoPlayer } from './lightbox/VideoPlayer';
import { EditingMode } from '@/components/Editing/EditingMode';

interface LightboxProps {
  photo: Photo;
  photos?: Photo[];
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPhotoSelect?: (photo: Photo) => void;
  onRemoveFromAlbum?: () => void;
  onSetAsCover?: () => void;
  onToggleFavorite?: (id: string | number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  photo,
  photos,
  onClose,
  onNext,
  onPrev,
  onPhotoSelect,
  onRemoveFromAlbum,
  onSetAsCover,
  onToggleFavorite,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [metadata, setMetadata] = useState<Photo | null>(null);
  const [lastNavDir, setLastNavDir] = useState<'prev' | 'next' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhotoUrl, setEditedPhotoUrl] = useState<string | null>(null);

  const unloadInpaintModels = useCallback(() => {
    fetch(`${API_BASE}/api/v1/photos/inpaint/unload`, { method: 'POST' }).catch(() => {});
  }, []);

  const displayRef = useRef<HTMLDivElement>(null);

  const handlePrev = useCallback(() => {
    setLastNavDir('prev');
    onNext();
  }, [onNext]);

  const handleNext = useCallback(() => {
    setLastNavDir('next');
    onPrev();
  }, [onPrev]);

  const {
    zoomScale, setZoomScale, offset, isDragging, resetInteraction,
    handleDoubleClick, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel
  } = useLightboxGestures({ onNext: handleNext, onPrev: handlePrev });

  const highRes = useImageHighRes({ photo });
  const isVideo = photo.type === 'video' || photo.file_type === 'video';
  useZoomShortcuts();

  useEffect(() => {
    resetInteraction();
    setEditedPhotoUrl(null);
    setMetadata(null);
  }, [photo.id, resetInteraction]);

  const prevBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevBlobUrlRef.current && prevBlobUrlRef.current !== editedPhotoUrl) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }
    prevBlobUrlRef.current = editedPhotoUrl?.startsWith('blob:') ? editedPhotoUrl : null;
  }, [editedPhotoUrl]);

  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [photo.id]);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/metadata`);
      const data = await res.json();
      setMetadata(data);
    } catch (e) {
      console.error("Failed to fetch metadata", e);
    }
  }, [photo.id]);

  useEffect(() => {
    if (showInfo) {
      fetchMetadata();
    }
  }, [showInfo, fetchMetadata]);

  const handleTrash = useCallback(async () => {
    if (!await customConfirm('Move this photo to trash?', 'Confirm Trash')) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/trash`, {
        method: 'POST',
      });
      if (res.ok) {
        eventService.emit('photo_trashed', { type: 'photo_trashed', photoId: photo.id });
        onClose();
      } else {
        console.error("Failed to trash photo");
      }
    } catch (e) {
      console.error("Error trashing photo", e);
    }
  }, [photo.id, onClose]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(photo.id);
  }, [photo.id, onToggleFavorite]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isEditing) return;

      if (e.key === 'Escape') {
        onClose();
      }
      if (!isVideo && zoomScale === 1) {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }
    };
    window.addEventListener('keydown', handleKey, { passive: true });
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, handleNext, handlePrev, zoomScale, isEditing, isVideo]);

  const aspect = useMemo(
    () => (photo.width && photo.height ? photo.width / photo.height : null),
    [photo.width, photo.height],
  );

  const displayContainerStyle = useMemo<React.CSSProperties>(() => ({
    aspectRatio: aspect ? `${aspect}` : undefined,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '80vh',
  }), [aspect]);

  const editingSrc = useMemo(() => {
    const baseSrc = editedPhotoUrl || highRes.currentHighResUrl || photo.url;
    if (baseSrc.startsWith('blob:') || baseSrc.startsWith('data:')) return baseSrc;
    const sep = baseSrc.includes('?') ? '&' : '?';
    return `${baseSrc}${sep}nocache=${photo.id}-${highRes.highResStatus}`;
  }, [photo.id, photo.url, editedPhotoUrl, highRes.currentHighResUrl, highRes.highResStatus]);

  const currentIndex = useMemo(
    () => photos ? photos.findIndex((p) => String(p.id) === String(photo.id)) : 0,
    [photos, photo.id],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0F14] overflow-hidden"
    >
      {/* Top toolbar */}
      <Toolbar
        photo={photo}
        highResStatus={highRes.highResStatus}
        zoomScale={zoomScale}
        showInfo={showInfo}
        currentIndex={currentIndex}
        totalCount={photos?.length ?? 0}
        onClose={onClose}
        onSetZoomScale={setZoomScale}
        onResetInteraction={resetInteraction}
        onToggleShowInfo={() => setShowInfo(!showInfo)}
        onToggleFavorite={handleToggleFavorite}
        onEdit={() => setIsEditing(true)}
        onTrash={handleTrash}
        onRemoveFromAlbum={onRemoveFromAlbum}
        onSetAsCover={onSetAsCover}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {showInfo && <InfoPanel photo={photo} metadata={metadata} />}

        <div
          key={photo.id}
          className={`flex-1 relative flex items-center justify-center overflow-hidden touch-none group
            ${lastNavDir === 'prev' ? 'animate-slide-from-left' : lastNavDir === 'next' ? 'animate-slide-from-right' : ''}
          `}
          onDoubleClick={!isVideo ? handleDoubleClick : undefined}
          onPointerDown={!isVideo ? handlePointerDown : undefined}
          onPointerMove={!isVideo ? handlePointerMove : undefined}
          onPointerUp={!isVideo ? handlePointerUp : undefined}
          onPointerCancel={!isVideo ? handlePointerUp : undefined}
          onWheel={!isVideo ? handleWheel : undefined}
        >
          <div
            ref={displayRef}
            style={displayContainerStyle}
            className="relative transition-all duration-500 ease-out bg-transparent"
          >
            {isVideo ? (
              <VideoPlayer
                photo={photo}
                onClose={onClose}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            ) : (
              <ImageDisplay
                photo={photo}
                zoomScale={zoomScale}
                offset={offset}
                isDragging={isDragging}
                highResStatus={highRes.highResStatus}
                currentHighResUrl={editedPhotoUrl || highRes.currentHighResUrl}
              />
            )}
          </div>

          <NavigationArrows
            zoomScale={zoomScale}
            currentIndex={currentIndex}
            totalCount={photos?.length ?? 0}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      </div>

      {/* Bottom metadata bar */}
      <div className="shrink-0 px-6 py-3 bg-[#0D0F14]/90 backdrop-blur-md border-t border-white/5 z-20">
        <PhotoMetadataDisplay photo={photo} metadata={metadata} />
      </div>

      {/* Filmstrip */}
      {photos && photos.length > 1 ? (
        <Filmstrip
          photos={photos}
          currentPhotoId={photo.id}
          onSelect={onPhotoSelect || (() => {})}
        />
      ) : null}

      {/* Editing overlay */}
      {isEditing && (
        <EditingMode
          src={editingSrc}
          photoId={photo.id}
          onClose={() => {
            setIsEditing(false);
            unloadInpaintModels();
          }}
          onSave={async (blob, isSaveAs) => {
            const formData = new FormData();
            formData.append('file', blob, photo.filename || 'edited.jpg');
            formData.append('original_path', photo.path || '');
            formData.append('is_save_as', isSaveAs ? 'true' : 'false');

            if (isSaveAs) {
              try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const saveAsPath = await save({
                  defaultPath: photo.filename || 'edited.jpg',
                  filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
                });

                if (!saveAsPath) {
                  return;
                }
                formData.append('save_as_path', saveAsPath);
              } catch (e) {
                console.error("Tauri dialog error:", e);
              }
            }

            try {
              const res = await fetch(`${API_BASE}/api/v1/photos/upload-blob`, {
                method: 'POST',
                body: formData,
              });

              if (res.ok) {
                setEditedPhotoUrl(URL.createObjectURL(blob));
                setIsEditing(false);
                unloadInpaintModels();
              } else {
                console.error("Failed to save photo", await res.text());
              }
            } catch (e) {
              console.error("Error saving photo", e);
            }
          }}
        />
      )}
    </motion.div>
  );
};
