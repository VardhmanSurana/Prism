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
      }
    } catch (e) {
      console.error('Failed to rename album', e);
    }
  }, [fetchAlbums]);

  return {
    albums,
    selectedAlbum,
    setSelectedAlbum,
    albumPhotos,
    isLoading,
    fetchAlbums,
    fetchAlbumPhotos,
    renameAlbum
  };
};
