import React, { useState } from 'react';
import { FolderPlus, Check, X } from 'lucide-react';
import { Photo } from '../../types';
import { API_BASE } from '../../constants';

interface SmartAlbumModalProps {
  isOpen: boolean;
  photos: Photo[];
  onClose: () => void;
  onCreated?: (albumName: string) => void;
}

export const SmartAlbumModal: React.FC<SmartAlbumModalProps> = ({
  isOpen,
  photos,
  onClose,
  onCreated,
}) => {
  const [albumName, setAlbumName] = useState(
    `AI Search (${photos.length} photos)`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!albumName.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create custom album
      const createRes = await fetch(`${API_BASE}/api/v1/albums/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: albumName.trim() }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to create album');
      }

      const album = await createRes.json();

      // 2. Add matched photo IDs
      const photoIds = photos.map((p) => Number(p.id)).filter(Boolean);
      if (photoIds.length > 0) {
        await fetch(`${API_BASE}/api/v1/albums/${album.id}/add-photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_ids: photoIds }),
        });
      }

      setSuccess(true);
      if (onCreated) onCreated(albumName.trim());
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-[380px] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Create Smart Album</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="py-6 flex flex-col items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <Check size={20} />
            </div>
            <p className="text-xs font-semibold text-white">Album Created Successfully!</p>
            <p className="text-[10px] text-gray-400">Added {photos.length} photos to "{albumName}"</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-400 block">Album Name</label>
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="Enter album title..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <p className="text-[10px] text-gray-500">
              Includes {photos.length} photos matched from your AI search query.
            </p>

            {error && <p className="text-[10px] text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting || !albumName.trim()}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors shadow-lg"
              >
                {isSubmitting ? 'Creating...' : 'Create Album'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
