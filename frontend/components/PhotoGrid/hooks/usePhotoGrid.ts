import { useMemo } from 'react';
import { Photo } from '../../../types';
import { RowItem } from '../types';
import { MAX_ROW_WIDTH } from '../constants';

export const usePhotoGrid = (photos: Photo[]) => {
  const rowItems = useMemo(() => {
    const rows: RowItem[] = [];

    const groups: { [key: string]: Photo[] } = {};
    photos.forEach((photo) => {
      const dateKey = photo.date.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(photo);
    });

    const sortedGroups = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

    sortedGroups.forEach(([dateKey, groupPhotos]) => {
      rows.push({
        type: 'header',
        dateKey,
        photoIds: groupPhotos.map((p) => String(p.id)),
        location: groupPhotos[0].location,
      });

      let currentRow: Photo[] = [];
      let currentRowWidth = 0;

      groupPhotos.forEach((photo) => {
        const ar = photo.aspect_ratio || (photo.height > 0 ? photo.width / photo.height : 1.0);
        currentRow.push(photo);
        currentRowWidth += ar;

        if (currentRowWidth >= MAX_ROW_WIDTH) {
          rows.push({ type: 'row', photos: currentRow, isFull: true });
          currentRow = [];
          currentRowWidth = 0;
        }
      });

      if (currentRow.length > 0) {
        rows.push({ type: 'row', photos: currentRow, isFull: false });
      }
    });

    return rows;
  }, [photos]);

  return rowItems;
};
