import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Photo } from '../../types';

import { useMapStyle } from './hooks/useMapStyle';
import { usePhotoGeoData } from './hooks/usePhotoGeoData';
import { PhotoMarkers } from './components/PhotoMarkers';
import { MapStyleSelector } from './components/MapStyleSelector';
import { MapOverlay } from './components/MapOverlay';
import { MapStyles } from './components/MapStyles';
import { TravelRouteLayer } from './components/TravelRouteLayer';
import { MapViewportManager } from './components/MapViewportManager';
import { MapToolbar } from './components/MapToolbar';
import { DensityLayer } from './components/DensityLayer';
import { apiClient } from '@/services/apiClient';
import { MapTemporalSlider } from './components/MapTemporalSlider';
import { MapPlaybackPanel } from './components/MapPlaybackPanel';

interface MapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onPhotoLocationUpdate?: (photoId: string | number, next: Partial<Photo>) => void;
}

interface ZoomToExtentsControlProps {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    hasArea: boolean;
  } | null;
  center: [number, number];
  onReady: (action: () => void) => void;
}

const ZoomToExtentsControl: React.FC<ZoomToExtentsControlProps> = ({ bounds, center, onReady }) => {
  const map = useMap();

  useEffect(() => {
    const zoomAction = () => {
      if (!bounds) {
        map.setView(center, 2);
        return;
      }

      if (bounds.hasArea) {
        map.fitBounds(
          L.latLngBounds(
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
          ),
          { padding: [48, 48], animate: true }
        );
        return;
      }

      map.setView(center, 11, { animate: true });
    };

    onReady(zoomAction);
  }, [bounds, center, map, onReady]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({ photos, onPhotoClick, onPhotoLocationUpdate }) => {
  const { selectedStyleId, currentStyle, handleStyleChange } = useMapStyle();
  const [showRoute, setShowRoute] = useState(true);
  const [showDensity, setShowDensity] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [timeLapseActive, setTimeLapseActive] = useState(false);
  const [timeLapsePlaying, setTimeLapsePlaying] = useState(false);
  const [timeLapseProgress, setTimeLapseProgress] = useState(1);
  const [savingPhotoIds, setSavingPhotoIds] = useState<Set<string>>(() => new Set());
  const [zoomToExtents, setZoomToExtents] = useState<() => void>(() => () => undefined);
  const [temporalRange, setTemporalRange] = useState<{ start: number; end: number } | null>(null);

  const datedGeoPhotos = useMemo(() => {
    return photos
      .filter((photo) =>
        photo.latitude !== undefined &&
        photo.latitude !== null &&
        photo.longitude !== undefined &&
        photo.longitude !== null &&
        Number.isFinite(Number(photo.latitude)) &&
        Number.isFinite(Number(photo.longitude))
      )
      .map((photo) => {
        const timestamp = photo.dateTimestamp
          ?? (photo.date ? Date.parse(photo.date) : NaN)
          ?? NaN;
        return {
          photo,
          timestamp,
        };
      })
      .filter((entry) => Number.isFinite(entry.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp);
  }, [photos]);

  const temporalBounds = useMemo(() => {
    if (datedGeoPhotos.length === 0) return null;
    return {
      min: datedGeoPhotos[0].timestamp,
      max: datedGeoPhotos[datedGeoPhotos.length - 1].timestamp,
    };
  }, [datedGeoPhotos]);

  useEffect(() => {
    if (!temporalBounds) {
      setTemporalRange(null);
      return;
    }
    setTemporalRange((current) => {
      if (!current) {
        return { start: temporalBounds.min, end: temporalBounds.max };
      }
      const nextStart = Math.max(temporalBounds.min, Math.min(current.start, temporalBounds.max));
      const nextEnd = Math.max(nextStart, Math.min(current.end, temporalBounds.max));
      if (nextStart === current.start && nextEnd === current.end) {
        return current;
      }
      return { start: nextStart, end: nextEnd };
    });
  }, [temporalBounds]);

  const deferredTemporalRange = useDeferredValue(temporalRange);

  const filteredPhotos = useMemo(() => {
    if (!deferredTemporalRange) {
      return photos;
    }

    return photos.filter((photo) => {
      const timestamp = photo.dateTimestamp ?? (photo.date ? Date.parse(photo.date) : NaN);
      if (!Number.isFinite(timestamp)) {
        return false;
      }
      return timestamp >= deferredTemporalRange.start && timestamp <= deferredTemporalRange.end;
    });
  }, [deferredTemporalRange, photos]);

  const { geoPhotos, center, timelinePhotos, bounds } = usePhotoGeoData(filteredPhotos);
  const filteredTimelineWindow = useMemo(() => {
    if (!deferredTemporalRange) return null;
    return {
      min: deferredTemporalRange.start,
      max: deferredTemporalRange.end,
    };
  }, [deferredTemporalRange]);

  const currentPlaybackTimestamp = useMemo(() => {
    if (!filteredTimelineWindow) return null;
    const { min, max } = filteredTimelineWindow;
    const span = max - min;
    if (span <= 0) return min;
    return min + span * timeLapseProgress;
  }, [filteredTimelineWindow, timeLapseProgress]);

  const timeLapsePhotos = useMemo(() => {
    if (!timeLapseActive || currentPlaybackTimestamp === null) {
      return geoPhotos;
    }
    return geoPhotos.filter((photo) => {
      const timestamp = photo.dateTimestamp ?? (photo.date ? Date.parse(photo.date) : NaN);
      return Number.isFinite(timestamp) && timestamp <= currentPlaybackTimestamp;
    });
  }, [currentPlaybackTimestamp, geoPhotos, timeLapseActive]);

  const visibleTimelinePhotos = useMemo(() => {
    if (!timeLapseActive || currentPlaybackTimestamp === null) {
      return timelinePhotos;
    }
    return timelinePhotos.filter((photo) => {
      const timestamp = photo.dateTimestamp ?? (photo.date ? Date.parse(photo.date) : NaN);
      return Number.isFinite(timestamp) && timestamp <= currentPlaybackTimestamp;
    });
  }, [currentPlaybackTimestamp, timeLapseActive, timelinePhotos]);

  const canShowRoute = visibleTimelinePhotos.length > 1;
  const saveCount = savingPhotoIds.size;
  const temporalFilterActive = Boolean(
    temporalBounds &&
    temporalRange &&
    (temporalRange.start !== temporalBounds.min || temporalRange.end !== temporalBounds.max)
  );

  const handleToggleRoute = useCallback(() => {
    if (!canShowRoute) return;
    setShowRoute((current) => !current);
  }, [canShowRoute]);
  const handleToggleDensity = useCallback(() => {
    setShowDensity((current) => !current);
  }, []);
  const handleToggleEditMode = useCallback(() => {
    setEditMode((current) => !current);
  }, []);
  const handleToggleTimeLapse = useCallback(() => {
    setTimeLapseActive((current) => {
      const next = !current;
      if (!next) {
        setTimeLapsePlaying(false);
        setTimeLapseProgress(1);
      } else {
        setTimeLapseProgress(0);
      }
      return next;
    });
  }, []);

  const handlePhotoLocationChange = useCallback(async (photo: Photo, coords: { latitude: number; longitude: number }) => {
    const photoId = String(photo.id);
    setSavingPhotoIds((current) => {
      const next = new Set(current);
      next.add(photoId);
      return next;
    });

    try {
      const data = await apiClient.put<{
        id: string | number;
        latitude: number;
        longitude: number;
        location?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
      }>(`/api/v1/photos/${photo.id}/location`, coords);

      onPhotoLocationUpdate?.(photo.id, {
        latitude: data.latitude,
        longitude: data.longitude,
        location: data.location ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        country: data.country ?? undefined,
      });
    } catch (error) {
      alert('Failed to update photo location.');
      throw error;
    } finally {
      setSavingPhotoIds((current) => {
        const next = new Set(current);
        next.delete(photoId);
        return next;
      });
    }
  }, [onPhotoLocationUpdate]);

  const savingPhotoIdsMemo = useMemo(() => savingPhotoIds, [savingPhotoIds]);
  const handleTogglePlayback = useCallback(() => {
    if (!timeLapseActive) return;
    setTimeLapsePlaying((current) => !current);
  }, [timeLapseActive]);
  const handlePlaybackReset = useCallback(() => {
    setTimeLapsePlaying(false);
    setTimeLapseProgress(0);
  }, []);
  const handlePlaybackProgressChange = useCallback((progress: number) => {
    setTimeLapsePlaying(false);
    setTimeLapseProgress(Math.max(0, Math.min(1, progress)));
  }, []);
  const handleTemporalStartChange = useCallback((nextStart: number) => {
    if (!temporalBounds) return;
    startTransition(() => {
      setTemporalRange((current) => {
        const fallback = current ?? { start: temporalBounds.min, end: temporalBounds.max };
        return {
          start: Math.min(nextStart, fallback.end),
          end: fallback.end,
        };
      });
    });
  }, [temporalBounds]);

  const handleTemporalEndChange = useCallback((nextEnd: number) => {
    if (!temporalBounds) return;
    startTransition(() => {
      setTemporalRange((current) => {
        const fallback = current ?? { start: temporalBounds.min, end: temporalBounds.max };
        return {
          start: fallback.start,
          end: Math.max(nextEnd, fallback.start),
        };
      });
    });
  }, [temporalBounds]);

  const handleTemporalReset = useCallback(() => {
    if (!temporalBounds) return;
    startTransition(() => {
      setTemporalRange({ start: temporalBounds.min, end: temporalBounds.max });
    });
  }, [temporalBounds]);

  useEffect(() => {
    if (!timeLapseActive || !timeLapsePlaying) {
      return;
    }

    let frameId = 0;
    let lastTime = 0;
    const durationMs = 12000;

    const step = (time: number) => {
      if (!lastTime) {
        lastTime = time;
      }
      const delta = time - lastTime;
      lastTime = time;

      setTimeLapseProgress((current) => {
        const next = current + delta / durationMs;
        if (next >= 1) {
          setTimeLapsePlaying(false);
          return 1;
        }
        return next;
      });

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [timeLapseActive, timeLapsePlaying]);

  const timeLapseDateLabel = useMemo(() => {
    if (!timeLapseActive || currentPlaybackTimestamp === null) {
      return null;
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(currentPlaybackTimestamp));
  }, [currentPlaybackTimestamp, timeLapseActive]);

  return (
    <div className="w-full h-full relative bg-[#0a0a0a]" style={{ contain: 'layout style' }}>
      <MapContainer
        center={center} 
        zoom={2}
        style={{ width: '100%', height: '100%', background: '#0a0a0a' }}
        zoomControl={false}
        preferCanvas={true}
      >
        <MapViewportManager bounds={bounds} center={center} emptyZoom={2} />
        <ZoomToExtentsControl
          bounds={bounds}
          center={center}
          onReady={(action) => setZoomToExtents(() => action)}
        />
        <TileLayer
          key={selectedStyleId}
          attribution={currentStyle.attribution}
          url={currentStyle.url}
        />
        {showDensity && <DensityLayer photos={timeLapsePhotos} />}
        {showRoute && canShowRoute && (
          <TravelRouteLayer photos={visibleTimelinePhotos} onPhotoClick={onPhotoClick} />
        )}
        <PhotoMarkers
          geoPhotos={timeLapsePhotos}
          onPhotoClick={onPhotoClick}
          editMode={editMode}
          savingPhotoIds={savingPhotoIdsMemo}
          onPhotoLocationChange={handlePhotoLocationChange}
        />
      </MapContainer>

      <MapOverlay
        geoPhotoCount={timeLapsePhotos.length}
        totalGeoPhotoCount={photos.filter((photo) => photo.latitude != null && photo.longitude != null).length}
        routeEnabled={showRoute && canShowRoute}
        densityEnabled={showDensity}
        editMode={editMode}
        saveCount={saveCount}
        temporalFilterActive={temporalFilterActive}
        timeLapseActive={timeLapseActive}
        timeLapseDateLabel={timeLapseDateLabel}
        routePhotoCount={visibleTimelinePhotos.length}
        firstRoutePhoto={visibleTimelinePhotos[0]}
        lastRoutePhoto={visibleTimelinePhotos[visibleTimelinePhotos.length - 1]}
      />
      <MapStyleSelector 
        selectedStyleId={selectedStyleId} 
        onStyleChange={handleStyleChange} 
      />
      <MapToolbar
        canShowRoute={canShowRoute}
        showRoute={showRoute && canShowRoute}
        showDensity={showDensity}
        editMode={editMode}
        saveCount={saveCount}
        timeLapseActive={timeLapseActive}
        onToggleRoute={handleToggleRoute}
        onToggleDensity={handleToggleDensity}
        onToggleEditMode={handleToggleEditMode}
        onToggleTimeLapse={handleToggleTimeLapse}
        onZoomToExtents={zoomToExtents}
      />
      {filteredTimelineWindow && (
        <MapPlaybackPanel
          active={timeLapseActive}
          isPlaying={timeLapsePlaying}
          progress={timeLapseProgress}
          currentTimestamp={currentPlaybackTimestamp}
          visibleCount={timeLapsePhotos.length}
          totalCount={geoPhotos.length}
          onToggleActive={handleToggleTimeLapse}
          onTogglePlayback={handleTogglePlayback}
          onProgressChange={handlePlaybackProgressChange}
          onReset={handlePlaybackReset}
        />
      )}
      {temporalBounds && temporalRange && (
        <MapTemporalSlider
          minTimestamp={temporalBounds.min}
          maxTimestamp={temporalBounds.max}
          startTimestamp={temporalRange.start}
          endTimestamp={temporalRange.end}
          filteredCount={geoPhotos.length}
          totalCount={photos.filter((photo) => photo.latitude != null && photo.longitude != null).length}
          onStartChange={handleTemporalStartChange}
          onEndChange={handleTemporalEndChange}
          onReset={handleTemporalReset}
        />
      )}
      <MapStyles />
    </div>
  );
};
