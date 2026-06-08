import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Photo } from '../types';
import { API_BASE, resolveUrl } from '../constants';
import { eventService } from '../services/EventService';

import { customConfirm } from '../services/ConfirmService';

// Hooks
import { useLightboxGestures } from '../hooks/useLightboxGestures';
import { useImageHighRes } from '../hooks/useImageHighRes';
import { useZoomShortcuts } from '../hooks/useZoomShortcuts';

// Sub-components
import {
  InfoPanel,
  Toolbar,
  PhotoMetadataDisplay,
  NavigationArrows,
  ImageDisplay
} from './lightbox';
import { EditingMode } from './Editing/EditingMode';

interface LightboxProps {
  photo: Photo;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  photo,
  onClose,
  onNext,
  onPrev
}) => {
  // UI State
  const [showInfo, setShowInfo] = useState(false);
  const [metadata, setMetadata] = useState<Photo | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [lastNavDir, setLastNavDir] = useState<'prev' | 'next' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhotoUrl, setEditedPhotoUrl] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setLastNavDir('prev');
    onPrev();
  }, [onPrev]);

  const handleNext = useCallback(() => {
    setLastNavDir('next');
    onNext();
  }, [onNext]);

  // Gestures hook
  const {
    zoomScale, setZoomScale, offset, isDragging, resetInteraction,
    handleDoubleClick, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel
  } = useLightboxGestures({ onNext: handleNext, onPrev: handlePrev });

  // High resolution loader hook
  const highRes = useImageHighRes({ photo });

  // Zoom shortcuts (0=reset, 1=2x, +/-, no-modifier)
  useZoomShortcuts();

  // Reset interaction and metadata on photo change
  useEffect(() => {
    resetInteraction();
    setEditedPhotoUrl(null);
    setMetadata(null);
  }, [photo.id, resetInteraction]);

  // Revoke stale blob URL when photo changes, editedPhotoUrl changes, or component unmounts
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
    setIsMetaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/metadata`);
      const data = await res.json();
      setMetadata(data);
    } catch (e) {
      console.error("Failed to fetch metadata", e);
    } finally {
      setIsMetaLoading(false);
    }
  }, [photo.id]);

  // Fetch metadata when info panel is shown
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

  // Keyboard event handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (zoomScale === 1) {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, handleNext, handlePrev, zoomScale]);

  const aspect = useMemo(
    () => (photo.width && photo.height ? photo.width / photo.height : null),
    [photo.width, photo.height],
  );

  const displayContainerStyle = useMemo<React.CSSProperties>(() => ({
    aspectRatio: aspect ? `${aspect}` : undefined,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '85vh',
  }), [aspect]);

  const editingSrc = useMemo(() => {
    const baseSrc = editedPhotoUrl || highRes.currentHighResUrl || photo.url;
    if (baseSrc.startsWith('blob:') || baseSrc.startsWith('data:')) return baseSrc;
    const sep = baseSrc.includes('?') ? '&' : '?';
    // Use highResStatus in the key to force a re-calc when high-res loads
    return `${baseSrc}${sep}nocache=${photo.id}-${highRes.highResStatus}`;
  }, [photo.id, photo.url, editedPhotoUrl, highRes.currentHighResUrl, highRes.highResStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-[#050505] overflow-hidden theme-orange"
    >
      <Toolbar
        photo={photo}
        highResStatus={highRes.highResStatus}
        zoomScale={zoomScale}
        showInfo={showInfo}
        onClose={onClose}
        onSetZoomScale={setZoomScale}
        onResetInteraction={resetInteraction}
        onToggleShowInfo={() => setShowInfo(!showInfo)}
        onEdit={() => setIsEditing(true)}
        onTrash={handleTrash}
      />

      <div className="flex-1 flex overflow-hidden">
        {showInfo && <InfoPanel photo={photo} metadata={metadata} isMetaLoading={isMetaLoading} />}

        <div
          ref={containerRef}
          key={photo.id}
          className={`flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden touch-none transition-all duration-500
            ${lastNavDir === 'prev' ? 'animate-slide-from-left' : lastNavDir === 'next' ? 'animate-slide-from-right' : ''}
          `}
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div
            ref={displayRef}
            style={displayContainerStyle}
            className="relative transition-all duration-500 ease-out bg-transparent"
          >
            <ImageDisplay
              photo={photo}
              zoomScale={zoomScale}
              offset={offset}
              isDragging={isDragging}
              highResStatus={highRes.highResStatus}
              currentHighResUrl={editedPhotoUrl || highRes.currentHighResUrl}
            />
          </div>

          <NavigationArrows
            zoomScale={zoomScale}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      </div>

      <div className="shrink-0 pb-10 px-6 z-20 bg-gradient-to-t from-black/90 to-transparent">
        <PhotoMetadataDisplay photo={photo} />
      </div>

      {isEditing && (
        <EditingMode 
          src={editingSrc}
          photoId={photo.id}
          onClose={() => setIsEditing(false)}
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
                  // User cancelled the dialog
                  return;
                }
                formData.append('save_as_path', saveAsPath);
              } catch (e) {
                console.error("Tauri dialog error:", e);
                // Fallback to default backend behavior if dialog fails
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
