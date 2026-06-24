import React, { useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Photo } from '@/types';
import { resolveUrl } from '@/constants';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

interface ChangeMapViewProps {
  center: [number, number];
  zoom: number;
}

const ChangeMapView: React.FC<ChangeMapViewProps> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface InfoPanelProps {
  photo: Photo;
  metadata: Photo | null;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ photo, metadata }) => {
  const navigate = useNavigate();
  return (
    <div className="w-80 h-full bg-surface/50 border-r border-white/5 animate-in slide-in-from-left duration-500 overflow-y-auto custom-scrollbar z-30">
      <div className="p-8 space-y-10">
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Technical Details</h3>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Dimensions</p>
              <p className="text-xs text-white font-mono">{photo.width} × {photo.height}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Format</p>
              <p className="text-xs text-white font-mono uppercase">{photo.mime_type?.split('/')[1] || 'Unknown'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Filename</p>
              <p className="text-[10px] text-white font-mono truncate max-w-[120px]" title={photo.filename}>{photo.filename}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Size</p>
              <p className="text-xs text-white font-mono">{metadata?.file_size ? (metadata.file_size / (1024 * 1024)).toFixed(2) + ' MB' : '--'}</p>
            </div>
          </div>
        </section>

        <section className="space-y-2 pt-6 border-t border-white/5">
          <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">File Path</h3>
          <p className="text-[9px] text-gray-500 font-mono break-all leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">{photo.path}</p>
        </section>

        {metadata?.summary && (
          <section className="space-y-2 pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">AI Summary</h3>
            <p className="text-xs text-gray-400 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">{metadata.summary}</p>
          </section>
        )}

        {metadata?.people && metadata.people.length > 0 && (
          <section className="space-y-3 pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">People in Photo</h3>
            <div className="flex flex-wrap gap-2">
              {metadata.people.map((person: any) => (
                <button
                  key={person.id}
                  onClick={() => navigate(`/people?personId=${person.id}`)}
                  className="flex items-center gap-2 bg-surface hover:bg-surfaceHover border border-white/5 hover:border-primary/30 rounded-full pr-3 pl-1 py-1 transition-all group"
                >
                  <img
                    src={resolveUrl(person.cover_face_thumbnail)}
                    alt={person.name}
                    className="w-6 h-6 rounded-full object-cover bg-black/20"
                  />
                  <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{person.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {photo.location && (
          <section className="space-y-4 pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2">
              <MapPin size={12} />
              Location
            </h3>

            {(() => {
              const lat = metadata?.latitude || photo.latitude;
              const lng = metadata?.longitude || photo.longitude;
              if (!lat || !lng) return null;
              const center: [number, number] = [Number(lat), Number(lng)];
              return (
                <button
                  onClick={() => navigate('/map')}
                  className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-primary/30 transition-all group relative block"
                >
                  <div className="w-full h-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <MapContainer
                      center={center}
                      zoom={13}
                      style={{ width: '100%', height: '100%', background: '#f4f3f0' }}
                      dragging={false}
                      zoomControl={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                      boxZoom={false}
                      keyboard={false}
                      touchZoom={false}
                    >
                      <ChangeMapView center={center} zoom={13} />
                      <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={center}
                        icon={L.divIcon({
                          className: 'custom-mini-marker',
                          html: `
                            <div class="relative flex items-center justify-center transform -translate-y-1/2">
                              <svg class="w-7 h-7 filter drop-shadow-md" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"/>
                                <circle cx="12" cy="9" r="3" fill="#ffffff"/>
                              </svg>
                            </div>
                          `,
                          iconSize: [28, 28],
                          iconAnchor: [14, 28]
                        })}
                      />
                    </MapContainer>
                  </div>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-[1000] pointer-events-none" />
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-[1000] pointer-events-none">
                    Open Map →
                  </div>
                </button>
              );
            })()}

            <div className="flex flex-col gap-1">
              <p className="text-white font-bold text-lg leading-tight">{photo.location}</p>
              {metadata?.city && (
                <p className="text-gray-400 text-xs font-mono">{metadata.city}, {metadata.state}</p>
              )}
              {(metadata?.latitude || metadata?.longitude) && (
                <p className="text-primary/60 text-[10px] font-mono mt-2 tracking-wider">
                  {metadata.latitude?.toFixed(6)}, {metadata.longitude?.toFixed(6)}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
