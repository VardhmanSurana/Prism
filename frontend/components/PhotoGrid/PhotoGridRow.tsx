import React, { useCallback } from 'react';
import { PhotoGridRowProps } from './types';
import { PhotoItem } from './PhotoItem';
import { ROW_PADDING } from './constants';

export const PhotoGridRow = React.memo<PhotoGridRowProps>(({
  photos,
  isFull,
  selectedIds,
  isSelectionMode,
  rowHeight,
  onPhotoClick,
  onToggleSelection,
  virtualRowStart,
  virtualRowKey,
  virtualRowIndex,
  measureElement,
  dateKey,
  isRowHovered,
  onRowHover,
}) => {
  const handleMouseEnter = useCallback(() => onRowHover(dateKey), [dateKey, onRowHover]);
  const handleMouseLeave = useCallback(() => onRowHover(null), [onRowHover]);

  return (
    <div
      key={virtualRowKey}
      data-index={virtualRowIndex}
      ref={measureElement}
      className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-32 flex gap-2"
      style={{
        transform: `translateY(${virtualRowStart}px)`,
        height: `${rowHeight}px`,
        paddingBottom: `${ROW_PADDING}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          isSelected={selectedIds.has(String(photo.id))}
          isSelectionMode={isSelectionMode}
          isFullRow={isFull}
          rowHeight={rowHeight}
          rowPadding={ROW_PADDING}
          onPhotoClick={onPhotoClick}
          onToggleSelection={onToggleSelection}
          isRowHovered={isRowHovered}
        />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isFull !== nextProps.isFull) return false;
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;
  if (prevProps.rowHeight !== nextProps.rowHeight) return false;
  if (prevProps.virtualRowStart !== nextProps.virtualRowStart) return false;
  if (prevProps.virtualRowIndex !== nextProps.virtualRowIndex) return false;
  if (prevProps.dateKey !== nextProps.dateKey) return false;
  if (prevProps.isRowHovered !== nextProps.isRowHovered) return false;
  if (prevProps.photos.length !== nextProps.photos.length) return false;

  for (let i = 0; i < prevProps.photos.length; i++) {
    if (prevProps.photos[i].id !== nextProps.photos[i].id) return false;
  }

  for (const photo of prevProps.photos) {
    const wasSelected = prevProps.selectedIds.has(String(photo.id));
    const isSelected = nextProps.selectedIds.has(String(photo.id));
    if (wasSelected !== isSelected) return false;
  }

  return true;
});
