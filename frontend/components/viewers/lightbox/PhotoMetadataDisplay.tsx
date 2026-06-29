import React from 'react';
import { MapPin, Camera, Tag, Video } from 'lucide-react';
import { Photo } from '@/types';
import { formatDuration } from '@/utils/formatDuration';

interface PhotoMetadataDisplayProps {
  photo: Photo;
  metadata?: Photo | null;
}

export const PhotoMetadataDisplay: React.FC<PhotoMetadataDisplayProps> = ({ photo, metadata }) => {
  const dateStr = new Date(photo.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = new Date(photo.date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const people = metadata?.people;
  const summary = metadata?.summary || photo.ai_summary || photo.caption;

  return (
    <div className="flex items-center justify-between gap-6 animate-in slide-in-from-bottom-2 duration-500 select-none">
      {/* Left: Date + Location */}
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-xs text-white/50 font-mono tabular-nums">
          {dateStr} &middot; {timeStr}
        </span>
        {photo.type === 'video' && photo.duration != null && (
          <span className="flex items-center gap-1 text-xs text-white/50 font-mono tabular-nums">
            <Video size={11} />
            {formatDuration(photo.duration)}
          </span>
        )}
        {photo.location && (
          <span className="flex items-center gap-1.5 text-[11px] text-primary/60 font-mono truncate">
            <MapPin size={11} className="shrink-0" />
            {photo.location}
          </span>
        )}
      </div>

      {/* Center: AI summary or caption */}
      {summary && (
        <p className="text-[11px] text-white/30 italic truncate max-w-md text-center hidden md:block">
          &ldquo;{summary}&rdquo;
        </p>
      )}

      {/* Right: People + Tags */}
      <div className="flex items-center gap-3 shrink-0">
        {people && people.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {people.slice(0, 3).map((person) => (
                <div
                  key={person.id}
                  className="w-5 h-5 rounded-full border border-[#0D0F14] bg-white/10 overflow-hidden"
                  title={person.name}
                >
                  {person.cover_face_thumbnail ? (
                    <img
                      src={person.cover_face_thumbnail}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] text-white/50 font-bold">
                      {person.name?.[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-white/30 font-mono">
              {people.length} {people.length === 1 ? 'person' : 'people'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
