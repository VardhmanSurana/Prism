import { useMemo } from 'react';
import { Photo } from '../../../types';
import { RowItem } from '../types';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

export const usePhotoGrid = (
  photos: Photo[],
  maxRowWidth?: number,
  containerWidth?: number,
  rowHeight: number = 280
) => {
  const { settings } = useGalleryLayout();
  const imageGrouping = settings.imageGrouping;

  const effectiveMaxWidth = useMemo(() => {
    if (containerWidth && containerWidth > 300) {
      // Subtract grid margins/padding (e.g. 140px total for padding & timeline offset)
      const availableWidth = Math.max(300, containerWidth - 140);
      return Math.max(3.0, availableWidth / rowHeight);
    }
    return maxRowWidth ? maxRowWidth * 1.5 : 6.0;
  }, [containerWidth, rowHeight, maxRowWidth]);

  const rowItems = useMemo(() => {
    const rows: RowItem[] = [];

    if (imageGrouping === 'none') {
      // Flat grid - no grouping, no headers
      let currentRow: Photo[] = [];
      let currentRowWidth = 0;

      photos.forEach((photo) => {
        const ar = photo.aspect_ratio || (photo.height > 0 ? photo.width / photo.height : 1.0);
        currentRow.push(photo);
        currentRowWidth += ar;

        if (currentRowWidth >= effectiveMaxWidth) {
          rows.push({ type: 'row', photos: currentRow, isFull: true });
          currentRow = [];
          currentRowWidth = 0;
        }
      });

      if (currentRow.length > 0) {
        const isCloseToFull = currentRowWidth >= effectiveMaxWidth * 0.7;
        rows.push({ type: 'row', photos: currentRow, isFull: isCloseToFull });
      }

      return rows;
    }

    // Grouping is either 'months', 'years', or default 'none' (in store representation, but treated as days if not 'none'/'months'/'years')
    const groups: { [key: string]: Photo[] } = {};
    photos.forEach((photo) => {
      let dateKey = 'Unknown';
      if (photo.date) {
        const fullDate = photo.date.split('T')[0];
        if (imageGrouping === 'months') {
          dateKey = fullDate.substring(0, 7); // YYYY-MM
        } else if (imageGrouping === 'years') {
          dateKey = fullDate.substring(0, 4); // YYYY
        } else {
          dateKey = fullDate; // YYYY-MM-DD (days)
        }
      }
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

        if (currentRowWidth >= effectiveMaxWidth) {
          rows.push({ type: 'row', photos: currentRow, isFull: true });
          currentRow = [];
          currentRowWidth = 0;
        }
      });

      if (currentRow.length > 0) {
        const isCloseToFull = currentRowWidth >= effectiveMaxWidth * 0.7;
        rows.push({ type: 'row', photos: currentRow, isFull: isCloseToFull });
      }
    });

    return rows;
  }, [photos, effectiveMaxWidth, imageGrouping]);

  return rowItems;
};
