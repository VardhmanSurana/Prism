import React, { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { Photo } from '../../../types';

interface DensityLayerProps {
  photos: Photo[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRadius(zoom: number) {
  if (zoom <= 3) return 52;
  if (zoom <= 5) return 42;
  if (zoom <= 8) return 30;
  if (zoom <= 11) return 22;
  return 16;
}

export const DensityLayer: React.FC<DensityLayerProps> = ({ photos }) => {
  const map = useMap();

  useEffect(() => {
    const overlayPane = map.getPanes().overlayPane;
    if (!overlayPane) return;

    const canvas = L.DomUtil.create('canvas', 'prism-density-layer') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.mixBlendMode = 'screen';
    canvas.style.opacity = '0.82';
    overlayPane.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    const draw = () => {
      const size = map.getSize();
      const bounds = map.getBounds().pad(0.35);
      const zoom = map.getZoom();
      const radius = getRadius(zoom);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(size.x * dpr));
      canvas.height = Math.max(1, Math.floor(size.y * dpr));
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const visiblePhotos = photos.filter((photo) =>
        bounds.contains([Number(photo.latitude), Number(photo.longitude)])
      );
      if (visiblePhotos.length === 0) {
        return;
      }

      const projectedPoints = visiblePhotos.map((photo) =>
        map.latLngToContainerPoint([Number(photo.latitude), Number(photo.longitude)])
      );

      ctx.globalCompositeOperation = 'source-over';
      for (const point of projectedPoints) {
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, 'rgba(210, 255, 114, 0.24)');
        gradient.addColorStop(0.4, 'rgba(210, 255, 114, 0.16)');
        gradient.addColorStop(0.72, 'rgba(90, 200, 250, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      for (const point of projectedPoints) {
        const stackedNeighbors = projectedPoints.reduce((count, candidate) => {
          const dx = candidate.x - point.x;
          const dy = candidate.y - point.y;
          return dx * dx + dy * dy <= radius * radius ? count + 1 : count;
        }, 0);

        const intensity = clamp(stackedNeighbors / 12, 0.18, 0.95);
        const focusGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 0.6);
        focusGradient.addColorStop(0, `rgba(255, 247, 173, ${intensity})`);
        focusGradient.addColorStop(0.5, `rgba(210, 255, 114, ${intensity * 0.55})`);
        focusGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = focusGradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    map.on('moveend zoomend resize', draw);

    return () => {
      map.off('moveend zoomend resize', draw);
      canvas.remove();
    };
  }, [map, photos]);

  return null;
};
