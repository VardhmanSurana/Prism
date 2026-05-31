import React from 'react';
import { PhotoGridRowProps } from './types';
import { PhotoItem } from './PhotoItem';
import { ROW_HEIGHT, ROW_PADDING } from './constants';

export const PhotoGridRow = React.memo<PhotoGridRowProps>(({
  photos,
  isFull,
  selectedIds,
  isSelectionMode,
  onPhotoClick,
  onToggleSelection,
  virtualRowStart,
  virtualRowKey,
  virtualRowIndex,
  measureElement,
}) => {
  return (
    <div
      key={virtualRowKey}
      data-index={virtualRowIndex}
      ref={measureElement}
      className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-32 flex gap-2"
      style={{
        transform: `translateY(${virtualRowStart}px)`,
        height: `${ROW_HEIGHT}px`,
        paddingBottom: `${ROW_PADDING}px`,
      }}
    >
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          isSelected={selectedIds.has(String(photo.id))}
          isSelectionMode={isSelectionMode}
          isFullRow={isFull}
          rowHeight={ROW_HEIGHT}
          rowPadding={ROW_PADDING}
          onPhotoClick={onPhotoClick}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isFull !== nextProps.isFull) return false;
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;
  if (prevProps.virtualRowStart !== nextProps.virtualRowStart) return false;
  if (prevProps.virtualRowIndex !== nextProps.virtualRowIndex) return false;
  if (prevProps.photos.length !== nextProps.photos.length) return false;
  
  for (let i = 0; i < prevProps.photos.length; i++) {
    if (prevProps.photos[i].id !== nextProps.photos[i].id) return false;
  }
  
  // Custom check: only re-render if selection state for a photo in this specific row changed!
  for (const photo of prevProps.photos) {
    const wasSelected = prevProps.selectedIds.has(String(photo.id));
    const isSelected = nextProps.selectedIds.has(String(photo.id));
    if (wasSelected !== isSelected) return false;
  }
  
  return true;
});
