import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../constants';
import { Photo } from '../../types';
import { Person } from './types';

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/people/`);
      if (response.ok) {
        const data = await response.json();
        setPeople(data);
      }
    } catch (e) {
      console.error('Failed to fetch people', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const updatePersonName = useCallback((personId: number, newName: string) => {
    setPeople(prev =>
      prev.map(p => (p.id === personId ? { ...p, name: newName } : p))
    );
  }, []);

  return { people, isLoading, fetchPeople, updatePersonName };
}

export function usePersonPhotos(person: Person | null) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPhotos = useCallback(async () => {
    if (!person) return;

    setIsLoading(true);
    setPhotos([]);
    try {
      const response = await fetch(`${API_BASE}/api/v1/people/${person.id}/photos`);
      if (response.ok) {
        const data = await response.json();
        const photos = data.photos || [];
        setPhotos(photos);
      }
    } catch (e) {
      console.error('Failed to fetch person photos', e);
    } finally {
      setIsLoading(false);
    }
  }, [person]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return { photos, isLoading, fetchPhotos };
}

export function usePersonRename(
  onSuccess: (personId: number, newName: string) => void
) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = useCallback((person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  const saveRename = useCallback(
    async (personId: number) => {
      if (!editName.trim()) return;

      try {
        const response = await fetch(
          `${API_BASE}/api/v1/people/${personId}/name`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName.trim() }),
          }
        );
        if (response.ok) {
          setEditingId(null);
          onSuccess(personId, editName.trim());
        }
      } catch (e) {
        console.error('Failed to rename person', e);
      }
    },
    [editName, onSuccess]
  );

  return {
    editingId,
    editName,
    setEditName,
    startRename,
    cancelRename,
    saveRename,
  };
}
