import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { Album, Photo } from '../../../types';

interface UseAlbumsReturn {
  albums: Album[];
  selectedAlbum: Album | null;
  setSelectedAlbum: (album: Album | null) => void;
  albumPhotos: Photo[];
  isLoading: boolean;
  fetchAlbums: () => Promise<void>;
  fetchAlbumPhotos: (album: Album) => Promise<void>;
  renameAlbum: (album: Album, newName: string) => Promise<void>;
  createAlbum: (name: string) => Promise<Album | null>;
  deleteAlbum: (albumId: number) => Promise<boolean>;
  addPhotosToAlbum: (albumId: number, photoIds: number[]) => Promise<boolean>;
  removePhotosFromAlbum: (albumId: number, photoIds: number[]) => Promise<boolean>;
  setAlbumCover: (albumId: number, photoId: number) => Promise<boolean>;
}

export const useAlbums = (): UseAlbumsReturn => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlbums = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/`);
      const data = await response.json();
      setAlbums(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch albums', e);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const fetchAlbumPhotos = useCallback(async (album: Album) => {
    setIsLoading(true);
    setAlbumPhotos([]);
    try {
      const url = `${API_BASE}/api/v1/albums/${album.id}/photos`;
      const response = await fetch(url);
      const data = await response.json();
      setAlbumPhotos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch album photos', e);
      setAlbumPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAlbum = useCallback(async (name: string): Promise<Album | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        const data = await response.json();
        fetchAlbums();
        return data;
      }
    } catch (e) {
      console.error('Failed to create album', e);
    }
    return null;
  }, [fetchAlbums]);

  const deleteAlbum = useCallback(async (albumId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/${albumId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchAlbums();
        if (selectedAlbum?.id === albumId) {
          setSelectedAlbum(null);
        }
        return true;
      }
    } catch (e) {
      console.error('Failed to delete album', e);
    }
    return false;
  }, [fetchAlbums, selectedAlbum]);

  const renameAlbum = useCallback(async (album: Album, newName: string) => {
    const id = album.id;
    if (!id) return;

    try {
      const endpoint = `${API_BASE}/api/v1/albums/${id}/rename`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (response.ok) {
        fetchAlbums();
        if (selectedAlbum?.id === id) {
          setSelectedAlbum(prev => prev ? { ...prev, name: newName } : null);
        }
      }
    } catch (e) {
      console.error('Failed to rename album', e);
    }
  }, [fetchAlbums, selectedAlbum]);

  const addPhotosToAlbum = useCallback(async (albumId: number, photoIds: number[]): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/${albumId}/add-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: photoIds })
      });
      if (response.ok) {
        fetchAlbums();
        return true;
      }
    } catch (e) {
      console.error('Failed to add photos to album', e);
    }
    return false;
  }, [fetchAlbums]);

  const removePhotosFromAlbum = useCallback(async (albumId: number, photoIds: number[]): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/${albumId}/remove-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: photoIds })
      });
      if (response.ok) {
        fetchAlbums();
        if (selectedAlbum?.id === albumId) {
          setAlbumPhotos(prev => prev.filter(p => !photoIds.includes(Number(p.id))));
        }
        return true;
      }
    } catch (e) {
      console.error('Failed to remove photos from album', e);
    }
    return false;
  }, [fetchAlbums, selectedAlbum]);

  const setAlbumCover = useCallback(async (albumId: number, photoId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/${albumId}/set-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photoId })
      });
      if (response.ok) {
        fetchAlbums();
        return true;
      }
    } catch (e) {
      console.error('Failed to set album cover', e);
    }
    return false;
  }, [fetchAlbums]);

  return {
    albums,
    selectedAlbum,
    setSelectedAlbum,
    albumPhotos,
    isLoading,
    fetchAlbums,
    fetchAlbumPhotos,
    renameAlbum,
    createAlbum,
    deleteAlbum,
    addPhotosToAlbum,
    removePhotosFromAlbum,
    setAlbumCover
  };
};
