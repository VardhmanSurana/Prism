import { useMemo } from 'react';
import { Photo } from '../../../types';
import { RowItem } from '../types';
import { useGalleryLayout, GalleryLayoutMode } from '@/hooks/useGalleryLayout';

/**
 * usePhotoGrid - Hook managing photo grid state with Editorial, Grid, and Dense packing.
 */
export const usePhotoGrid = (
  photos: Photo[],
  maxRowWidth?: number,
  containerWidth?: number,
  rowHeight: number = 280,
  layoutMode: GalleryLayoutMode = 'editorial'
) => {
  const { settings } = useGalleryLayout();
  const imageGrouping = settings.imageGrouping;

  const isMobileViewport = Boolean(containerWidth && containerWidth < 768);

  // Adjust row height and packing factor based on layout mode
  const effectiveRowHeight = useMemo(() => {
    let targetRowHeight = rowHeight;
    if (layoutMode === 'dense') {
      targetRowHeight = Math.max(160, Math.round(rowHeight * 0.65));
    } else if (layoutMode === 'editorial') {
      targetRowHeight = Math.max(300, Math.round(rowHeight * 1.15));
    }
    return isMobileViewport ? Math.min(targetRowHeight, 140) : targetRowHeight;
  }, [layoutMode, rowHeight, isMobileViewport]);

  /**
   * effectiveMaxWidth - Performs effective max width.
   */
  const effectiveMaxWidth = useMemo(() => {
    if (containerWidth && containerWidth > 240) {
      // On mobile (< 768px), only subtract minimal horizontal padding (16px);
      // on desktop, subtract margins and right-side chronology rail allowance (~120px)
      const effectiveWidth =
        containerWidth < 768
          ? Math.max(240, containerWidth - 16)
          : Math.max(300, containerWidth - 120);
      const baseWidth = effectiveWidth / effectiveRowHeight;
      if (layoutMode === 'dense') return baseWidth * 1.35;
      if (layoutMode === 'editorial') return baseWidth * 0.95;
      return Math.max(containerWidth < 768 ? 2.2 : 3.0, baseWidth);
    }
    const base = maxRowWidth ? maxRowWidth * 1.5 : 6.0;
    if (layoutMode === 'dense') return base * 1.4;
    return base;
  }, [containerWidth, effectiveRowHeight, maxRowWidth, layoutMode]);

  /**
   * rowItems - Performs row items calculation.
   */
  const rowItems = useMemo(() => {
    const rows: RowItem[] = [];

    // Flat grid only if imageGrouping is explicitly 'none' AND layoutMode is NOT 'editorial'
    const shouldGroup = layoutMode === 'editorial' || imageGrouping !== 'none';

    if (!shouldGroup) {
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

    // Chronological grouping
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
        location: groupPhotos[0].location || groupPhotos[0].city,
      });

      const heroPhoto = layoutMode === 'editorial' && groupPhotos.length > 0
        ? groupPhotos[0]
        : null;

      let currentRow: Photo[] = [];
      let currentRowWidth = 0;
      let isFirstRowOfGroup = true;

      groupPhotos.forEach((photo) => {
        let ar = photo.aspect_ratio || (photo.height > 0 ? photo.width / photo.height : 1.0);
        // In editorial mode, expand first hero photo so it commands 2 columns
        if (heroPhoto && String(photo.id) === String(heroPhoto.id)) {
          ar = Math.max(ar, 1.8);
        }

        currentRow.push(photo);
        currentRowWidth += ar;

        if (currentRowWidth >= effectiveMaxWidth) {
          rows.push({
            type: 'row',
            photos: currentRow,
            isFull: true,
            heroPhotoId: isFirstRowOfGroup && heroPhoto ? heroPhoto.id : undefined,
          });
          currentRow = [];
          currentRowWidth = 0;
          isFirstRowOfGroup = false;
        }
      });

      if (currentRow.length > 0) {
        const isCloseToFull = currentRowWidth >= effectiveMaxWidth * 0.7;
        rows.push({
          type: 'row',
          photos: currentRow,
          isFull: isCloseToFull,
          heroPhotoId: isFirstRowOfGroup && heroPhoto ? heroPhoto.id : undefined,
        });
      }
    });

    return rows;
  }, [photos, effectiveMaxWidth, imageGrouping, layoutMode]);

  return rowItems;
};
