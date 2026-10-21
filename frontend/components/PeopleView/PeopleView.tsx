import React, { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Person, PeopleViewProps } from './types';
import { usePeople, usePersonPhotos, usePersonRename } from './hooks';
import { PersonGrid } from './PersonGrid';
import { PersonDetail } from './PersonDetail';

/**
 * PeopleView - Renders people view.
 */
export const PeopleView: React.FC<PeopleViewProps> = ({
  onPhotoClick,
  onPhotosLoaded,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const personIdParam = searchParams.get('personId');

  const { people, isLoading: peopleLoading, fetchPeople, updatePersonName } = usePeople();
  const [selectedPerson, setSelectedPerson] = React.useState<Person | null>(null);

  const { photos: personPhotos, isLoading: photosLoading, fetchPhotos: fetchPersonPhotos } = usePersonPhotos(selectedPerson);

  const handleRenameSuccess = useCallback(
    (personId: number | string, newName: string) => {
      fetchPeople();
      if (selectedPerson && (String(selectedPerson.id) === String(personId) || selectedPerson.uuid === String(personId))) {
        setSelectedPerson((prev) => (prev ? { ...prev, name: newName } : null));
      }
    },
    [fetchPeople, selectedPerson]
  );

  const {
    editingId,
    editName,
    setEditName,
    startRename,
    cancelRename,
    saveRename,
  } = usePersonRename(handleRenameSuccess);

  // Handle URL param for selected person
  useEffect(() => {
    if (personIdParam && people.length > 0 && !selectedPerson) {
      /**
       * p - Performs p.
       */
      const p = people.find((p) => String(p.id) === personIdParam || p.uuid === personIdParam);
      if (p) {
        setSelectedPerson(p);
      }
    }
  }, [personIdParam, people, selectedPerson]);

  // Notify parent when photos load
  useEffect(() => {
    if (selectedPerson && !photosLoading) {
      onPhotosLoaded?.(personPhotos);
    }
  }, [selectedPerson, personPhotos, photosLoading, onPhotosLoaded]);

  const handlePersonClick = useCallback(
    (person: Person) => {
      setSelectedPerson(person);
      setSearchParams({ personId: person.uuid || String(person.id) });
    },
    [setSearchParams]
  );

  /**
   * handleBack - Handles back.
   */
  const handleBack = useCallback(() => {
    setSelectedPerson(null);
    setSearchParams({});
    onPhotosLoaded?.([]);
  }, [setSearchParams, onPhotosLoaded]);

  if (selectedPerson) {
    return (
      <PersonDetail
        person={selectedPerson}
        photos={personPhotos}
        isLoading={photosLoading}
        onBack={handleBack}
        onPhotoClick={onPhotoClick}
        onRefreshPhotos={fetchPersonPhotos}
      />
    );
  }

  return (
    <PersonGrid
      people={people}
      isLoading={peopleLoading}
      editingId={editingId}
      editName={editName}
      onPersonClick={handlePersonClick}
      onRefresh={fetchPeople}
      onStartRename={startRename}
      onCancelRename={cancelRename}
      onSaveRename={saveRename}
      onEditNameChange={setEditName}
    />
  );
};
