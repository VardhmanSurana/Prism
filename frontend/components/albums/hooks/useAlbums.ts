import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { Album, Photo } from '../../../types';

export type AlbumType = 'places' | 'memories';

interface UseAlbumsReturn {
  activeTab: AlbumType;
  setActiveTab: (tab: AlbumType) => void;
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
  const [activeTab, setActiveTab] = useState<AlbumType>('places');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlbums = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/albums/?type=${activeTab}`);
      const data = await response.json();
      setAlbums(data);
    } catch (e) {
      console.error('Failed to fetch albums', e);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const fetchAlbumPhotos = useCallback(async (album: Album) => {
    setIsLoading(true);
    setAlbumPhotos([]);
    try {
      let url = `${API_BASE}/api/v1/albums/${album.id}/photos?type=${album.type}`;
      
      if (album.type === 'places') {
        const { city, state, country } = album.metadata || {};
        const params = new URLSearchParams();
        if (city) params.append('city', city);
        if (state) params.append('state', state);
        if (country) params.append('country', country);
        url = `${API_BASE}/api/v1/albums/places/photos?${params.toString()}`;
      } else if (album.type === 'memories') {
        const { year, month } = album.metadata || {};
        url = `${API_BASE}/api/v1/albums/memories/photos?year=${year}&month=${month}`;
      }

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
      const endpoint = `${API_BASE}/api/v1/albums/places/${id}/rename`;
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
    activeTab,
    setActiveTab,
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
